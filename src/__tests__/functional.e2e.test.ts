/**
 * @file src/__tests__/functional.e2e.test.ts
 * @description Suite integral de evaluación funcional End-to-End (E2E) para Kurra Studio.
 * Verifica las 13 áreas funcionales principales contra el motor real Manifold-3D WASM,
 * el store central Zustand (`useKuraStore`), el Command Bus unificado, conversión de
 * unidades, diccionario i18n bilingüe (ES/EN), formatos STL/OBJ/3MF y el asistente IA local.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { unzipSync, strFromU8 } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAiPrompt } from '../ai/aiClient';
import {
  applyProceduralTexture,
  computeMeshStats,
  createPrimitiveMesh,
  exportMeshToOBJ,
  exportSceneTo3MF,
  exportSceneToBinarySTL,
  extrudeSvgToMesh,
  generateReliefFromImage,
  import3MFBuffer,
  importOBJText,
  importSTLBuffer,
  initManifoldEngine,
  paintFloodFillConnectedFaces,
  paintMeshFacesInSphere,
  runBooleanOperation,
} from '../engine';
import { t } from '../i18n';
import { TRANSLATIONS_EN, TRANSLATIONS_ES } from '../i18n/translations';
import { useKuraStore } from '../store/useKuraStore';
import type { AiConfig, MeshData, SceneObject, UnitSystem } from '../types/kura';
import {
  formatDimension,
  formatVolume,
  fromMm,
  getUnitLabel,
  getUnitStep,
  toMm,
} from '../utils/units';

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

/** Construye un SceneObject válido para pruebas directas del motor. */
function makeTestObject(
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
    role: 'solid',
    visible: true,
    locked: false,
    mesh,
    stats: computeMeshStats(mesh),
    ...overrides,
  };
}

/** Reinicia el store a una escena limpia antes de cada bloque de pruebas. */
async function resetCleanStore() {
  await initManifoldEngine();
  useKuraStore.setState({
    engineReady: true,
    engineError: null,
    objects: [],
    selectedIds: [],
    past: [],
    future: [],
    unitSystem: 'mm',
    language: 'es',
    paintColor: '#f97316',
    paintRadiusMm: 6,
    paintMode: 'brush',
    toasts: [],
  });
}

