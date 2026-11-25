/**
 * @file src/engine/__tests__/geometryTools.test.ts
 * @description Suite integral de pruebas unitarias Vitest para las extensiones
 * Kurra3D Studio del núcleo geométrico:
 * - Generador automático de moldes (4 modos)
 * - Proyección conformal de texto/SVG sobre superficies planas y cilíndricas
 * - Validador de imprimibilidad, simplificación, refinamiento/suavizado y Convex Hull
 * - Roscas métricas ISO helicoidales, litofanías cilíndricas y siluetas/cortadores desde imagen
 * - Alineación inteligente y distribución automática en cama
 * - Exportador 3MF estándar con Metadata/model_settings.config
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { BRAND } from '../../brand';
import {
  DEFAULT_PRINTER_PROFILES,
  type ImageTo3DOptions,
  type MeshData,
  type SceneObject,
} from '../../types/kura';
import {
  analyzePrintability,
  applyTransformToMesh,
  computeAlignmentPositions,
  computeConvexHull,
  computeMeshStats,
  createMetricThread,
  createPrimitiveMesh,
  exportSceneTo3MF,
  generateCylindricalLithophane,
  generateMold,
  generateSilhouetteOrCutterFromImage,
  import3MFBuffer,
  projectGraphicOntoSurface,
  refineMesh,
  simplifyMesh,
} from '../index';

/** Helper local para construir un SceneObject válido en las pruebas. */
function makeSceneObject(
  id: string,
  mesh: MeshData,
  overrides: Partial<SceneObject> = {}
): SceneObject {
  return {
    id,
    name: id,
    source: 'primitive',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#38bdf8',
    materialPreset: 'pla_matte',
    role: 'solid',
    visible: true,
    locked: false,
    mesh,
    stats: computeMeshStats(mesh),
    ...overrides,
  };
}

/** Calcula límites AABB de una malla. */
function getBounds(mesh: MeshData) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    const z = mesh.positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Genera una imagen RGBA sintética con un círculo blanco brillante sobre fondo negro. */
function makeCircleRgba(size = 32): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const rMax = size * 0.36;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);
      const val = dist <= rMax ? 255 : 0;
      rgba[idx] = val;
      rgba[idx + 1] = val;
      rgba[idx + 2] = val;
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

