/**
 * @file src/__tests__/v4.e2e.test.ts
 * @description Suite integral de evaluación funcional End-to-End (E2E) para Kura3D v4.0 Ultra Pro.
 * Verifica de punta a punta el store central Zustand (`useKuraStore`), el núcleo geométrico
 * Manifold-3D WASM y el Command Bus unificado a través de las 9 áreas funcionales v3.0 & v4.0:
 *   1. Módulos dinámicos (+ / −) e importación STL modular + aplicación booleana de huecos.
 *   2. Generador automático de moldes (4 modos) con verificación watertight y apoyo Y >= 0.
 *   3. Proyección conformal de texto sobre cilindro curvo (`emboss`, `deboss`, `flush_inlay`).
 *   4. Validador estructural de imprimibilidad, simplificación, refinamiento y Convex Hull.
 *   5. Roscas métricas ISO (bolt/nut/hole), litofanía cilíndrica y cortador de galletas desde imagen.
 *   6. Alineación inteligente (`minX`) y distribución automática en cama (`arrange_grid`).
 *   7. Detección y segmentación estructural determinística sobre modelo compuesto "Buzo/Diver".
 *   8. Interacciones CAD Pro en store (mirror, nudge, proportionalScale, altClone, materiales, densidad UI)
 *      y Command Bus v4.0 (`detect_structures`, `colorize_structures`, `extract_structure`, `mirror_object`).
 *   9. Exportación 3MF Multi-Slicer Pro (Bambu, Elegoo, Snapmaker, FlashForge) con `Metadata/model_settings.config`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTransformToMesh,
  computeMeshStats,
  createPrimitiveMesh,
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  import3MFBuffer,
  initManifoldEngine,
} from '../engine';
import { useKuraStore } from '../store/useKuraStore';
import type { MeshData, SceneObject } from '../types/kura';

/** Calcula la caja envolvente (AABB) de una malla en espacio local o mundial. */
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

/** Calcula la caja envolvente mundial de un `SceneObject` considerando su transformación. */
function getWorldBounds(obj: SceneObject) {
  const worldMesh = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  return getMeshBounds(worldMesh);
}

/** Genera un buffer RGBA sintético con un círculo blanco brillante sobre fondo negro. */
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

/** Reinicia el store Zustand a un estado limpio y determinista antes de cada prueba. */
async function resetCleanStore() {
  await initManifoldEngine();
  useKuraStore.setState({
    engineReady: true,
    engineError: null,
    busyOperation: null,
    objects: [],
    selectedIds: [],
    past: [],
    future: [],
    uiDensity: 'full',
    lastNonZenDensity: 'full',
    proportionalScale: true,
    unitSystem: 'mm',
    language: 'es',
    activePrintReport: null,
    showOverhangs: false,
    activeSegmentation: null,
    segmentationCreaseDeg: 28,
    toasts: [],
  });
}

