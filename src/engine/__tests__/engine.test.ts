/**
 * @file src/engine/__tests__/engine.test.ts
 * @description Suite integral de pruebas unitarias Vitest para el núcleo geométrico
 * de Kura3D (Manifold WASM, primitivas, CSG, ahuecado, cortes con conectores,
 * SVG, relieve desde imagen, texturas procedurales, pintado y E/S STL/OBJ/3MF).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import type { MeshData, SceneObject } from '../../types/kura';
import {
  applyProceduralTexture,
  applyTransformToMesh,
  computeMeshStats,
  createBufferGeometryFromMeshData,
  createPrimitiveMesh,
  eraseRegionWithSphere,
  exportMeshToBinarySTL,
  exportMeshToOBJ,
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  extrudeSvgToMesh,
  generateReliefFromImage,
  hollowMesh,
  import3MFBuffer,
  importOBJText,
  importSTLBuffer,
  initManifoldEngine,
  isManifoldReady,
  normalizeMeshToBed,
  paintEntireMesh,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
  planeCutWithConnectors,
  runBooleanOperation,
  splitDisconnectedParts,
  splitMeshByColor,
} from '../index';

/** Helper local para construir un SceneObject válido a partir de MeshData. */
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
    isHole: false,
    visible: true,
    locked: false,
    mesh,
    stats: computeMeshStats(mesh),
    ...overrides,
  };
}