describe('Herramientas geométricas: moldes, proyección, análisis, generadores, alineación y 3MF', () => {
  // ==========================================================================
  // 1. Generador automático de moldes (4 modos)
  // ==========================================================================
  describe('1. Generador automático de moldes (src/engine/molds.ts)', () => {
    it('genera los 4 modos de molde watertight con materiales, llaves y proporciones correctas', async () => {
      const masterMesh = await createPrimitiveMesh('cylinder', {
        radius: 10,
        height: 20,
        segments: 24,
      });
      const masterObj = makeSceneObject('Maestro', masterMesh);
      const masterStats = computeMeshStats(masterMesh);

      // Modo 1: direct_1part con embudo de vertido
      const part1 = await generateMold(masterObj, {
        mode: 'direct_1part',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: true,
        pourSpoutRadiusMm: 5,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(part1).toHaveLength(1);
      expect(part1[0].materialPreset).toBe('silicone');
      expect(part1[0].color).toBe('#22c55e');
      const p1Stats = computeMeshStats(part1[0].mesh);
      expect(p1Stats.isManifold).toBe(true);
      expect(p1Stats.dimensionsMm[0]).toBeCloseTo(30, 0);
      expect(p1Stats.dimensionsMm[1]).toBeCloseTo(30, 0);
      // Volumen del molde debe ser menor que caja llena 30x30x30 (27000) por la cavidad + embudo
      expect(p1Stats.volumeMm3).toBeLessThan(27000 - masterStats.volumeMm3 * 0.9);

      // Modo 1b: direct_1part sin embudo (tope abierto en maxY)
      const part1Open = await generateMold(masterObj, {
        mode: 'direct_1part',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: false,
        pourSpoutRadiusMm: 5,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(computeMeshStats(part1Open[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(part1Open[0].mesh).dimensionsMm[1]).toBeCloseTo(25, 0);

      // Modo 2: direct_2part con llaves de registro y desplazamiento visual ±8 mm
      const part2 = await generateMold(masterObj, {
        mode: 'direct_2part',
        wallMarginMm: 6,
        boxWallMm: 3,
        splitAxis: 'z',
        pourSpout: true,
        pourSpoutRadiusMm: 4,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(part2).toHaveLength(2);
      expect(computeMeshStats(part2[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(part2[1].mesh).isManifold).toBe(true);
      // Desplazamiento visual en Z de ±8 mm (diferencia en Z > 16 mm entre mitades)
      expect(part2[1].position[2] - part2[0].position[2]).toBeGreaterThan(16);

      // Modo 3: silicone_master (Caja Madre + Positivo Maestro)
      const masterBox = await generateMold(masterObj, {
        mode: 'silicone_master',
        wallMarginMm: 6,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: false,
        pourSpoutRadiusMm: 5,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(masterBox).toHaveLength(2);
      expect(masterBox[0].nameSuffix).toContain('Caja Madre');
      expect(masterBox[0].materialPreset).toBe('petg_clear');
      expect(masterBox[0].color).toBe('#38bdf8');
      expect(masterBox[1].nameSuffix).toContain('Positivo Maestro');
      expect(masterBox[1].materialPreset).toBe('wax_candle');
      expect(masterBox[1].color).toBe('#f97316');
      expect(computeMeshStats(masterBox[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(masterBox[1].mesh).isManifold).toBe(true);

      // Modo 4: core_cavity (Molde Exterior + Núcleo Interior)
      const coreCav = await generateMold(masterObj, {
        mode: 'core_cavity',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: false,
        pourSpoutRadiusMm: 5,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(coreCav).toHaveLength(2);
      const outerStats = computeMeshStats(coreCav[0].mesh);
      const innerStats = computeMeshStats(coreCav[1].mesh);
      expect(outerStats.isManifold).toBe(true);
      expect(innerStats.isManifold).toBe(true);
      expect(innerStats.dimensionsMm[0]).toBeCloseTo(20 - 6, 0);
      expect(innerStats.dimensionsMm[1]).toBeCloseTo(20 - 6, 0);
    });
  });

  // ==========================================================================
  // 2. Proyección conformal de texto y SVG sobre superficies 3D
  // ==========================================================================
  describe('2. Proyección conformal sobre superficies 3D (src/engine/surfaceProjection.ts)', () => {
    it('proyecta texto sobre un cubo en modos emboss, deboss y flush_inlay multicolor', async () => {
      const cubeMesh = await createPrimitiveMesh('box', {
        width: 40,
        height: 30,
        depth: 40,
      });
      const cubeObj = makeSceneObject('CuboBase', cubeMesh, { color: '#38bdf8' });
      const baseStats = computeMeshStats(cubeMesh);

      // Emboss (+Z): incrementa dimensiones en Z y conserva color del sello
      const embossed = await projectGraphicOntoSurface(cubeObj, {
        kind: 'text',
        text: 'OK',
        mode: 'emboss',
        axis: '+z',
        widthMm: 18,
        depthMm: 2.0,
        colorHex: '#f97316',
      });
      const embStats = computeMeshStats(embossed.mesh);
      expect(embStats.isManifold).toBe(true);
      expect(embStats.dimensionsMm[2]).toBeCloseTo(42.0, 1);
      expect(embossed.mesh.faceColors).toBeDefined();
      expect(embossed.mesh.faceColors!.includes('#f97316')).toBe(true);

      // Deboss (+Z): reduce volumen respecto al cubo original y es watertight
      const debossed = await projectGraphicOntoSurface(cubeObj, {
        kind: 'text',
        text: 'HI',
        mode: 'deboss',
        axis: '+z',
        widthMm: 18,
        depthMm: 2.0,
        colorHex: '#ef4444',
      });
      const debStats = computeMeshStats(debossed.mesh);
      expect(debStats.isManifold).toBe(true);
      expect(debStats.volumeMm3).toBeLessThan(baseStats.volumeMm3);

      // Flush Inlay (+Z): mantiene dimensión externa al ras (40 mm) y conserva color incrustado
      const inlay = await projectGraphicOntoSurface(cubeObj, {
        kind: 'text',
        text: 'K3',
        mode: 'flush_inlay',
        axis: '+z',
        widthMm: 18,
        depthMm: 1.0,
        colorHex: '#22c55e',
      });
      const inlayStats = computeMeshStats(inlay.mesh);
      expect(inlayStats.isManifold).toBe(true);
      expect(inlayStats.dimensionsMm[2]).toBeCloseTo(40.0, 1);
      expect(inlay.mesh.faceColors).toBeDefined();
      expect(inlay.mesh.faceColors!.includes('#22c55e')).toBe(true);
      expect(inlay.mesh.faceColors!.includes('#38bdf8')).toBe(true);
    });

    it('proyecta un SVG de forma cilíndrica curva sobre un cilindro manteniendo cierre watertight', async () => {
      const cylMesh = await createPrimitiveMesh('cylinder', {
        radius: 18,
        height: 36,
        segments: 48,
      });
      const cylObj = makeSceneObject('Cilindro', cylMesh, { color: '#38bdf8' });
      const svg =
        '<svg viewBox="0 0 100 40"><rect x="5" y="5" width="90" height="30" /></svg>';

      const curvedEmboss = await projectGraphicOntoSurface(cylObj, {
        kind: 'svg',
        svgContent: svg,
        mode: 'emboss',
        axis: 'cylindrical',
        widthMm: 26,
        depthMm: 1.5,
        colorHex: '#eab308',
      });
      const stats = computeMeshStats(curvedEmboss.mesh);
      expect(stats.isManifold).toBe(true);
      expect(stats.volumeMm3).toBeGreaterThan(computeMeshStats(cylMesh).volumeMm3);
      expect(curvedEmboss.mesh.faceColors?.includes('#eab308')).toBe(true);

      const curvedInlay = await projectGraphicOntoSurface(cylObj, {
        kind: 'svg',
        svgContent: svg,
        mode: 'flush_inlay',
        axis: 'cylindrical',
        widthMm: 22,
        depthMm: 0.8,
        colorHex: '#a855f7',
      });
      const inlayStats = computeMeshStats(curvedInlay.mesh);
      expect(inlayStats.isManifold).toBe(true);
      expect(curvedInlay.mesh.faceColors?.includes('#a855f7')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Análisis de imprimibilidad, simplificación, refinamiento y Convex Hull
  // ==========================================================================
  describe('3. Análisis estructural, simplify, refine y Convex Hull (src/engine/analysis.ts)', () => {
    it('detecta voladizos, flotación, exceso de cama, peso y filamento con precisión', async () => {
      const bed = DEFAULT_PRINTER_PROFILES.find((p) => p.id === 'bambu-a1-mini')!; // 180x180x180

      // Cono invertido (rotado 180° en X) apoyado en la punta en Y=0 -> paredes en voladizo pronunciado (~51.3° > 45°)
      const cone = await createPrimitiveMesh('cone', {
        radius: 25,
        height: 20,
        segments: 24,
      });
      const invertedConeObj = makeSceneObject('ConoInvertido', cone, {
        position: [0, 20, 0],
        rotation: [Math.PI, 0, 0],
      });

      const report = analyzePrintability(
        invertedConeObj,
        bed,
        'pla_matte',
        20,
        45
      );
      expect(report.isManifold).toBe(true);
      expect(report.fitsInBed).toBe(true);
      expect(report.isFloating).toBe(false);
      expect(report.overhangFaceCount).toBeGreaterThan(10);
      expect(report.overhangPercent).toBeGreaterThan(25);
      expect(report.overhangFaceIndices).toHaveLength(report.overhangFaceCount);
      expect(report.volumeCm3).toBeCloseTo((Math.PI * 625 * 20) / 3 / 1000, 0);
      expect(report.estimatedWeightGrams).toBeGreaterThan(0);
      expect(report.estimatedFilamentMeters).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(100);

      // Objeto flotando y fuera de cama
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const badBox = makeSceneObject('CajaFlotante', box, {
        position: [150, 5, 0],
      });
      const badReport = analyzePrintability(badBox, bed, 'metallic', 100);
      expect(badReport.fitsInBed).toBe(false);
      expect(badReport.isFloating).toBe(true);
      // 100% relleno metálico (densidad 2.7 g/cm³) sobre 8 cm³ = 21.6 g
      expect(badReport.estimatedWeightGrams).toBeCloseTo(8 * 2.7, 1);
      expect(badReport.warnings.length).toBeGreaterThanOrEqual(2);
      expect(badReport.score).toBeLessThanOrEqual(55);
    });

    it('ejecuta simplifyMesh, refineMesh (suave y plano) y computeConvexHull watertight', async () => {
      const sphere = await createPrimitiveMesh('sphere', { radius: 15, segments: 32 });
      const sphereObj = makeSceneObject('Esfera', sphere);
      const origTris = computeMeshStats(sphere).triangles;

      const simplified = await simplifyMesh(sphereObj, 0.8);
      const simpStats = computeMeshStats(simplified);
      expect(simpStats.isManifold).toBe(true);
      expect(simpStats.triangles).toBeLessThan(origTris);

      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const boxObj = makeSceneObject('Cubo', box);
      const refinedSmooth = await refineMesh(boxObj, 3.0, true);
      const refSmoothStats = computeMeshStats(refinedSmooth);
      expect(refSmoothStats.isManifold).toBe(true);
      expect(refSmoothStats.triangles).toBeGreaterThan(12);
      expect(refSmoothStats.triangles).toBeLessThanOrEqual(85000);

      const refinedSharp = await refineMesh(boxObj, 4.0, false);
      expect(computeMeshStats(refinedSharp).isManifold).toBe(true);
      expect(computeMeshStats(refinedSharp).triangles).toBeGreaterThan(12);

      // Convex hull entre dos cubos separados 40 mm
      const b1 = makeSceneObject('B1', box, { position: [-20, 0, 0] });
      const b2 = makeSceneObject('B2', box, { position: [20, 0, 0] });
      const hull = await computeConvexHull([b1, b2]);
      const hullStats = computeMeshStats(hull.mesh);
      expect(hullStats.isManifold).toBe(true);
      // Envolvente de dos cubos de 20x20x20 en x=-20 y x=+20 -> ancho total 60x20x20 = 24 000 mm³
      expect(hullStats.volumeMm3).toBeCloseTo(24000, -1);
      expect(hullStats.dimensionsMm[0]).toBeCloseTo(60, 1);
    });
  });

  // ==========================================================================
  // 4. Roscas ISO, litofanía cilíndrica y silueta/cortador desde imagen
  // ==========================================================================
  describe('4. Generadores especializados: Roscas ISO, Litofanía y Cortador (src/engine/generators.ts)', () => {
    it('genera roscas métricas ISO M8 watertight (bolt, nut y hole)', async () => {
      const bolt = await createMetricThread({
        kind: 'bolt',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 16,
        clearanceMm: 0.25,
        includeHead: true,
      });
      const boltStats = computeMeshStats(bolt);
      expect(boltStats.isManifold).toBe(true);
      expect(boltStats.dimensionsMm[1]).toBeGreaterThan(18);
      expect(getBounds(bolt).minY).toBeCloseTo(0, 4);

      const nut = await createMetricThread({
        kind: 'nut',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 6.5,
        clearanceMm: 0.25,
      });
      const nutStats = computeMeshStats(nut);
      expect(nutStats.isManifold).toBe(true);
      expect(nutStats.dimensionsMm[1]).toBeCloseTo(6.5, 1);

      const holeTap = await createMetricThread({
        kind: 'hole',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 12,
        clearanceMm: 0.3,
      });
      const holeStats = computeMeshStats(holeTap);
      expect(holeStats.isManifold).toBe(true);
      // El diámetro exterior de hole incluye 2 * clearanceMm = 8.6 mm
      expect(holeStats.dimensionsMm[0]).toBeCloseTo(8.6, 0);
    });

    it('genera litofanías cilíndricas cerradas en arco abierto (180°) y tubo completo (360°)', () => {
      const rgba = makeCircleRgba(24);
      const baseOpts: ImageTo3DOptions = {
        name: 'LitoCilindro',
        rgba,
        pixelWidth: 24,
        pixelHeight: 24,
        widthMm: 80,
        depthMm: 50,
        baseThicknessMm: 1.2,
        reliefHeightMm: 2.0,
        invert: false,
        smoothing: 1,
        shapeMode: 'cylindrical',
        cylinderRadiusMm: 25,
        arcDegrees: 180,
      };

      const arcLitho = generateCylindricalLithophane(baseOpts);
      const arcStats = computeMeshStats(arcLitho);
      expect(arcStats.isManifold).toBe(true);
      expect(arcStats.dimensionsMm[1]).toBeCloseTo(50, 2);
      expect(getBounds(arcLitho).minY).toBeCloseTo(0, 4);

      const fullLitho = generateCylindricalLithophane({
        ...baseOpts,
        arcDegrees: 360,
      });
      const fullStats = computeMeshStats(fullLitho);
      expect(fullStats.isManifold).toBe(true);
      expect(fullStats.dimensionsMm[1]).toBeCloseTo(50, 2);
      expect(fullStats.volumeMm3).toBeGreaterThan(arcStats.volumeMm3 * 1.8);
    });

    it('extrae siluetas sólidas y cortadores de galletas (cookie cutter) desde imagen RGBA', async () => {
      const rgba = makeCircleRgba(32);
      const silhouette = await generateSilhouetteOrCutterFromImage({
        name: 'SiluetaCirculo',
        rgba,
        pixelWidth: 32,
        pixelHeight: 32,
        widthMm: 40,
        depthMm: 40,
        baseThicknessMm: 2,
        reliefHeightMm: 3,
        invert: false,
        smoothing: 0,
        shapeMode: 'silhouette',
        threshold: 128,
      });
      const silStats = computeMeshStats(silhouette);
      expect(silStats.isManifold).toBe(true);
      expect(silStats.dimensionsMm[1]).toBeCloseTo(5, 2);

      const cutter = await generateSilhouetteOrCutterFromImage({
        name: 'CortadorCirculo',
        rgba,
        pixelWidth: 32,
        pixelHeight: 32,
        widthMm: 40,
        depthMm: 40,
        baseThicknessMm: 2,
        reliefHeightMm: 10,
        invert: false,
        smoothing: 0,
        shapeMode: 'cutter',
        threshold: 128,
        cutterWallMm: 1.4,
      });
      const cutStats = computeMeshStats(cutter);
      expect(cutStats.isManifold).toBe(true);
      expect(cutStats.dimensionsMm[1]).toBeCloseTo(12, 2);
      // Ambos respetan el tamaño pedido (la pestaña del cortador está incluida en los 40 mm)
      expect(silStats.dimensionsMm[0]).toBeCloseTo(40, 1);
      expect(cutStats.dimensionsMm[0]).toBeCloseTo(40, 1);
      // El cortador tiene centro abierto: mucho menos volumen que una silueta extruida a su altura
      expect(cutStats.volumeMm3).toBeLessThan(silStats.volumeMm3 * (12 / 5));
    });
  });

  // ==========================================================================
  // 5. Alineación inteligente y distribución en cama
  // ==========================================================================
  describe('5. Alineación y distribución en cama (src/engine/alignment.ts)', () => {
    it('alinea objetos por envolvente mundial y los distribuye en grilla sin solapamientos sobre Y=0', async () => {
      const bSmall = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const bLarge = await createPrimitiveMesh('box', { width: 30, height: 20, depth: 20 });

      const o1 = makeSceneObject('o1', bSmall, { position: [5, 12, 0] });
      const o2 = makeSceneObject('o2', bLarge, { position: [40, 0, 20] });
      const o3 = makeSceneObject('o3', bSmall, { position: [8, 4, 2] });

      // Alinear al minX global (-5 de o1: 5 - 5 = 0; o2: 40 - 15 = 25; minX = 0)
      const minXPos = computeAlignmentPositions([o1, o2, o3], 'minX');
      const o1MinX = getBounds(applyTransformToMesh(o1.mesh, minXPos.o1, o1.rotation, o1.scale)).minX;
      const o2MinX = getBounds(applyTransformToMesh(o2.mesh, minXPos.o2, o2.rotation, o2.scale)).minX;
      expect(o1MinX).toBeCloseTo(o2MinX, 4);

      // Alinear centerZ
      const centerZPos = computeAlignmentPositions([o1, o2], 'centerZ');
      const b1Z = getBounds(applyTransformToMesh(o1.mesh, centerZPos.o1, o1.rotation, o1.scale));
      const b2Z = getBounds(applyTransformToMesh(o2.mesh, centerZPos.o2, o2.rotation, o2.scale));
      expect((b1Z.minZ + b1Z.maxZ) * 0.5).toBeCloseTo((b2Z.minZ + b2Z.maxZ) * 0.5, 4);

      // Distribución en grilla sobre la cama
      const bed = DEFAULT_PRINTER_PROFILES[0];
      const gridPos = computeAlignmentPositions([o1, o2, o3], 'arrange_grid', bed);
      const placedBoxes = [o1, o2, o3].map((o) =>
        getBounds(applyTransformToMesh(o.mesh, gridPos[o.id], o.rotation, o.scale))
      );

      // Todos apoyados en Y = 0
      for (const box of placedBoxes) {
        expect(box.minY).toBeCloseTo(0, 4);
      }

      // Ningún par de AABBs en XZ debe solaparse (separación mínima >= 7.9 mm)
      for (let i = 0; i < placedBoxes.length; i++) {
        for (let j = i + 1; j < placedBoxes.length; j++) {
          const a = placedBoxes[i];
          const b = placedBoxes[j];
          const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
          const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
          expect(overlapX > -7.9 && overlapZ > -7.9).toBe(false);
        }
      }
    });
  });

  // ==========================================================================
  // 6. Exportador 3MF estándar
  // ==========================================================================
  describe('6. Exportador 3MF estándar (src/engine/ioFormats.ts)', () => {
    it('genera Metadata/model_settings.config y metadatos estándar sin romper import3MFBuffer; el parámetro de slicer obsoleto no cambia el archivo', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 15, depth: 20 });
      const obj1 = makeSceneObject('PiezaAzul', box, { color: '#38bdf8' });
      const obj2 = makeSceneObject('PiezaNaranja', box, {
        color: '#f97316',
        position: [35, 0, 0],
      });

      const reference = exportSceneTo3MF([obj1, obj2], 'mm', undefined, BRAND);
      for (const legacy of [undefined, 'bambu', 'elegoo', 'snapmaker', 'flashforge'] as const) {
        const bytes = exportSceneTo3MF([obj1, obj2], 'mm', legacy, BRAND);
        expect(Array.from(bytes)).toEqual(Array.from(reference));
        const archive = unzipSync(bytes);

        expect(archive['3D/3dmodel.model']).toBeDefined();
        expect(archive['Metadata/model_settings.config']).toBeDefined();

        const modelXml = strFromU8(archive['3D/3dmodel.model']);
        expect(modelXml).not.toContain('SlicerTarget');
        expect(modelXml).toContain('ISGROTH');

        const configXml = strFromU8(archive['Metadata/model_settings.config']);
        expect(configXml).toContain('<metadata key="extruder" value="1"/>');
        expect(configXml).toContain('<metadata key="extruder" value="2"/>');
        expect(configXml).not.toContain('slicer_target');

        const imported = import3MFBuffer(bytes.buffer as ArrayBuffer);
        expect(imported).toHaveLength(2);
        expect(imported[0].name).toBe('PiezaAzul');
        expect(imported[1].color).toBe('#f97316');
      }
    });
  });
});