describe('Kura3D v4.0 Ultra Pro — Evaluación Funcional End-to-End (Store + Engine + Command Bus)', () => {
  beforeEach(async () => {
    await resetCleanStore();
  });

  // ==========================================================================
  // ÁREA 1: Módulos dinámicos (+ / −), importación STL modular y applyHolesOnSolids
  // ==========================================================================
  describe('1. Módulos dinámicos (+ / −) + Importación STL modular -> applyHolesOnSolids()', () => {
    it('agrega primitivas modulares positivas/negativas, importa STL como módulo y aplica huecos watertight', async () => {
      const store = useKuraStore.getState();

      // Creamos un bloque base sólido de 30 × 30 × 30 mm (27 000 mm³)
      const base = await store.createPrimitive('box', { width: 30, height: 30, depth: 30 });
      expect(base).not.toBeNull();
      const baseVol = base!.stats.volumeMm3;
      expect(baseVol).toBeCloseTo(27000, -1);

      // Agregamos un módulo positivo (+) desplazado hacia arriba y lo unimos al sólido base
      const posMod = await useKuraStore
        .getState()
        .addModularPrimitive('cylinder', 'positive', base!.id);
      expect(posMod).not.toBeNull();
      expect(posMod!.isHole).toBe(false);
      expect(posMod!.name.startsWith('+')).toBe(true);
      expect(posMod!.stats.isManifold).toBe(true);

      const fusedPositive = await useKuraStore
        .getState()
        .runBooleanOnSelection('union', base!.id, posMod!.id);
      expect(fusedPositive).not.toBeNull();
      expect(fusedPositive!.stats.isManifold).toBe(true);
      expect(fusedPositive!.stats.volumeMm3).toBeGreaterThan(baseVol);
      const volumeBeforeHoles = fusedPositive!.stats.volumeMm3;

      // Agregamos un módulo negativo (−) mediante primitiva modular
      const negMod = await useKuraStore
        .getState()
        .addModularPrimitive('cylinder', 'negative', fusedPositive!.id);
      expect(negMod).not.toBeNull();
      expect(negMod!.isHole).toBe(true);
      expect(negMod!.name.startsWith('−')).toBe(true);

      // Generamos un STL binario real y lo importamos como módulo positivo y como módulo negativo
      const rawPeg = await createPrimitiveMesh('box', { width: 8, height: 22, depth: 8 });
      const pegObj: SceneObject = {
        id: 'tmp_peg',
        name: 'Peg',
        source: 'primitive',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#38bdf8',
        isHole: false,
        visible: true,
        locked: false,
        mesh: rawPeg,
        stats: computeMeshStats(rawPeg),
      };
      const stlBytes = exportSceneToBinarySTL([pegObj]);
      const stlArrayBuffer = stlBytes.buffer.slice(
        stlBytes.byteOffset,
        stlBytes.byteOffset + stlBytes.byteLength
      ) as ArrayBuffer;

      const importedPos = await useKuraStore
        .getState()
        .importModelAsModule({ name: 'anclaje.stl', buffer: stlArrayBuffer }, 'positive', fusedPositive!.id);
      expect(importedPos).not.toBeNull();
      expect(importedPos!.isHole).toBe(false);
      expect(importedPos!.name.startsWith('+')).toBe(true);
      expect(importedPos!.stats.isManifold).toBe(true);

      // Unimos el módulo STL positivo importado al sólido compuesto antes de aplicar los huecos
      const fusedWithStl = await useKuraStore
        .getState()
        .runBooleanOnSelection('union', fusedPositive!.id, importedPos!.id);
      expect(fusedWithStl).not.toBeNull();
      expect(fusedWithStl!.stats.isManifold).toBe(true);

      // Desplazamos el segundo módulo STL negativo a X = +8 para perforar una zona distinta
      const importedNeg = await useKuraStore
        .getState()
        .importModelAsModule({ name: 'calado.stl', buffer: stlArrayBuffer }, 'negative', fusedWithStl!.id);
      expect(importedNeg).not.toBeNull();
      expect(importedNeg!.isHole).toBe(true);
      expect(importedNeg!.name.startsWith('−')).toBe(true);
      useKuraStore.getState().setObjectTransform(importedNeg!.id, {
        position: [8, importedNeg!.position[1], 0],
      });

      // Ejecutamos applyHolesOnSolids() sobre toda la escena (selección limpia para abarcar sólidos y huecos)
      useKuraStore.getState().clearSelection();
      await useKuraStore.getState().applyHolesOnSolids();

      const afterObjects = useKuraStore.getState().objects;
      expect(afterObjects.some((o) => o.isHole)).toBe(false);

      const updatedSolid = afterObjects.find((o) => o.id === fusedWithStl!.id);
      expect(updatedSolid).toBeDefined();
      expect(updatedSolid!.stats.isManifold).toBe(true);
      expect(updatedSolid!.stats.volumeMm3).toBeLessThan(volumeBeforeHoles);
    });
  });

  // ==========================================================================
  // ÁREA 2: Generador automático de moldes (todos los 4 modos)
  // ==========================================================================
  describe('2. Generador automático de moldes (direct_1part, direct_2part, silicone_master, core_cavity)', () => {
    it('genera piezas watertight y apoyadas sobre la cama (position[1] >= 0) en los 4 modos', async () => {
      const master = await useKuraStore
        .getState()
        .createPrimitive('cylinder', { radius: 10, height: 20, segments: 24 });
      expect(master).not.toBeNull();

      // 1) direct_1part
      const mode1 = await useKuraStore.getState().generateMoldForObject(master!.id, {
        mode: 'direct_1part',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: true,
        pourSpoutRadiusMm: 4,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(mode1).toHaveLength(1);
      for (const part of mode1) {
        expect(part.source).toBe('mold');
        expect(part.stats.isManifold).toBe(true);
        expect(part.position[1]).toBeGreaterThanOrEqual(0);
        expect(getWorldBounds(part).minY).toBeGreaterThanOrEqual(-1e-3);
      }

      // 2) direct_2part
      const mode2 = await useKuraStore.getState().generateMoldForObject(master!.id, {
        mode: 'direct_2part',
        wallMarginMm: 6,
        boxWallMm: 3,
        splitAxis: 'z',
        pourSpout: true,
        pourSpoutRadiusMm: 4,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(mode2).toHaveLength(2);
      for (const part of mode2) {
        expect(part.source).toBe('mold');
        expect(part.stats.isManifold).toBe(true);
        expect(part.position[1]).toBeGreaterThanOrEqual(0);
        expect(getWorldBounds(part).minY).toBeGreaterThanOrEqual(-1e-3);
      }

      // 3) silicone_master
      const mode3 = await useKuraStore.getState().generateMoldForObject(master!.id, {
        mode: 'silicone_master',
        wallMarginMm: 6,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: false,
        pourSpoutRadiusMm: 4,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(mode3).toHaveLength(2);
      for (const part of mode3) {
        expect(part.source).toBe('mold');
        expect(part.stats.isManifold).toBe(true);
        expect(part.position[1]).toBeGreaterThanOrEqual(0);
        expect(getWorldBounds(part).minY).toBeGreaterThanOrEqual(-1e-3);
      }

      // 4) core_cavity
      const mode4 = await useKuraStore.getState().generateMoldForObject(master!.id, {
        mode: 'core_cavity',
        wallMarginMm: 5,
        boxWallMm: 3,
        splitAxis: 'x',
        pourSpout: false,
        pourSpoutRadiusMm: 4,
        keyToleranceMm: 0.25,
        cavityWallMm: 3,
      });
      expect(mode4).toHaveLength(2);
      for (const part of mode4) {
        expect(part.source).toBe('mold');
        expect(part.stats.isManifold).toBe(true);
        expect(part.position[1]).toBeGreaterThanOrEqual(0);
        expect(getWorldBounds(part).minY).toBeGreaterThanOrEqual(-1e-3);
      }
    });
  });

  // ==========================================================================
  // ÁREA 3: Proyección conformal de Texto sobre cilindro curvo (axis: 'cylindrical')
  // ==========================================================================
  describe('3. Proyección conformal de Texto sobre cilindro curvo (emboss, deboss, flush_inlay)', () => {
    it('proyecta texto sobre cilindro en los 3 modos conservando cierre watertight y colores multicolor', async () => {
      // Cilindro base de radio 20 mm y altura 40 mm
      const cylEmboss = await useKuraStore.getState().createPrimitive(
        'cylinder',
        { radius: 20, height: 40, segments: 48 },
        { name: 'CilindroEmboss', color: '#38bdf8' }
      );
      expect(cylEmboss).not.toBeNull();
      const baseVol = cylEmboss!.stats.volumeMm3;

      // Modo 1: emboss cilíndrico con texto
      const embossed = await useKuraStore.getState().projectOnObjectSurface(cylEmboss!.id, {
        kind: 'text',
        text: 'KURA',
        mode: 'emboss',
        axis: 'cylindrical',
        widthMm: 22,
        depthMm: 1.5,
        colorHex: '#f97316',
      });
      expect(embossed).not.toBeNull();
      expect(embossed!.source).toBe('projected');
      expect(embossed!.stats.isManifold).toBe(true);
      expect(embossed!.stats.volumeMm3).toBeGreaterThan(baseVol);
      expect(embossed!.mesh.faceColors).toBeDefined();
      expect(embossed!.mesh.faceColors!.includes('#f97316')).toBe(true);
      expect(embossed!.mesh.faceColors!.includes('#38bdf8')).toBe(true);

      // Modo 2: deboss cilíndrico con texto sobre cilindro fresco
      const cylDeboss = await useKuraStore.getState().createPrimitive(
        'cylinder',
        { radius: 20, height: 40, segments: 48 },
        { name: 'CilindroDeboss', color: '#38bdf8', position: [60, 0, 0] }
      );
      const debossed = await useKuraStore.getState().projectOnObjectSurface(cylDeboss!.id, {
        kind: 'text',
        text: 'PRO',
        mode: 'deboss',
        axis: 'cylindrical',
        widthMm: 20,
        depthMm: 1.4,
        colorHex: '#ef4444',
      });
      expect(debossed).not.toBeNull();
      expect(debossed!.stats.isManifold).toBe(true);
      expect(debossed!.stats.volumeMm3).toBeLessThan(baseVol);
      expect(debossed!.mesh.faceColors).toBeDefined();
      expect(debossed!.mesh.faceColors!.includes('#38bdf8')).toBe(true);

      // Modo 3: flush_inlay cilíndrico multicolor con texto (mantiene volumen ~igual y conserva ambos colores)
      const cylInlay = await useKuraStore.getState().createPrimitive(
        'cylinder',
        { radius: 20, height: 40, segments: 48 },
        { name: 'CilindroInlay', color: '#38bdf8', position: [-60, 0, 0] }
      );
      const inlay = await useKuraStore.getState().projectOnObjectSurface(cylInlay!.id, {
        kind: 'text',
        text: 'V4',
        mode: 'flush_inlay',
        axis: 'cylindrical',
        widthMm: 18,
        depthMm: 0.9,
        colorHex: '#22c55e',
      });
      expect(inlay).not.toBeNull();
      expect(inlay!.stats.isManifold).toBe(true);
      expect(inlay!.stats.volumeMm3).toBeCloseTo(baseVol, -2);
      expect(inlay!.mesh.faceColors).toBeDefined();
      expect(inlay!.mesh.faceColors!.includes('#22c55e')).toBe(true);
      expect(inlay!.mesh.faceColors!.includes('#38bdf8')).toBe(true);
    });
  });

  // ==========================================================================
  // ÁREA 4: Validador de imprimibilidad + Simplify + Refine + Convex Hull
  // ==========================================================================
  describe('4. Validador estructural, simplificación, refinamiento y Convex Hull', () => {
    it('evalúa peso, filamento, puntaje y voladizos; ejecuta simplify, refine y convex hull watertight', async () => {
      // Creamos un cono y lo invertimos 180° en X apoyado en la punta en Y=0 para provocar voladizos críticos
      const cone = await useKuraStore
        .getState()
        .createPrimitive('cone', { radius: 24, height: 20, segments: 24 });
      expect(cone).not.toBeNull();
      useKuraStore.getState().setObjectTransform(
        cone!.id,
        {
          position: [0, 20, 0],
          rotation: [Math.PI, 0, 0],
        },
        true
      );

      const report = useKuraStore.getState().runPrintabilityCheck(cone!.id, 20, 45);
      expect(report).not.toBeNull();
      expect(report!.isManifold).toBe(true);
      expect(report!.estimatedWeightGrams).toBeGreaterThan(0);
      expect(report!.estimatedFilamentMeters).toBeGreaterThan(0);
      expect(report!.overhangFaceCount).toBeGreaterThan(10);
      expect(report!.overhangFaceIndices.length).toBe(report!.overhangFaceCount);
      expect(report!.score).toBeGreaterThan(0);
      expect(report!.score).toBeLessThan(100);
      expect(useKuraStore.getState().activePrintReport?.objectId).toBe(cone!.id);
      expect(useKuraStore.getState().showOverhangs).toBe(true);

      // Simplificación de malla sobre una esfera de alta resolución
      const sphere = await useKuraStore
        .getState()
        .createPrimitive('sphere', { radius: 15, segments: 32 });
      expect(sphere).not.toBeNull();
      const origSphereTris = sphere!.stats.triangles;

      const simpOk = await useKuraStore.getState().simplifySelectedMesh(sphere!.id, 0.8);
      expect(simpOk).toBe(true);
      const simpObj = useKuraStore.getState().objects.find((o) => o.id === sphere!.id)!;
      expect(simpObj.stats.isManifold).toBe(true);
      expect(simpObj.stats.triangles).toBeLessThan(origSphereTris);

      // Refinamiento de malla sobre un cubo de 12 triángulos
      const box = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 20, height: 20, depth: 20 });
      expect(box).not.toBeNull();
      expect(box!.stats.triangles).toBe(12);

      const refOk = await useKuraStore.getState().refineSelectedMesh(box!.id, 4.0, true);
      expect(refOk).toBe(true);
      const refObj = useKuraStore.getState().objects.find((o) => o.id === box!.id)!;
      expect(refObj.stats.isManifold).toBe(true);
      expect(refObj.stats.triangles).toBeGreaterThan(12);

      // Convex Hull envolvente entre dos cubos separados 40 mm
      const b1 = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [-20, 0, 0] });
      const b2 = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [20, 0, 0] });
      const hull = await useKuraStore.getState().runConvexHull([b1!.id, b2!.id]);
      expect(hull).not.toBeNull();
      expect(hull!.source).toBe('hull');
      expect(hull!.stats.isManifold).toBe(true);
      expect(hull!.stats.dimensionsMm[0]).toBeCloseTo(60, 1);
      expect(hull!.stats.volumeMm3).toBeCloseTo(24000, -1);
    });
  });

  // ==========================================================================
  // ÁREA 5: Roscas ISO + Litofanía cilíndrica + Cortador de galletas desde imagen
  // ==========================================================================
  describe('5. Roscas métricas ISO (bolt/nut/hole), litofanía cilíndrica y cortador desde imagen', () => {
    it('genera perno, tuerca y macho de rosca con desplazamiento de spawn, litofanía curva y cortador', async () => {
      const bolt = await useKuraStore.getState().createThreadObject({
        kind: 'bolt',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 16,
        clearanceMm: 0.25,
        includeHead: true,
      });
      expect(bolt).not.toBeNull();
      expect(bolt!.source).toBe('thread');
      expect(bolt!.isHole).toBe(false);
      expect(bolt!.stats.isManifold).toBe(true);
      expect(bolt!.position[0]).toBe(0);

      // El segundo elemento debe aparecer desplazado en X para no superponerse con el perno
      const nut = await useKuraStore.getState().createThreadObject({
        kind: 'nut',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 6.5,
        clearanceMm: 0.25,
      });
      expect(nut).not.toBeNull();
      expect(nut!.isHole).toBe(false);
      expect(nut!.stats.isManifold).toBe(true);
      expect(nut!.position[0]).toBeGreaterThan(0);

      const holeTap = await useKuraStore.getState().createThreadObject({
        kind: 'hole',
        diameterMm: 8,
        pitchMm: 1.25,
        lengthMm: 12,
        clearanceMm: 0.3,
      });
      expect(holeTap).not.toBeNull();
      expect(holeTap!.isHole).toBe(true);
      expect(holeTap!.stats.isManifold).toBe(true);
      expect(holeTap!.position[0]).toBeGreaterThan(nut!.position[0]);

      // Litofanía cilíndrica (arco de 180°) vía generateImageRelief
      const rgba = makeCircleRgba(24);
      const cylLitho = await useKuraStore.getState().generateImageRelief({
        name: 'LitofaniaCurva',
        rgba,
        pixelWidth: 24,
        pixelHeight: 24,
        widthMm: 80,
        depthMm: 45,
        baseThicknessMm: 1.2,
        reliefHeightMm: 2.0,
        invert: true,
        smoothing: 1,
        shapeMode: 'cylindrical',
        cylinderRadiusMm: 25,
        arcDegrees: 180,
      });
      expect(cylLitho).not.toBeNull();
      expect(cylLitho!.source).toBe('image');
      expect(cylLitho!.stats.isManifold).toBe(true);
      expect(cylLitho!.stats.dimensionsMm[1]).toBeCloseTo(45, 2);

      // Cortador de galletas desde imagen vía generateImageRelief
      const cutter = await useKuraStore.getState().generateImageRelief({
        name: 'CortadorGalleta',
        rgba: makeCircleRgba(32),
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
      expect(cutter).not.toBeNull();
      expect(cutter!.source).toBe('image');
      expect(cutter!.stats.isManifold).toBe(true);
      expect(cutter!.stats.dimensionsMm[1]).toBeCloseTo(12, 2);
    });
  });

  // ==========================================================================
  // ÁREA 6: Alineación inteligente y distribución en grilla sobre la cama
  // ==========================================================================
  describe('6. Alineación inteligente (minX) y distribución en grilla (arrange_grid)', () => {
    it('alinea objetos seleccionados al borde minX y los distribuye en grilla sin solapamientos en Y=0', async () => {
      const o1 = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 12, height: 12, depth: 12 }, { position: [-25, 10, 5] });
      const o2 = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 28, height: 20, depth: 24 }, { position: [30, 0, -15] });
      const o3 = await useKuraStore
        .getState()
        .createPrimitive('cylinder', { radius: 8, height: 18, segments: 24 }, { position: [10, 4, 20] });

      useKuraStore.getState().selectAll();
      useKuraStore.getState().alignSelectedObjects('minX');

      const alignedObjs = useKuraStore.getState().objects;
      const minXs = alignedObjs.map((o) => getWorldBounds(o).minX);
      expect(minXs[0]).toBeCloseTo(minXs[1], 3);
      expect(minXs[1]).toBeCloseTo(minXs[2], 3);

      // Ahora distribuimos en grilla sobre la cama
      useKuraStore.getState().alignSelectedObjects('arrange_grid');
      const gridBounds = useKuraStore.getState().objects.map((o) => getWorldBounds(o));

      for (const b of gridBounds) {
        expect(b.minY).toBeCloseTo(0, 3);
      }

      // Comprobamos que ningún par de cajas en XZ se solapa
      for (let i = 0; i < gridBounds.length; i++) {
        for (let j = i + 1; j < gridBounds.length; j++) {
          const a = gridBounds[i];
          const b = gridBounds[j];
          const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
          const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
          expect(overlapX > 0 && overlapZ > 0).toBe(false);
        }
      }

      expect(o1 && o2 && o3).toBeTruthy();
    });
  });

  // ==========================================================================
  // ÁREA 7: Detección y segmentación estructural determinística (Modelo "Buzo/Diver")
  // ==========================================================================
  describe('7. Detección estructural y segmentación determinística sobre modelo compuesto "Diver"', () => {
    /** Construye el modelo compuesto Buzo/Diver en el store mediante uniones CSG secuenciales. */
    async function createCompositeDiverInStore(): Promise<SceneObject> {
      const store = useKuraStore.getState();

      // Torso: caja 24 × 34 × 16 mm en Y = 0..34
      await store.createPrimitive(
        'box',
        { width: 24, height: 34, depth: 16 },
        { name: 'Torso', position: [0, 0, 0] }
      );
      // Casco/escafandra esférica r = 10 mm superpuesta arriba (Y = 28..48)
      await store.createPrimitive(
        'sphere',
        { radius: 10, segments: 32 },
        { name: 'Casco', position: [0, 28, 0] }
      );
      // Tanque trasero izquierdo r = 5 mm, h = 24 mm en X = -6, Z = -11
      await store.createPrimitive(
        'cylinder',
        { radius: 5, height: 24, segments: 28 },
        { name: 'TanqueIzq', position: [-6, 5, -11] }
      );
      // Tanque trasero derecho r = 5 mm, h = 24 mm en X = +6, Z = -11
      await store.createPrimitive(
        'cylinder',
        { radius: 5, height: 24, segments: 28 },
        { name: 'TanqueDer', position: [6, 5, -11] }
      );
      // Tubo respirador lateral r = 2 mm, h = 22 mm en X = 13
      await store.createPrimitive(
        'cylinder',
        { radius: 2, height: 22, segments: 24 },
        { name: 'Tubo', position: [13, 10, 0] }
      );

      useKuraStore.getState().selectAll();
      const diver = await useKuraStore.getState().runBooleanOnSelection('union');
      expect(diver).not.toBeNull();
      expect(diver!.stats.isManifold).toBe(true);
      return diver!;
    }

    it('detecta >= 4 regiones, colorea, extrae una sub-estructura y separa todas las partes', async () => {
      const diver = await createCompositeDiverInStore();

      const seg = await useKuraStore.getState().detectObjectStructures(diver.id);
      expect(seg).not.toBeNull();
      expect(seg!.regions.length).toBeGreaterThanOrEqual(4);
      expect(useKuraStore.getState().activeSegmentation?.objectId).toBe(diver.id);

      // Coloreado automático de las regiones detectadas
      const coloredOk = await useKuraStore.getState().colorizeDetectedStructures(diver.id);
      expect(coloredOk).toBe(true);

      const coloredDiver = useKuraStore.getState().objects.find((o) => o.id === diver.id)!;
      expect(coloredDiver.mesh.faceColors).toBeDefined();
      const distinctColors = new Set(coloredDiver.mesh.faceColors);
      expect(distinctColors.size).toBe(seg!.regions.length);

      // Extracción individual de una región (sin eliminar del modelo fuente)
      const targetRegion =
        seg!.regions.find((r) => r.archetype === 'tank_cylinder') ?? seg!.regions[1];
      const extracted = await useKuraStore
        .getState()
        .extractDetectedStructure(targetRegion.id, false);
      expect(extracted).not.toBeNull();
      expect(extracted!.source).toBe('segmented_part');
      expect(extracted!.stats.isManifold).toBe(true);
      expect(extracted!.stats.volumeMm3).toBeGreaterThan(100);

      // Separación total del Buzo en sub-partes independientes watertight
      const splitParts = await useKuraStore.getState().splitAllDetectedObjectStructures(diver.id);
      expect(splitParts.length).toBe(seg!.regions.length);
      expect(splitParts.length).toBeGreaterThanOrEqual(4);
      for (const part of splitParts) {
        expect(part.source).toBe('segmented_part');
        expect(part.stats.isManifold).toBe(true);
        expect(part.stats.volumeMm3).toBeGreaterThan(20);
      }

      // El objeto original fusionado debe haber sido reemplazado por las sub-partes
      expect(useKuraStore.getState().objects.some((o) => o.id === diver.id)).toBe(false);
    });
  });

  // ==========================================================================
  // ÁREA 8: Interacciones CAD Pro en Store & Command Bus v4.0
  // ==========================================================================
  describe('8. Interacciones CAD Pro en Store y Command Bus v4.0', () => {
    it('ejecuta mirrorObject, nudgeSelectedObjects, proportionalScale, altCloneForDrag, material y ciclo uiDensity', async () => {
      const box = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 20, height: 14, depth: 10 }, { position: [5, 0, 10] });
      expect(box).not.toBeNull();

      // Nudge (+10, 0, -5)
      useKuraStore.getState().nudgeSelectedObjects([10, 0, -5]);
      let updated = useKuraStore.getState().objects.find((o) => o.id === box!.id)!;
      expect(updated.position).toEqual([15, 0, 5]);

      // Toggle proportionalScale (true -> false -> true)
      expect(useKuraStore.getState().proportionalScale).toBe(true);
      useKuraStore.getState().toggleProportionalScale();
      expect(useKuraStore.getState().proportionalScale).toBe(false);
      useKuraStore.getState().toggleProportionalScale();
      expect(useKuraStore.getState().proportionalScale).toBe(true);

      // Material PBR
      useKuraStore.getState().setObjectMaterial(box!.id, 'carbon_fiber');
      updated = useKuraStore.getState().objects.find((o) => o.id === box!.id)!;
      expect(updated.materialPreset).toBe('carbon_fiber');

      // Ciclo de densidad UI: full -> compact -> zen -> full
      expect(useKuraStore.getState().uiDensity).toBe('full');
      useKuraStore.getState().cycleUiDensity();
      expect(useKuraStore.getState().uiDensity).toBe('compact');
      useKuraStore.getState().cycleUiDensity();
      expect(useKuraStore.getState().uiDensity).toBe('zen');
      useKuraStore.getState().cycleUiDensity();
      expect(useKuraStore.getState().uiDensity).toBe('full');

      // Mirror directo sobre eje X en malla asimétrica (texto extruido o cilindro desplazado)
      const mirrorOk = useKuraStore.getState().mirrorObject(box!.id, 'x');
      expect(mirrorOk).toBe(true);
      updated = useKuraStore.getState().objects.find((o) => o.id === box!.id)!;
      expect(updated.stats.isManifold).toBe(true);

      // Alt-arrastre: inserta clon estacionario y renombra el arrastrado con '(copia)'
      const countBeforeClone = useKuraStore.getState().objects.length;
      const dragged = useKuraStore.getState().altCloneForDrag(box!.id);
      expect(dragged).not.toBeNull();
      expect(dragged!.name).toContain('(copia)');
      expect(useKuraStore.getState().objects.length).toBe(countBeforeClone + 1);
      useKuraStore.getState().commitTransformSnapshot();
    });

    it('despacha los comandos v4.0 del Command Bus (detect_structures, colorize_structures, extract_structure, mirror_object)', async () => {
      // Construimos un modelo compuesto simple (caja + cilindro unido) vía store
      const b = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 24, height: 24, depth: 16 });
      const c = await useKuraStore
        .getState()
        .createPrimitive('cylinder', { radius: 6, height: 20, segments: 24 }, { position: [0, 20, 0] });
      const fused = await useKuraStore
        .getState()
        .runBooleanOnSelection('union', b!.id, c!.id);
      expect(fused).not.toBeNull();

      // 1. detect_structures
      const resDetect = await useKuraStore.getState().executeCommand(
        {
          id: 'cmd_detect',
          command: 'detect_structures',
          params: { objectId: fused!.id, creaseAngleDeg: 28 },
        },
        'mcp'
      );
      expect(resDetect.ok).toBe(true);
      const detectData = resDetect.result as { regions: Array<{ id: string }> };
      expect(detectData.regions.length).toBeGreaterThanOrEqual(2);

      // 2. colorize_structures
      const resColor = await useKuraStore.getState().executeCommand(
        {
          id: 'cmd_color',
          command: 'colorize_structures',
          params: { objectId: fused!.id },
        },
        'mcp'
      );
      expect(resColor.ok).toBe(true);

      // 3. extract_structure
      const resExtract = await useKuraStore.getState().executeCommand(
        {
          id: 'cmd_extract',
          command: 'extract_structure',
          params: {
            objectId: fused!.id,
            regionId: detectData.regions[1].id,
            removeFromSource: false,
          },
        },
        'mcp'
      );
      expect(resExtract.ok).toBe(true);
      const extInfo = resExtract.result as { id: string; stats: { isManifold: boolean } };
      expect(extInfo.stats.isManifold).toBe(true);

      // 4. mirror_object
      const resMirror = await useKuraStore.getState().executeCommand(
        {
          id: 'cmd_mirror',
          command: 'mirror_object',
          params: { objectId: extInfo.id, axis: 'x' },
        },
        'mcp'
      );
      expect(resMirror.ok).toBe(true);
    });
  });

  // ==========================================================================
  // ÁREA 9: Exportación 3MF Multi-Slicer Pro (Bambu, Elegoo, Snapmaker, FlashForge)
  // ==========================================================================
  describe('9. Exportación 3MF Multi-Slicer Pro con Metadata/model_settings.config', () => {
    it('exporta 3MF válido para bambu, elegoo, snapmaker y flashforge vía engine y Command Bus', async () => {
      const p1 = await useKuraStore
        .getState()
        .createPrimitive('box', { width: 20, height: 15, depth: 20 }, { name: 'ParteA', color: '#38bdf8' });
      const p2 = await useKuraStore
        .getState()
        .createPrimitive(
          'cylinder',
          { radius: 8, height: 18, segments: 24 },
          { name: 'ParteB', color: '#f97316', position: [35, 0, 0] }
        );
      expect(p1 && p2).toBeTruthy();

      const slicers = ['bambu', 'elegoo', 'snapmaker', 'flashforge'] as const;
      const sceneObjects = useKuraStore.getState().objects;

      for (const slicer of slicers) {
        // Exportación directa desde motor
        const bytes = exportSceneTo3MF(sceneObjects, 'mm', slicer);
        const archive = unzipSync(bytes);

        expect(archive['3D/3dmodel.model']).toBeDefined();
        expect(archive['Metadata/model_settings.config']).toBeDefined();

        const modelXml = strFromU8(archive['3D/3dmodel.model']);
        const configXml = strFromU8(archive['Metadata/model_settings.config']);

        expect(modelXml).toContain(`<metadata name="SlicerTarget">${slicer}</metadata>`);
        expect(configXml).toContain(`value="${slicer}"`);
        expect(configXml).toContain('<metadata key="extruder" value="1"/>');
        expect(configXml).toContain('<metadata key="extruder" value="2"/>');

        // Round-trip de importación 3MF
        const reimported = import3MFBuffer(bytes.buffer as ArrayBuffer);
        expect(reimported).toHaveLength(2);
        expect(reimported[0].name).toBe('ParteA');
        expect(reimported[1].color).toBe('#f97316');

        // Exportación vía Command Bus (`export_3mf`)
        const cmdRes = await useKuraStore.getState().executeCommand(
          {
            id: `cmd_3mf_${slicer}`,
            command: 'export_3mf',
            params: { slicerTarget: slicer, returnBytes: true },
          },
          'mcp'
        );
        expect(cmdRes.ok).toBe(true);
        const payload = cmdRes.result as { format: string; slicerTarget: string; bytesBase64: string };
        expect(payload.format).toBe('3mf');
        expect(payload.slicerTarget).toBe(slicer);
        expect(payload.bytesBase64.length).toBeGreaterThan(100);
      }
    });
  });
});