describe('Evaluación Funcional E2E de Kurra Studio (13 áreas funcionales)', () => {
  beforeEach(async () => {
    await resetCleanStore();
  });

  // ==========================================================================
  // ÁREA 1: Creación de primitivas con dimensiones exactas y apoyo en Y=0
  // ==========================================================================
  describe('1. Primitivas paramétricas (box, cylinder, tube, sphere, cone, torus, prism, text)', () => {
    it('crea las 8 primitivas vía store con dimensiones en mm, malla watertight y base en Y=0', async () => {
      const store = useKuraStore.getState();

      const box = await store.createPrimitive('box', { width: 25, height: 12, depth: 35 });
      expect(box).not.toBeNull();
      expect(box!.stats.isManifold).toBe(true);
      expect(box!.stats.dimensionsMm[0]).toBeCloseTo(25, 2);
      expect(box!.stats.dimensionsMm[1]).toBeCloseTo(12, 2);
      expect(box!.stats.dimensionsMm[2]).toBeCloseTo(35, 2);
      expect(box!.stats.volumeMm3).toBeCloseTo(25 * 12 * 35, 1);
      expect(getMeshBounds(box!.mesh).minY).toBeCloseTo(0, 4);
      expect(box!.position[1]).toBeCloseTo(0, 4);

      const cyl = await store.createPrimitive('cylinder', { radius: 10, height: 22, segments: 48 });
      expect(cyl!.stats.isManifold).toBe(true);
      expect(cyl!.stats.dimensionsMm[1]).toBeCloseTo(22, 2);
      expect(cyl!.stats.volumeMm3).toBeCloseTo(Math.PI * 100 * 22, -2);
      expect(getMeshBounds(cyl!.mesh).minY).toBeCloseTo(0, 4);

      const tube = await store.createPrimitive('tube', {
        outerRadius: 15,
        innerRadius: 8,
        height: 18,
        segments: 48,
      });
      expect(tube!.stats.isManifold).toBe(true);
      expect(tube!.stats.dimensionsMm[1]).toBeCloseTo(18, 2);
      const expectedTubeVol = Math.PI * (225 - 64) * 18;
      expect(Math.abs(tube!.stats.volumeMm3 - expectedTubeVol)).toBeLessThan(250);
      expect(getMeshBounds(tube!.mesh).minY).toBeCloseTo(0, 4);

      const sphere = await store.createPrimitive('sphere', { radius: 12, segments: 32 });
      expect(sphere!.stats.isManifold).toBe(true);
      expect(sphere!.stats.dimensionsMm[1]).toBeCloseTo(24, 1);
      expect(getMeshBounds(sphere!.mesh).minY).toBeCloseTo(0, 4);

      const cone = await store.createPrimitive('cone', { radius: 10, height: 30, segments: 40 });
      expect(cone!.stats.isManifold).toBe(true);
      expect(cone!.stats.dimensionsMm[1]).toBeCloseTo(30, 2);
      expect(cone!.stats.volumeMm3).toBeCloseTo((Math.PI * 100 * 30) / 3, -2);
      expect(getMeshBounds(cone!.mesh).minY).toBeCloseTo(0, 4);

      const torus = await store.createPrimitive('torus', {
        radius: 16,
        tubeRadius: 4,
        segments: 36,
      });
      expect(torus!.stats.isManifold).toBe(true);
      // Diámetro exterior esperado = 2 * (16 + 4) = 40 mm, altura = 2 * 4 = 8 mm
      expect(torus!.stats.dimensionsMm[0]).toBeCloseTo(40, 0);
      expect(torus!.stats.dimensionsMm[1]).toBeCloseTo(8, 1);
      expect(getMeshBounds(torus!.mesh).minY).toBeCloseTo(0, 4);

      const prism = await store.createPrimitive('prism', { sides: 6, radius: 12, height: 16 });
      expect(prism!.stats.isManifold).toBe(true);
      expect(prism!.stats.dimensionsMm[1]).toBeCloseTo(16, 2);
      expect(getMeshBounds(prism!.mesh).minY).toBeCloseTo(0, 4);

      const textObj = await store.createPrimitive('text', {
        text: 'KURA',
        fontSize: 16,
        height: 6,
      });
      expect(textObj!.stats.isManifold).toBe(true);
      expect(textObj!.stats.dimensionsMm[1]).toBeCloseTo(6, 2);
      expect(getMeshBounds(textObj!.mesh).minY).toBeCloseTo(0, 4);
      expect(useKuraStore.getState().objects).toHaveLength(8);
    });

    it('detecta si createPrimitive/executeCommand respeta outerRadius en torus y parámetros planos en prism', async () => {
      // Verificación estricta de compatibilidad entre el esquema de aiClient (outerRadius) y primitives.ts
      const torusViaOuter = await createPrimitiveMesh('torus', {
        outerRadius: 25,
        tubeRadius: 5,
        segments: 32,
      });
      const torusStats = computeMeshStats(torusViaOuter);
      // Si outerRadius se respetara como radio mayor, el ancho sería 2*(25+5)=60mm; si se ignora, cae a default 14 -> 38mm
      expect(torusStats.dimensionsMm[0]).toBeCloseTo(60, 0);
    });

    it('verifica que executeCommand create_primitive reenvía sides para prism plano', async () => {
      const store = useKuraStore.getState();
      const res = await store.executeCommand({
        id: 'cmd_prism_flat',
        command: 'create_primitive',
        params: { type: 'prism', sides: 3, radius: 10, height: 10 },
      });
      expect(res.ok).toBe(true);
      const created = useKuraStore.getState().objects[0];
      // Un prisma triangular de radio 10 y altura 10 tiene exactamente 8 triángulos (2 tapas de 1 tri + 3 caras de 2 tris)
      expect(created.stats.triangles).toBe(8);
    });
  });

  // ==========================================================================
  // ÁREA 2: Ahuecado (hollow_object)
  // ==========================================================================
  describe('2. Ahuecado paramétrico (hollow_object)', () => {
    it('genera carcasa hueca watertight con menor volumen y orificio de drenaje opcional vía Command Bus', async () => {
      const store = useKuraStore.getState();
      const created = await store.createPrimitive('box', { width: 30, height: 30, depth: 30 });
      expect(created).not.toBeNull();
      const solidVol = created!.stats.volumeMm3;
      expect(solidVol).toBeCloseTo(27000, 1);

      const hollowRes = await store.executeCommand({
        id: 'cmd_hollow_1',
        command: 'hollow_object',
        params: { id: created!.id, wallThickness: 3, drainHole: false },
      });
      expect(hollowRes.ok).toBe(true);

      const hollowedObj = useKuraStore.getState().objects.find((o) => o.id === created!.id)!;
      expect(hollowedObj.stats.isManifold).toBe(true);
      // Volumen teórico exacto: 30³ - (30 - 2*3)³ = 27000 - 13824 = 13176 mm³
      expect(hollowedObj.stats.volumeMm3).toBeCloseTo(13176, 0);
      expect(hollowedObj.stats.volumeMm3).toBeLessThan(solidVol);

      // Ahora con orificio de drenaje sobre un nuevo cubo sólido
      const created2 = await store.createPrimitive('box', { width: 30, height: 30, depth: 30 });
      const drainRes = await store.executeCommand({
        id: 'cmd_hollow_drain',
        command: 'hollow_object',
        params: { id: created2!.id, wallThickness: 3, drainHole: true, drainHoleRadius: 4 },
      });
      expect(drainRes.ok).toBe(true);

      const drainedObj = useKuraStore.getState().objects.find((o) => o.id === created2!.id)!;
      expect(drainedObj.stats.isManifold).toBe(true);
      expect(drainedObj.stats.volumeMm3).toBeLessThan(13176);
      expect(drainedObj.stats.triangles).toBeGreaterThan(hollowedObj.stats.triangles);
    });
  });

  // ==========================================================================
  // ÁREA 3: Operaciones Booleanas CSG (union, subtract, intersect)
  // ==========================================================================
  describe('3. Operaciones Booleanas CSG (union, subtract, intersect)', () => {
    it('ejecuta union, subtract e intersect vía executeCommand y runBooleanOperation preservando manifold', async () => {
      const store = useKuraStore.getState();

      // Caso A: Unión vía Command Bus
      const box1 = await store.createPrimitive(
        'box',
        { width: 20, height: 20, depth: 20 },
        { position: [0, 0, 0], color: '#38bdf8' }
      );
      const box2 = await store.createPrimitive(
        'box',
        { width: 20, height: 20, depth: 20 },
        { position: [10, 0, 0], color: '#ef4444' }
      );

      const unionCmd = await store.executeCommand({
        id: 'cmd_union',
        command: 'boolean_operation',
        params: { op: 'union', targetId: box1!.id, toolId: box2!.id },
      });
      expect(unionCmd.ok).toBe(true);
      const unionObj = useKuraStore.getState().objects[0];
      expect(unionObj.stats.isManifold).toBe(true);
      expect(unionObj.stats.volumeMm3).toBeCloseTo(12000, 1);
      expect(new Set(unionObj.mesh.faceColors).size).toBe(2);

      // Caso B: Resta e Intersección directas sobre el motor y vía store isHole
      const rawA = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const rawB = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const objA = makeTestObject('A', rawA, { position: [0, 0, 0] });
      const objB = makeTestObject('B', rawB, { position: [10, 0, 0] });

      const subRes = await runBooleanOperation(objA, objB, 'subtract');
      const subStats = computeMeshStats(subRes.mesh);
      expect(subStats.isManifold).toBe(true);
      expect(subStats.volumeMm3).toBeCloseTo(4000, 1);

      const interRes = await runBooleanOperation(objA, objB, 'intersect');
      const interStats = computeMeshStats(interRes.mesh);
      expect(interStats.isManifold).toBe(true);
      expect(interStats.volumeMm3).toBeCloseTo(4000, 1);

      // Caso C: Resta estilo Tinkercad con isHole=true y applyHolesOnSolids
      await resetCleanStore();
      const s2 = useKuraStore.getState();
      await s2.createPrimitive('box', { width: 20, height: 20, depth: 20 }, { position: [0, 0, 0] });
      await s2.createPrimitive(
        'box',
        { width: 20, height: 20, depth: 20 },
        { position: [10, 0, 0], role: 'negative' }
      );
      s2.selectAll();
      await s2.applyHolesOnSolids();
      expect(useKuraStore.getState().objects).toHaveLength(1);
      expect(useKuraStore.getState().objects[0].stats.volumeMm3).toBeCloseTo(4000, 1);
    });
  });

  // ==========================================================================
  // ÁREA 4: Corte por Plano con Conectores (dowel, peg, dovetail)
  // ==========================================================================
  describe('4. Corte por plano con conectores mecánicos (dowel, peg, dovetail)', () => {
    it('corta en ejes Y, X y Z generando 2 mitades watertight con tolerancia de encaje', async () => {
      for (const axis of ['y', 'x', 'z'] as const) {
        for (const connectorType of ['dowel', 'peg', 'dovetail'] as const) {
          await resetCleanStore();
          const store = useKuraStore.getState();
          const block = await store.createPrimitive('box', { width: 40, height: 40, depth: 40 });

          const res = await store.executeCommand({
            id: `cmd_cut_${axis}_${connectorType}`,
            command: 'plane_cut',
            params: {
              id: block!.id,
              axis,
              offset: 0,
              connectorType,
              connectorSize: 3,
              connectorDepth: 6,
              tolerance: 0.25,
              connectorCount: 2,
              keepMode: 'both',
            },
          });

          expect(res.ok).toBe(true);
          const halves = useKuraStore.getState().objects;
          expect(halves).toHaveLength(2);

          // Mitad A = lado negativo del eje del usuario. El lado positivo del motor (el que recibe las
          // cavidades) es el positivo del usuario en X y Z, y el negativo en Y (Y del usuario = −Z del motor).
          const [posName, negName] = axis === 'y' ? ['mitad A', 'mitad B'] : ['mitad B', 'mitad A'];
          const posHalf = halves.find((h) => h.name.includes(`${posName} (`))!;
          const negHalf = halves.find((h) => h.name.includes(`${negName} (`))!;
          expect(posHalf).toBeDefined();
          expect(negHalf).toBeDefined();

          expect(posHalf.stats.isManifold).toBe(true);
          expect(negHalf.stats.isManifold).toBe(true);
          // La mitad negativa suma pines macho (> 32000 mm³) y la positiva resta cavidades hembra con holgura (< 32000 mm³)
          expect(negHalf.stats.volumeMm3).toBeGreaterThan(32000);
          expect(posHalf.stats.volumeMm3).toBeLessThan(32000);
          expect(posHalf.stats.volumeMm3).toBeGreaterThan(30000);
        }
      }
    });
  });

  // ==========================================================================
  // ÁREA 5: Separar Islas Desconectadas (split_disconnected)
  // ==========================================================================
  describe('5. Separación de islas desconectadas (split_disconnected)', () => {
    it('separa dos sólidos combinados no solapados nuevamente en 2 objetos independientes', async () => {
      const store = useKuraStore.getState();
      const left = await store.createPrimitive(
        'box',
        { width: 12, height: 12, depth: 12 },
        { position: [-25, 0, 0] }
      );
      const right = await store.createPrimitive(
        'box',
        { width: 14, height: 14, depth: 14 },
        { position: [25, 0, 0] }
      );

      const merged = await store.runBooleanOnSelection('union', left!.id, right!.id);
      expect(merged).not.toBeNull();
      expect(useKuraStore.getState().objects).toHaveLength(1);

      const splitRes = await store.executeCommand({
        id: 'cmd_split_disc',
        command: 'split_disconnected',
        params: { id: merged!.id },
      });
      expect(splitRes.ok).toBe(true);

      const parts = useKuraStore.getState().objects;
      expect(parts).toHaveLength(2);
      expect(parts[0].stats.isManifold).toBe(true);
      expect(parts[1].stats.isManifold).toBe(true);

      const vols = parts.map((p) => p.stats.volumeMm3).sort((a, b) => a - b);
      expect(vols[0]).toBeCloseTo(12 ** 3, 1);
      expect(vols[1]).toBeCloseTo(14 ** 3, 1);
    });
  });

  // ==========================================================================
  // ÁREA 6: Pintado por caras / esfera y Separación por Color (split_by_color)
  // ==========================================================================
  describe('6. Pintado multicolor y separación por color (split_by_color)', () => {
    it('pinta con esfera y flood-fill inteligente y separa las regiones en mallas exportables', async () => {
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const obj = makeTestObject('painted_cube', box, { color: '#38bdf8' });

      // Pintado por esfera en la cara superior (centroide en (±3.33, 20, ∓3.33))
      const spherePainted = paintMeshFacesInSphere(obj, [0, 20, 0], 10, '#ef4444');
      expect(spherePainted.faceColors).toBeDefined();
      expect(spherePainted.faceColors!.some((c) => c === '#ef4444')).toBe(true);

      // Pintado por esfera sobre malla subdividida (esfera de radio 12)
      const sphereMesh = await createPrimitiveMesh('sphere', { radius: 12, segments: 24 });
      const sphereObj = makeTestObject('painted_sphere', sphereMesh, { color: '#38bdf8' });
      const sphereBrush = paintMeshFacesInSphere(sphereObj, [0, 24, 0], 6, '#a855f7');
      expect(sphereBrush.faceColors!.filter((c) => c === '#a855f7').length).toBeGreaterThan(10);

      // Flood-fill en cara 0 detenido por aristas de 90° (pinta exactamente 2 triángulos de esa cara)
      const floodPainted = paintFloodFillConnectedFaces(box, 0, '#22c55e', 30);
      expect(floodPainted.faceColors!.filter((c) => c === '#22c55e')).toHaveLength(2);

      // Flujo en store: pintar vía executeCommand + smart_fill + split_by_color
      const store = useKuraStore.getState();
      const sceneBox = await store.createPrimitive(
        'box',
        { width: 20, height: 20, depth: 20 },
        { color: '#38bdf8' }
      );
      store.setPaintSettings({ paintColor: '#f97316', paintRadiusMm: 10 });
      store.paintObjectSurface(sceneBox!.id, null, 0, 'smart_fill');

      const splitCmd = await store.executeCommand({
        id: 'cmd_split_color',
        command: 'split_by_color',
        params: { id: sceneBox!.id },
      });
      expect(splitCmd.ok).toBe(true);

      const colorParts = useKuraStore.getState().objects;
      expect(colorParts).toHaveLength(2);
      const colors = colorParts.map((p) => p.color.toLowerCase()).sort();
      expect(colors).toEqual(['#38bdf8', '#f97316']);

      // Cada región separada debe poder exportarse a STL binario válido
      for (const part of colorParts) {
        const stl = exportSceneToBinarySTL([part]);
        expect(stl.byteLength).toBe(84 + part.stats.triangles * 50);
      }
    });
  });

  // ==========================================================================
  // ÁREA 7: Extrusión de SVG
  // ==========================================================================
  describe('7. Importación y extrusión de SVG (extrudeSvgToMesh + import_svg)', () => {
    it('extruye un SVG multi-forma con agujeros produciendo un sólido watertight de ancho y alto exactos', async () => {
      const multiShapeSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <path d="M 10 10 H 90 V 90 H 10 Z M 30 30 H 70 V 70 H 30 Z" />
          <rect x="2" y="2" width="14" height="14" />
          <circle cx="50" cy="50" r="10" />
          <polygon points="95,10 115,10 105,30" />
        </svg>
      `;

      const directMesh = await extrudeSvgToMesh({
        svgContent: multiShapeSvg,
        name: 'Emblema',
        depth: 8,
        targetWidth: 50,
        curveSegments: 12,
      });
      const stats = computeMeshStats(directMesh);
      expect(stats.isManifold).toBe(true);
      expect(stats.dimensionsMm[0]).toBeCloseTo(50, 1);
      expect(stats.dimensionsMm[1]).toBeCloseTo(8, 1);
      expect(getMeshBounds(directMesh).minY).toBeCloseTo(0, 4);

      // También vía Command Bus `import_svg`
      const store = useKuraStore.getState();
      const cmdRes = await store.executeCommand({
        id: 'cmd_svg',
        command: 'import_svg',
        params: {
          svgContent: multiShapeSvg,
          name: 'SvgCmd',
          depth: 6,
          targetWidth: 40,
          curveSegments: 10,
        },
      });
      expect(cmdRes.ok).toBe(true);
      const importedObj = useKuraStore.getState().objects[0];
      expect(importedObj.source).toBe('svg');
      expect(importedObj.stats.isManifold).toBe(true);
      expect(importedObj.stats.dimensionsMm[0]).toBeCloseTo(40, 1);
      expect(importedObj.stats.dimensionsMm[1]).toBeCloseTo(6, 1);
    });
  });

  // ==========================================================================
  // ÁREA 8: Imagen a 3D (Relieve y Litofanía)
  // ==========================================================================
  describe('8. Imagen a 3D: Relieve y Litofanía (generateReliefFromImage)', () => {
    it('genera relieves normales y litofanías invertidas watertight con altura base + relieve exacta', async () => {
      const w = 24;
      const h = 24;
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const lum = Math.round((x / (w - 1)) * 255);
          rgba[i] = lum;
          rgba[i + 1] = lum;
          rgba[i + 2] = lum;
          rgba[i + 3] = 255;
        }
      }

      const relief = generateReliefFromImage({
        name: 'RelieveGradiente',
        rgba,
        pixelWidth: w,
        pixelHeight: h,
        widthMm: 48,
        depthMm: 48,
        baseThicknessMm: 2,
        reliefHeightMm: 5,
        invert: false,
        smoothing: 0,
      });

      const reliefStats = computeMeshStats(relief);
      const reliefBounds = getMeshBounds(relief);
      expect(reliefStats.isManifold).toBe(true);
      expect(reliefStats.dimensionsMm[0]).toBeCloseTo(48, 2);
      expect(reliefStats.dimensionsMm[1]).toBeCloseTo(7, 2); // 2mm base + 5mm relieve
      expect(reliefStats.dimensionsMm[2]).toBeCloseTo(48, 2);
      expect(reliefBounds.minY).toBeCloseTo(0, 4);

      // Litofanía invertida vía store (sin suavizado para verificar altura exacta base + relieve)
      const store = useKuraStore.getState();
      const lithoObj = await store.generateImageRelief({
        name: 'Litofania',
        rgba,
        pixelWidth: w,
        pixelHeight: h,
        widthMm: 48,
        depthMm: 48,
        baseThicknessMm: 1.5,
        reliefHeightMm: 4.5,
        invert: true,
        smoothing: 0,
      });

      expect(lithoObj).not.toBeNull();
      expect(lithoObj!.stats.isManifold).toBe(true);
      expect(lithoObj!.stats.dimensionsMm[1]).toBeCloseTo(6, 2); // 1.5 + 4.5 exacto
      expect(getMeshBounds(lithoObj!.mesh).minY).toBeCloseTo(0, 4);

      // Comprobación con suavizado (smoothing: 1) manteniendo cierre watertight
      const smoothedLitho = generateReliefFromImage({
        name: 'LitofaniaSuave',
        rgba,
        pixelWidth: w,
        pixelHeight: h,
        widthMm: 48,
        depthMm: 48,
        baseThicknessMm: 1.5,
        reliefHeightMm: 4.5,
        invert: true,
        smoothing: 1,
      });
      expect(computeMeshStats(smoothedLitho).isManifold).toBe(true);
      expect(computeMeshStats(smoothedLitho).dimensionsMm[1]).toBeGreaterThan(5.5);
      expect(computeMeshStats(smoothedLitho).dimensionsMm[1]).toBeLessThanOrEqual(6.01);
    });
  });

  // ==========================================================================
  // ÁREA 9: Texturas Procedurales Superficiales
  // ==========================================================================
  describe('9. Texturas superficiales procedurales (fuzzy, knurling, waves, honeycomb, grid)', () => {
    it('desplaza visiblemente la geometría manteniendo cierre watertight para los 5 patrones', async () => {
      const baseBox = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const baseStats = computeMeshStats(baseBox);

      for (const pattern of ['fuzzy', 'knurling', 'waves', 'honeycomb', 'grid'] as const) {
        const textured = applyProceduralTexture(baseBox, {
          pattern,
          depth: 0.5,
          scale: 4,
        });
        const stats = computeMeshStats(textured);
        const bounds = getMeshBounds(textured);

        expect(stats.isManifold).toBe(true);
        expect(stats.triangles).toBeGreaterThan(baseStats.triangles * 4);
        expect(bounds.minY).toBeCloseTo(0, 4);
        // El desplazamiento superficial cambia las dimensiones máximas o el volumen respecto al cubo liso
        const diffVol = Math.abs(stats.volumeMm3 - baseStats.volumeMm3);
        const diffDim =
          Math.abs(stats.dimensionsMm[0] - baseStats.dimensionsMm[0]) +
          Math.abs(stats.dimensionsMm[1] - baseStats.dimensionsMm[1]) +
          Math.abs(stats.dimensionsMm[2] - baseStats.dimensionsMm[2]);
        expect(diffVol + diffDim).toBeGreaterThan(0.05);
      }

      // Verificación vía Command Bus `apply_texture`
      const store = useKuraStore.getState();
      const boxObj = await store.createPrimitive('box', { width: 20, height: 20, depth: 20 });
      const texRes = await store.executeCommand({
        id: 'cmd_tex',
        command: 'apply_texture',
        params: { id: boxObj!.id, pattern: 'knurling', depth: 0.45, scale: 3.5 },
      });
      expect(texRes.ok).toBe(true);
      const updated = useKuraStore.getState().objects[0];
      expect(updated.stats.isManifold).toBe(true);
      expect(updated.texture?.pattern).toBe('knurling');
    });
  });

  // ==========================================================================
  // ÁREA 10: Exportación e Importación STL binario, OBJ y 3MF multicolor
  // ==========================================================================
  describe('10. Exportación e Importación STL binario, OBJ y 3MF ZIP multicolor', () => {
    it('realiza round-trip exacto STL binario, OBJ y 3MF ZIP con materiales y colores por cara', async () => {
      const cyl = await createPrimitiveMesh('cylinder', { radius: 10, height: 24, segments: 32 });
      const cylObj = makeTestObject('CilindroExport', cyl, { color: '#22c55e' });

      // 10.1 STL Binario
      const stlBytes = exportSceneToBinarySTL([cylObj]);
      const dv = new DataView(stlBytes.buffer, stlBytes.byteOffset, stlBytes.byteLength);
      const triCount = dv.getUint32(80, true);
      expect(triCount).toBe(cylObj.stats.triangles);
      expect(stlBytes.byteLength).toBe(84 + triCount * 50);

      const reimportedStl = importSTLBuffer(stlBytes.buffer as ArrayBuffer);
      const stlStats = computeMeshStats(reimportedStl);
      expect(stlStats.isManifold).toBe(true);
      expect(stlStats.dimensionsMm[1]).toBeCloseTo(24, 2);
      expect(stlStats.volumeMm3).toBeCloseTo(cylObj.stats.volumeMm3, 0);

      // 10.2 Wavefront OBJ
      const objText = exportMeshToOBJ(cyl, 'CilindroOBJ');
      const reimportedObj = importOBJText(objText);
      const objStats = computeMeshStats(reimportedObj);
      expect(objStats.isManifold).toBe(true);
      expect(objStats.volumeMm3).toBeCloseTo(cylObj.stats.volumeMm3, 0);

      // 10.3 3MF ZIP Multicolor
      const box = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
      const paintedBox = paintFloodFillConnectedFaces(box, 0, '#f97316', 30);
      const boxObj = makeTestObject('CajaMulticolor', paintedBox, { color: '#38bdf8' });

      const mf3Bytes = exportSceneTo3MF([boxObj, cylObj], 'mm');
      expect(mf3Bytes[0]).toBe(0x50); // 'P'
      expect(mf3Bytes[1]).toBe(0x4b); // 'K'

      const zip = unzipSync(mf3Bytes);
      expect(zip['[Content_Types].xml']).toBeDefined();
      expect(zip['_rels/.rels']).toBeDefined();
      expect(zip['3D/3dmodel.model']).toBeDefined();

      const xml = strFromU8(zip['3D/3dmodel.model']);
      expect(xml).toContain('unit="millimeter"');
      expect(xml).toContain('<basematerials');
      expect(xml).toContain('#38BDF8FF');
      expect(xml).toContain('#F97316FF');
      expect(xml).toContain('#22C55EFF');

      const imported3mf = import3MFBuffer(mf3Bytes.buffer as ArrayBuffer);
      expect(imported3mf).toHaveLength(2);
      expect(imported3mf[0].name).toBe('CajaMulticolor');
      expect(new Set(imported3mf[0].mesh.faceColors).size).toBe(2);
      expect(computeMeshStats(imported3mf[0].mesh).isManifold).toBe(true);
      expect(computeMeshStats(imported3mf[0].mesh).volumeMm3).toBeCloseTo(8000, 1);
      expect(imported3mf[1].color).toBe('#22c55e');
      expect(computeMeshStats(imported3mf[1].mesh).isManifold).toBe(true);
    });

    it('verifica comandos export_stl y export_3mf en Command Bus con entorno DOM web simulado', async () => {
      const store = useKuraStore.getState();
      await store.createPrimitive('box', { width: 15, height: 15, depth: 15 });

      const clickedDownloads: string[] = [];
      const origDoc = globalThis.document;
      const origCreateObjectURL = URL.createObjectURL;
      const origRevokeObjectURL = URL.revokeObjectURL;

      // Stub mínimo de descarga web en Node para verificar que export_stl y export_3mf completan el pipeline
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
          body: { appendChild: vi.fn() },
          createElement: vi.fn(() => ({
            href: '',
            download: '',
            style: {},
            click() {
              clickedDownloads.push(this.download);
            },
            remove: vi.fn(),
          })),
        },
      });
      URL.createObjectURL = vi.fn(() => 'blob:kura-test');
      URL.revokeObjectURL = vi.fn();

      try {
        const resStl = await store.executeCommand({
          id: 'cmd_exp_stl',
          command: 'export_stl',
          params: {},
        });
        const res3mf = await store.executeCommand({
          id: 'cmd_exp_3mf',
          command: 'export_3mf',
          params: {},
        });
        expect(resStl.ok).toBe(true);
        expect(res3mf.ok).toBe(true);
        expect(clickedDownloads.some((d) => d.endsWith('.stl'))).toBe(true);
        expect(clickedDownloads.some((d) => d.endsWith('.3mf'))).toBe(true);
      } finally {
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          value: origDoc,
        });
        URL.createObjectURL = origCreateObjectURL;
        URL.revokeObjectURL = origRevokeObjectURL;
      }
    });
  });

  // ==========================================================================
  // ÁREA 11: Conversión Multi-Unidad (mm, cm, m, in, ft)
  // ==========================================================================
  describe('11. Conversión multi-unidad (mm, cm, m, in, ft)', () => {
    it('realiza round-trip exacto, formateo CAD y actualización del store + cabecera 3MF', async () => {
      const units: UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];
      const sampleMm = 304.8; // exactamente 1 ft, 12 in, 30.48 cm, 0.3048 m

      for (const unit of units) {
        const converted = fromMm(sampleMm, unit);
        const backToMm = toMm(converted, unit);
        expect(backToMm).toBeCloseTo(sampleMm, 6);
        expect(getUnitLabel(unit)).toBe(unit);
        expect(getUnitStep(unit)).toBeGreaterThan(0);
      }

      expect(fromMm(304.8, 'ft')).toBeCloseTo(1, 6);
      expect(fromMm(304.8, 'in')).toBeCloseTo(12, 6);
      expect(fromMm(304.8, 'cm')).toBeCloseTo(30.48, 6);
      expect(fromMm(304.8, 'm')).toBeCloseTo(0.3048, 6);

      expect(formatDimension(25.4, 'in', 2)).toBe('1 in');
      expect(formatVolume(1000, 'cm')).toBe('1.00 cm³');

      // Verificar Command Bus `set_unit_system` y exportación 3MF en pulgadas
      const store = useKuraStore.getState();
      const unitCmd = await store.executeCommand({
        id: 'cmd_unit',
        command: 'set_unit_system',
        params: { unit: 'in' },
      });
      expect(unitCmd.ok).toBe(true);
      expect(useKuraStore.getState().unitSystem).toBe('in');

      const box = await store.createPrimitive('box', { width: 25.4, height: 25.4, depth: 25.4 });
      const mf3In = exportSceneTo3MF([box!], 'in');
      const xmlIn = strFromU8(unzipSync(mf3In)['3D/3dmodel.model']);
      expect(xmlIn).toContain('unit="inch"');
      const importedIn = import3MFBuffer(mf3In.buffer as ArrayBuffer);
      expect(computeMeshStats(importedIn[0].mesh).dimensionsMm[0]).toBeCloseTo(25.4, 2);
    });
  });

  // ==========================================================================
  // ÁREA 12: i18n Bilingüe (ES/EN) + Store Undo/Redo/Estado
  // ==========================================================================
  describe('12. i18n bilingüe (ES/EN) y flujo completo de Store (Undo/Redo/Perfil)', () => {
    it('mantiene paridad total de claves entre ES y EN sin claves faltantes ni vacías', () => {
      const keysEs = Object.keys(TRANSLATIONS_ES).sort();
      const keysEn = Object.keys(TRANSLATIONS_EN).sort();
      expect(keysEs.length).toBeGreaterThan(100);
      expect(keysEn).toEqual(keysEs);

      for (const key of keysEs as Array<keyof typeof TRANSLATIONS_ES>) {
        expect(TRANSLATIONS_ES[key].trim().length).toBeGreaterThan(0);
        expect(TRANSLATIONS_EN[key].trim().length).toBeGreaterThan(0);
      }

      expect(t('es', 'sidebar.scene.objectsCount', { count: 3 })).toBe('3 objetos');
      expect(t('en', 'sidebar.scene.objectsCount', { count: 3 })).toBe('3 objects');
    });

    it('soporta Undo/Redo determinista en useKuraStore y cambio de idioma/impresora', async () => {
      const store = useKuraStore.getState();
      store.setLanguage('en');
      expect(useKuraStore.getState().language).toBe('en');

      const p1 = await store.createPrimitive('box', { width: 15, height: 15, depth: 15 });
      expect(useKuraStore.getState().objects).toHaveLength(1);

      store.setObjectTransform(p1!.id, { position: [20, 0, 10] }, true);
      expect(useKuraStore.getState().objects[0].position).toEqual([20, 0, 10]);

      store.deleteObjects([p1!.id]);
      expect(useKuraStore.getState().objects).toHaveLength(0);

      // Undo borrado -> recupera objeto en [20, 0, 10]
      store.undo();
      expect(useKuraStore.getState().objects).toHaveLength(1);
      expect(useKuraStore.getState().objects[0].position).toEqual([20, 0, 10]);

      // Undo transformación -> regresa a [0, 0, 0] (tolerando -0 en coordenada Y)
      store.undo();
      const restoredPos = useKuraStore.getState().objects[0].position;
      expect(restoredPos[0]).toBeCloseTo(0, 6);
      expect(restoredPos[1]).toBeCloseTo(0, 6);
      expect(restoredPos[2]).toBeCloseTo(0, 6);

      // Redo transformación -> vuelve a [20, 0, 10]
      store.redo();
      expect(useKuraStore.getState().objects[0].position).toEqual([20, 0, 10]);

      // Perfil de impresora vía Command Bus
      const profRes = await store.executeCommand({
        id: 'cmd_printer',
        command: 'set_printer_profile',
        params: { profileId: 'generic-220' },
      });
      expect(profRes.ok).toBe(true);
      expect(useKuraStore.getState().printerProfile.id).toBe('generic-220');
    });
  });

  // ==========================================================================
  // ÁREA 13: Asistente IA Local Determinista + Command Bus
  // ==========================================================================
  describe('13. Asistente IA Local Determinista conectado al Command Bus', () => {
    it('interpreta prompts en español e inglés sin API Key y muta la escena real', async () => {
      const store = useKuraStore.getState();
      const localAiConfig: AiConfig = {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        baseUrl: '',
        temperature: 0.2,
      };

      // 1. Crear cubo 40mm
      const turn1 = await sendAiPrompt(
        'Crear cubo 40mm',
        [],
        localAiConfig,
        'es',
        store.executeCommand
      );
      expect(turn1.usedLocalFallback).toBe(true);
      expect(turn1.executedTools[0].name).toBe('create_primitive');
      expect(useKuraStore.getState().objects).toHaveLength(1);
      expect(useKuraStore.getState().objects[0].stats.dimensionsMm[0]).toBeCloseTo(40, 1);

      // 2. Ahuecar 2.5mm
      const turn2 = await sendAiPrompt(
        'Hollow the selected object 2.5mm with drain hole',
        [],
        localAiConfig,
        'en',
        store.executeCommand
      );
      expect(turn2.usedLocalFallback).toBe(true);
      expect(turn2.executedTools[0].name).toBe('hollow_object');
      expect(useKuraStore.getState().objects[0].stats.volumeMm3).toBeLessThan(64000);

      // 3. Textura knurling
      const turn3 = await sendAiPrompt(
        'Aplicar textura knurling al objeto seleccionado',
        [],
        localAiConfig,
        'es',
        store.executeCommand
      );
      expect(turn3.executedTools[0].name).toBe('apply_texture');
      expect(useKuraStore.getState().objects[0].texture?.pattern).toBe('knurling');

      // 4. Crear cilindro y cortar por plano
      const turn4 = await sendAiPrompt(
        'Create cylinder 20 50',
        [],
        localAiConfig,
        'en',
        store.executeCommand
      );
      expect(turn4.executedTools[0].name).toBe('create_primitive');
      expect(useKuraStore.getState().objects).toHaveLength(2);

      const turn5 = await sendAiPrompt(
        'Cortar el modelo seleccionado',
        [],
        localAiConfig,
        'es',
        store.executeCommand
      );
      expect(turn5.executedTools[0].name).toBe('plane_cut');
      expect(useKuraStore.getState().objects).toHaveLength(3); // 1 caja texturizada + 2 mitades del cilindro

      // 5. Consulta de estado
      const turn6 = await sendAiPrompt(
        '¿Qué hay en la escena?',
        [],
        localAiConfig,
        'es',
        store.executeCommand
      );
      expect(turn6.executedTools[0].name).toBe('get_scene_state');
      const statePayload = JSON.parse(turn6.executedTools[0].result);
      expect(statePayload.objects).toHaveLength(3);
    });
  });
});