/** Calcula los límites AABB de una malla. */
function getMeshBounds(mesh: MeshData) {
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

describe('Núcleo Geométrico Kura3D (Manifold-3D + E/S)', () => {
  it('inicializa el módulo WASM de Manifold-3D en Node.js de forma determinista', async () => {
    const wasm = await initManifoldEngine();
    expect(wasm).toBeDefined();
    expect(isManifoldReady()).toBe(true);
  });

  describe('Primitivas paramétricas watertight y cama Y=0', () => {
    it('genera todas las primitivas cerradas, centradas en XZ y apoyadas en Y=0', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 10, depth: 30 });
      const boxStats = computeMeshStats(box);
      const boxBounds = getMeshBounds(box);
      expect(boxStats.isManifold).toBe(true);
      expect(boxStats.volumeMm3).toBeCloseTo(6000, 1);
      expect(boxBounds.minY).toBeCloseTo(0, 4);
      expect((boxBounds.minX + boxBounds.maxX) / 2).toBeCloseTo(0, 4);
      expect((boxBounds.minZ + boxBounds.maxZ) / 2).toBeCloseTo(0, 4);

      const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 20, segments: 48 });
      const cylStats = computeMeshStats(cyl);
      expect(cylStats.isManifold).toBe(true);
      expect(cylStats.volumeMm3).toBeCloseTo(Math.PI * 100 * 20, -2);
      expect(getMeshBounds(cyl).minY).toBeCloseTo(0, 4);

      const tube = await createPrimitiveMesh('tube', {
        outerRadius: 12,
        innerRadius: 6,
        height: 20,
        segments: 48,
      });
      const tubeStats = computeMeshStats(tube);
      const expectedTubeVol = Math.PI * (144 - 36) * 20;
      expect(tubeStats.isManifold).toBe(true);
      expect(Math.abs(tubeStats.volumeMm3 - expectedTubeVol)).toBeLessThan(200);
      expect(getMeshBounds(tube).minY).toBeCloseTo(0, 4);

      const sphere = await createPrimitiveMesh('sphere', { radius: 10, segments: 32 });
      const sphereStats = computeMeshStats(sphere);
      expect(sphereStats.isManifold).toBe(true);
      expect(sphereStats.volumeMm3).toBeGreaterThan(3800);
      expect(getMeshBounds(sphere).minY).toBeCloseTo(0, 4);

      const cone = await createPrimitiveMesh('cone', { radius: 10, height: 24, segments: 36 });
      const coneStats = computeMeshStats(cone);
      expect(coneStats.isManifold).toBe(true);
      expect(coneStats.volumeMm3).toBeCloseTo((Math.PI * 100 * 24) / 3, -2);
      expect(getMeshBounds(cone).minY).toBeCloseTo(0, 4);

      const torus = await createPrimitiveMesh('torus', {
        outerRadius: 15,
        tubeRadius: 4,
        segments: 36,
      });
      const torusStats = computeMeshStats(torus);
      const expectedTorusVol = 2 * Math.PI * Math.PI * 15 * 16;
      expect(torusStats.isManifold).toBe(true);
      expect(torusStats.dimensionsMm[0]).toBeCloseTo(38, 0);
      expect(Math.abs(torusStats.volumeMm3 - expectedTorusVol)).toBeLessThan(350);
      expect(getMeshBounds(torus).minY).toBeCloseTo(0, 4);

      const prism = await createPrimitiveMesh('prism', { sides: 6, radius: 10, height: 15 });
      expect(computeMeshStats(prism).isManifold).toBe(true);
      expect(getMeshBounds(prism).minY).toBeCloseTo(0, 4);

      const textMesh = await createPrimitiveMesh('text', {
        text: 'KURA 3D!',
        fontSize: 14,
        height: 5,
      });
      const textStats = computeMeshStats(textMesh);
      expect(textStats.isManifold).toBe(true);
      expect(textStats.triangles).toBeGreaterThan(50);
      expect(textStats.dimensionsMm[1]).toBeCloseTo(5, 2);
      expect(getMeshBounds(textMesh).minY).toBeCloseTo(0, 4);
    });

    it('detecta correctamente mallas abiertas (no manifold) en computeMeshStats', async () => {
      const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const openBox: MeshData = {
        positions: box.positions,
        indices: box.indices.slice(0, box.indices.length - 3),
      };
      expect(computeMeshStats(openBox).isManifold).toBe(false);
    });

    it('aplica transformaciones TRS (incluida escala negativa) preservando cierre y BufferGeometry con colores', async () => {
      const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const mirrored = applyTransformToMesh(box, [5, 10, -3], [0, Math.PI / 4, 0], [-1, 2, 1]);
      const stats = computeMeshStats(mirrored);
      expect(stats.isManifold).toBe(true);
      expect(stats.volumeMm3).toBeCloseTo(2000, 1);

      const painted = paintEntireMesh(box, '#f97316');
      const geo = createBufferGeometryFromMeshData(painted);
      expect(geo.getAttribute('color')).toBeDefined();
      expect(geo.getIndex()).toBeNull();
      expect(geo.getAttribute('position').count).toBe(painted.indices.length);

      const norm = normalizeMeshToBed(mirrored);
      expect(getMeshBounds(norm).minY).toBeCloseTo(0, 4);
    });
  });

  describe('Operaciones CSG, ahuecado, corte con conectores, separación y borrado', () => {
    it('ejecuta union, subtract e intersect preservando topología watertight y colores', async () => {
      const boxA = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const boxB = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });

      const objA = makeSceneObject('A', boxA, { position: [0, 0, 0], color: '#38bdf8' });
      const objB = makeSceneObject('B', boxB, { position: [10, 0, 0], color: '#ef4444' });

      const unionRes = await runBooleanOperation(objA, objB, 'union');
      expect(computeMeshStats(unionRes.mesh).isManifold).toBe(true);
      expect(computeMeshStats(unionRes.mesh).volumeMm3).toBeCloseTo(12000, 1);
      expect(unionRes.mesh.faceColors).toBeDefined();
      expect(new Set(unionRes.mesh.faceColors).size).toBe(2);

      const subRes = await runBooleanOperation(objA, objB, 'subtract');
      expect(computeMeshStats(subRes.mesh).isManifold).toBe(true);
      expect(computeMeshStats(subRes.mesh).volumeMm3).toBeCloseTo(4000, 1);

      const interRes = await runBooleanOperation(objA, objB, 'intersect');
      expect(computeMeshStats(interRes.mesh).isManifold).toBe(true);
      expect(computeMeshStats(interRes.mesh).volumeMm3).toBeCloseTo(4000, 1);
    });

    it('ahueca modelos con grosor controlado y orificio de drenaje opcional', async () => {
      const box = await createPrimitiveMesh('box', { width: 30, height: 30, depth: 30 });
      const obj = makeSceneObject('cube', box);

      const hollowed = await hollowMesh(obj, {
        enabled: true,
        wallThickness: 3,
        drainHole: false,
      });
      const hStats = computeMeshStats(hollowed);
      expect(hStats.isManifold).toBe(true);
      // 30^3 - 24^3 = 27000 - 13824 = 13176 mm³
      expect(hStats.volumeMm3).toBeCloseTo(13176, 0);

      const withDrain = await hollowMesh(obj, {
        enabled: true,
        wallThickness: 3,
        drainHole: true,
        drainHoleRadius: 4,
      });
      const dStats = computeMeshStats(withDrain);
      expect(dStats.isManifold).toBe(true);
      expect(dStats.volumeMm3).toBeLessThan(hStats.volumeMm3);
    });

    it('divide modelos por plano con conectores dowel, peg y dovetail', async () => {
      const box = await createPrimitiveMesh('box', { width: 40, height: 40, depth: 40 });
      const obj = makeSceneObject('cuttable', box);

      for (const connectorType of ['none', 'dowel', 'peg', 'dovetail'] as const) {
        const res = await planeCutWithConnectors(obj, {
          axis: 'y',
          offset: 0,
          connectorType,
          connectorSize: 3,
          connectorDepth: 6,
          tolerance: 0.25,
          connectorCount: 2,
          keepMode: 'both',
        });

        expect(res.positive).not.toBeNull();
        expect(res.negative).not.toBeNull();
        const posStats = computeMeshStats(res.positive!.mesh);
        const negStats = computeMeshStats(res.negative!.mesh);
        expect(posStats.isManifold).toBe(true);
        expect(negStats.isManifold).toBe(true);

        if (connectorType === 'none') {
          expect(posStats.volumeMm3).toBeCloseTo(32000, 1);
          expect(negStats.volumeMm3).toBeCloseTo(32000, 1);
        } else {
          // La mitad negativa recibe pines macho (>32000) y la positiva huecos hembra (<32000)
          expect(negStats.volumeMm3).toBeGreaterThan(32000);
          expect(posStats.volumeMm3).toBeLessThan(32000);
        }
      }

      // Prueba adicional en ejes X y Z con 1, 3 y 4 conectores y keepMode selectivo
      const cutX = await planeCutWithConnectors(obj, {
        axis: 'x',
        offset: 4,
        connectorType: 'dowel',
        connectorSize: 2.5,
        connectorDepth: 5,
        tolerance: 0.25,
        connectorCount: 4,
        keepMode: 'positive',
      });
      expect(cutX.positive).not.toBeNull();
      expect(cutX.negative).toBeNull();
      expect(computeMeshStats(cutX.positive!.mesh).isManifold).toBe(true);

      const cutZ = await planeCutWithConnectors(obj, {
        axis: 'z',
        offset: -2,
        connectorType: 'peg',
        connectorSize: 2.5,
        connectorDepth: 5,
        tolerance: 0.25,
        connectorCount: 3,
        keepMode: 'negative',
      });
      expect(cutZ.positive).toBeNull();
      expect(cutZ.negative).not.toBeNull();
      expect(computeMeshStats(cutZ.negative!.mesh).isManifold).toBe(true);
    });

    it('separa islas desconectadas con decompose() y separa regiones por color', async () => {
      const boxA = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const boxB = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const objA = makeSceneObject('A', boxA, { position: [-20, 0, 0], color: '#38bdf8' });
      const objB = makeSceneObject('B', boxB, { position: [20, 0, 0], color: '#22c55e' });

      const merged = await runBooleanOperation(objA, objB, 'union');
      const mergedObj = makeSceneObject('merged', merged.mesh, { position: merged.position });

      const parts = await splitDisconnectedParts(mergedObj);
      expect(parts).toHaveLength(2);
      expect(computeMeshStats(parts[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(parts[1].mesh).isManifold).toBe(true);

      const byColor = splitMeshByColor(mergedObj);
      expect(byColor).toHaveLength(2);
      const colors = byColor.map((p) => p.color).sort();
      expect(colors).toEqual(['#22c55e', '#38bdf8']);
    });

    it('borra una región esférica manteniendo el sólido watertight', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const obj = makeSceneObject('target', box);
      const erased = await eraseRegionWithSphere(obj, [10, 10, 0], 5);
      const stats = computeMeshStats(erased.mesh);
      expect(stats.isManifold).toBe(true);
      expect(stats.volumeMm3).toBeLessThan(8000);
      expect(stats.volumeMm3).toBeGreaterThan(7000);
    });
  });

  describe('Geometría avanzada: SVG, Relieve desde imagen, Texturas y Pintado inteligente', () => {
    it('extruye SVG con contornos compuestos (anillo con agujero, rect y polygon)', async () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <path d="M 10 10 H 90 V 90 H 10 Z M 30 30 H 70 V 70 H 30 Z" />
          <path d="M 100 20 C 120 20 120 48 106 54 Q 118 72 108 86 A 8 8 0 0 1 96 86 L 96 20 Z" />
          <rect x="2" y="2" width="12" height="12" />
          <ellipse cx="60" cy="105" rx="10" ry="5" />
          <polygon points="15,100 30,100 22,115" />
          <circle cx="50" cy="50" r="8" />
        </svg>
      `;
      const mesh = await extrudeSvgToMesh({
        svgContent: svg,
        name: 'LogoTest',
        depth: 6,
        targetWidth: 40,
        curveSegments: 12,
      });
      const stats = computeMeshStats(mesh);
      expect(stats.isManifold).toBe(true);
      expect(stats.dimensionsMm[0]).toBeCloseTo(40, 1);
      expect(stats.dimensionsMm[1]).toBeCloseTo(6, 1);
      expect(getMeshBounds(mesh).minY).toBeCloseTo(0, 4);
    });

    it('genera relieves y litofanías 100% cerradas (watertight) desde buffer RGBA', () => {
      const w = 16;
      const h = 16;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const v = Math.round(((x + y) / (w + h - 2)) * 255);
          rgba[idx] = v;
          rgba[idx + 1] = v;
          rgba[idx + 2] = v;
          rgba[idx + 3] = 255;
        }
      }

      const relief = generateReliefFromImage({
        name: 'Relieve',
        rgba,
        pixelWidth: w,
        pixelHeight: h,
        widthMm: 60,
        depthMm: 60,
        baseThicknessMm: 2,
        reliefHeightMm: 4,
        invert: false,
        smoothing: 1,
      });
      const stats = computeMeshStats(relief);
      expect(stats.isManifold).toBe(true);
      expect(stats.dimensionsMm[0]).toBeCloseTo(60, 3);
      expect(stats.dimensionsMm[2]).toBeCloseTo(60, 3);
      expect(getMeshBounds(relief).minY).toBeCloseTo(0, 4);

      const litho = generateReliefFromImage({
        name: 'Litofania',
        rgba,
        pixelWidth: w,
        pixelHeight: h,
        widthMm: 50,
        depthMm: 50,
        baseThicknessMm: 1.5,
        reliefHeightMm: 3,
        invert: true,
        smoothing: 0,
      });
      expect(computeMeshStats(litho).isManifold).toBe(true);
    });

    it('aplica texturas procedurales deterministas manteniendo cierre watertight', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      for (const pattern of ['fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'] as const) {
        const textured = applyProceduralTexture(box, {
          pattern,
          depth: 0.4,
          scale: 4,
        });
        const stats = computeMeshStats(textured);
        expect(stats.isManifold).toBe(true);
        expect(stats.triangles).toBeGreaterThan(box.indices.length / 3);
        expect(getMeshBounds(textured).minY).toBeCloseTo(0, 4);
      }
    });

    it('soporta pintado esférico y smart flood-fill detenido por aristas de 90°', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const obj = makeSceneObject('paintBox', box);

      const spherePainted = paintMeshFacesInSphere(obj, [0, 20, 0], 12, '#ef4444');
      expect(spherePainted.faceColors).toBeDefined();
      expect(spherePainted.faceColors!.some((c) => c === '#ef4444')).toBe(true);

      // Brocha pequeña tocando la cara superior lejos del centroide debe pintar igualmente
      const smallBrushPainted = paintMeshFacesInSphere(obj, [8, 20, 8], 1, '#a855f7');
      expect(smallBrushPainted.faceColors!.some((c) => c === '#a855f7')).toBe(true);

      // En un cubo (12 triángulos), flood-fill con umbral 30° desde una cara debe pintar
      // exactamente los 2 triángulos coplanares de esa cara y detenerse en los bordes de 90°
      const floodPainted = paintFloodFillConnectedFaces(box, 0, '#22c55e', 30);
      const paintedCount = floodPainted.faceColors!.filter((c) => c === '#22c55e').length;
      expect(paintedCount).toBe(2);
    });
  });

  describe('Importación y exportación STL, OBJ y 3MF multicolor', () => {
    it('realiza round-trip completo de STL binario (Y-up <-> Z-up) y escena filtrada', async () => {
      const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 25, segments: 32 });
      const stlBytes = exportMeshToBinarySTL(cyl);
      expect(stlBytes.byteLength).toBe(84 + (cyl.indices.length / 3) * 50);

      const imported = importSTLBuffer(stlBytes.buffer as ArrayBuffer);
      const stats = computeMeshStats(imported);
      expect(stats.isManifold).toBe(true);
      expect(stats.dimensionsMm[1]).toBeCloseTo(25, 2);
      expect(stats.volumeMm3).toBeCloseTo(computeMeshStats(cyl).volumeMm3, 0);

      // Escena: debe omitir objetos ocultos o huecos (isHole)
      const box = await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 });
      const sceneStl = exportSceneToBinarySTL([
        makeSceneObject('solid', box),
        makeSceneObject('hole', box, { isHole: true }),
        makeSceneObject('hidden', box, { visible: false }),
      ]);
      expect(sceneStl.byteLength).toBe(84 + (box.indices.length / 3) * 50);
    });

    it('realiza round-trip de Wavefront OBJ', async () => {
      const prism = await createPrimitiveMesh('prism', { sides: 5, radius: 12, height: 18 });
      const objText = exportMeshToOBJ(prism, 'Pentagono');
      expect(objText).toContain('o Pentagono');

      const imported = importOBJText(objText);
      const stats = computeMeshStats(imported);
      expect(stats.isManifold).toBe(true);
      expect(stats.dimensionsMm[1]).toBeCloseTo(18, 2);

      // Prueba de importación OBJ con quads e índices negativos relativos
      const quadCubeObj = [
        'v 0 0 0', 'v 10 0 0', 'v 10 10 0', 'v 0 10 0',
        'v 0 0 10', 'v 10 0 10', 'v 10 10 10', 'v 0 10 10',
        'f 1 4 3 2', 'f 5 6 7 8',
        'f 1 2 6 5', 'f 2 3 7 6',
        'f 3 4 8 7', 'f -8 -4 -1 -5',
      ].join('\n');
      const quadMesh = importOBJText(quadCubeObj);
      const quadStats = computeMeshStats(quadMesh);
      expect(quadStats.isManifold).toBe(true);
      expect(quadStats.volumeMm3).toBeCloseTo(1000, 1);

      // Prueba de importación STL ASCII (tetraedro cerrado en Z-up)
      const asciiStl = `solid tetra
        facet normal 0 0 -1
          outer loop
            vertex 0 0 0
            vertex 10 0 0
            vertex 0 10 0
          endloop
        endfacet
        facet normal 0 -1 0
          outer loop
            vertex 0 0 0
            vertex 0 0 10
            vertex 10 0 0
          endloop
        endfacet
        facet normal -1 0 0
          outer loop
            vertex 0 0 0
            vertex 0 10 0
            vertex 0 0 10
          endloop
        endfacet
        facet normal 0.577 0.577 0.577
          outer loop
            vertex 10 0 0
            vertex 0 0 10
            vertex 0 10 0
          endloop
        endfacet
      endsolid tetra`;
      const asciiBuffer = new TextEncoder().encode(asciiStl).buffer;
      const tetraMesh = importSTLBuffer(asciiBuffer);
      expect(computeMeshStats(tetraMesh).isManifold).toBe(true);
      expect(computeMeshStats(tetraMesh).volumeMm3).toBeCloseTo(1000 / 6, 1);
    });

    it('realiza round-trip completo de 3MF ZIP multicolor con <basematerials> y faceColors', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const paintedBox = paintFloodFillConnectedFaces(box, 0, '#f97316', 30);
      const obj1 = makeSceneObject('CuboMulticolor', paintedBox, {
        color: '#38bdf8',
        position: [0, 0, 0],
      });
      const cone = await createPrimitiveMesh('cone', { radius: 8, height: 16 });
      const obj2 = makeSceneObject('ConoVerde', cone, {
        color: '#22c55e',
        position: [30, 0, 0],
      });

      const mf3Bytes = exportSceneTo3MF([obj1, obj2], 'mm');
      const zipEntries = unzipSync(mf3Bytes);
      expect(zipEntries['[Content_Types].xml']).toBeDefined();
      expect(zipEntries['_rels/.rels']).toBeDefined();
      expect(zipEntries['3D/3dmodel.model']).toBeDefined();

      const importedParts = import3MFBuffer(mf3Bytes.buffer as ArrayBuffer);
      expect(importedParts).toHaveLength(2);
      expect(importedParts[0].name).toBe('CuboMulticolor');
      expect(importedParts[0].mesh.faceColors).toBeDefined();
      expect(new Set(importedParts[0].mesh.faceColors).size).toBe(2);
      expect(computeMeshStats(importedParts[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(importedParts[1].mesh).isManifold).toBe(true);
      expect(importedParts[1].color).toBe('#22c55e');
    });
  });
});
