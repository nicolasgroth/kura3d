/**
 * @file src/engine/__tests__/segmentation.test.ts
 * @description Suite de pruebas unitarias Vitest para Kura3D: Detección y Segmentación
 * Estructural Determinística 3D, coloreado automático por regiones, extracción sólida
 * con cierre de fronteras abiertas, división completa y simetría especular (mirror).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject } from '../../types/kura';
import {
  applyStructureColorsToMesh,
  computeMeshStats,
  createPrimitiveMesh,
  detectStructuralRegions,
  extractStructuralRegion,
  initManifoldEngine,
  manifoldToMeshData,
  mirrorMeshAxis,
  normalizeMeshToBed,
  splitAllDetectedStructures,
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
    role: 'solid',
    visible: true,
    locked: false,
    mesh,
    stats: computeMeshStats(mesh),
    ...overrides,
  };
}

/**
 * Construye una figura compuesta sintética "Buzo / Diver" usando CSG de Manifold:
 * - Torso principal: caja 24 × 34 × 16 mm (Y = 0..34)
 * - Escafandra/casco esférico superior: r = 10 mm centrado en Y = 38
 * - Dos tanques cilíndricos traseros de oxígeno: r = 5 mm, h = 24 mm en X = ±6, Z = -11
 * - Tubo respirador delgado lateral: r = 2 mm, h = 22 mm en X = 13
 */
async function buildDiverCompositeMesh(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const handles: Manifold[] = [];

  try {
    // Torso: 24x34x16 mm apoyado en Y = 0..34
    const torsoRaw = wasm.Manifold.cube([24, 34, 16], true);
    handles.push(torsoRaw);
    const torso = torsoRaw.translate([0, 17, 0]);
    handles.push(torso);

    // Casco esférico superior: r = 10 mm en [0, 38, 0]
    const helmetRaw = wasm.Manifold.sphere(10, 32);
    handles.push(helmetRaw);
    const helmet = helmetRaw.translate([0, 38, 0]);
    handles.push(helmet);

    // Tanque izquierdo y derecho: r = 5 mm, h = 24 mm en X = ±6, Z = -11, Y = 5..29
    const tankBaseRaw = wasm.Manifold.cylinder(24, 5, 5, 28, false);
    handles.push(tankBaseRaw);
    const tankY = tankBaseRaw.rotate([-90, 0, 0]);
    handles.push(tankY);
    const tankLeft = tankY.translate([-6, 5, -11]);
    const tankRight = tankY.translate([6, 5, -11]);
    handles.push(tankLeft, tankRight);

    // Tubo respirador delgado: r = 2 mm, h = 22 mm en X = 13, Z = 0, Y = 10..32
    const tubeBaseRaw = wasm.Manifold.cylinder(22, 2, 2, 24, false);
    handles.push(tubeBaseRaw);
    const tubeY = tubeBaseRaw.rotate([-90, 0, 0]);
    handles.push(tubeY);
    const tube = tubeY.translate([13, 10, 0]);
    handles.push(tube);

    const fused = wasm.Manifold.union([torso, helmet, tankLeft, tankRight, tube]);
    handles.push(fused);

    const mesh = manifoldToMeshData(fused);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const h of handles) {
      h.delete();
    }
  }
}

describe('Kura3D — Detección y Segmentación Estructural Determinística', () => {
  it('detecta y clasifica limpiamente >= 4 sub-estructuras en la figura compuesta Buzo/Diver', async () => {
    const diverMesh = await buildDiverCompositeMesh();
    const diverObj = makeSceneObject('diver_1', diverMesh);

    const result = await detectStructuralRegions(diverObj);

    expect(result.objectId).toBe('diver_1');
    expect(result.method).toBe('shells_and_creases');
    expect(result.totalTriangles).toBe(Math.floor(diverMesh.indices.length / 3));
    expect(result.regions.length).toBeGreaterThanOrEqual(4);

    // Verificar cobertura completa de triángulos y unicidad de colores/etiquetas
    const coveredTris = new Set<number>();
    for (const reg of result.regions) {
      expect(reg.faceIndices.length).toBe(reg.triangleCount);
      expect(reg.triangleCount).toBeGreaterThan(0);
      expect(reg.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(reg.labelEs.length).toBeGreaterThan(0);
      expect(reg.labelEn.length).toBeGreaterThan(0);
      for (const t of reg.faceIndices) {
        coveredTris.add(t);
      }
    }
    expect(coveredTris.size).toBe(result.totalTriangles);

    // Verificar clasificación de arquetipos clave del buzo
    const archetypes = result.regions.map((r) => r.archetype);
    expect(archetypes).toContain('main_body');
    expect(archetypes).toContain('dome_helmet');
    expect(archetypes.filter((a) => a === 'tank_cylinder').length).toBe(2);
    expect(archetypes).toContain('tube_conduit');
  });

  it('applyStructureColorsToMesh pinta todos los triángulos con los colores de sus regiones', async () => {
    const diverMesh = await buildDiverCompositeMesh();
    const diverObj = makeSceneObject('diver_colors', diverMesh);
    const seg = await detectStructuralRegions(diverObj);

    const colored = applyStructureColorsToMesh(diverMesh, seg);
    const triCount = Math.floor(diverMesh.indices.length / 3);

    expect(colored.faceColors).toBeDefined();
    expect(colored.faceColors!.length).toBe(triCount);

    const distinctColors = new Set(colored.faceColors);
    expect(distinctColors.size).toBe(seg.regions.length);

    for (const reg of seg.regions) {
      for (const t of reg.faceIndices) {
        expect(colored.faceColors![t]).toBe(reg.color);
      }
    }
  });

  it('extractStructuralRegion extrae un sub-componente sólido cerrado y genera remanente opcional', async () => {
    const diverMesh = await buildDiverCompositeMesh();
    const diverObj = makeSceneObject('diver_extract', diverMesh, {
      position: [15, 0, -10],
    });
    const seg = await detectStructuralRegions(diverObj);

    const tankRegion = seg.regions.find((r) => r.archetype === 'tank_cylinder');
    expect(tankRegion).toBeDefined();

    const { extracted, remainder } = await extractStructuralRegion(
      diverObj,
      tankRegion!,
      true
    );

    const extStats = computeMeshStats(extracted.mesh);
    expect(extStats.triangles).toBeGreaterThan(20);
    expect(extStats.volumeMm3).toBeGreaterThan(500);
    expect(extStats.isManifold).toBe(true);

    expect(remainder).toBeDefined();
    expect(remainder).not.toBeNull();
    const remStats = computeMeshStats(remainder!.mesh);
    expect(remStats.triangles).toBeGreaterThan(50);
    expect(remStats.volumeMm3).toBeGreaterThan(5000);
    expect(remStats.isManifold).toBe(true);
  });

  it('splitAllDetectedStructures separa todas las sub-estructuras en piezas independientes válidas', async () => {
    const diverMesh = await buildDiverCompositeMesh();
    const diverObj = makeSceneObject('diver_split', diverMesh);
    const seg = await detectStructuralRegions(diverObj);

    const parts = await splitAllDetectedStructures(diverObj, seg);
    expect(parts.length).toBe(seg.regions.length);
    expect(parts.length).toBeGreaterThanOrEqual(4);

    for (const part of parts) {
      const stats = computeMeshStats(part.mesh);
      expect(stats.triangles).toBeGreaterThan(0);
      expect(stats.volumeMm3).toBeGreaterThan(50);
      expect(stats.isManifold).toBe(true);
      expect(part.mesh.faceColors?.length).toBe(stats.triangles);
    }
  });

  it('detecta cáscaras desconectadas como islas independientes y las extrae con isDisconnectedShell = true', async () => {
    const wasm = await initManifoldEngine();
    const handles: Manifold[] = [];
    try {
      const box = wasm.Manifold.cube([20, 20, 20], true);
      const sphereRaw = wasm.Manifold.sphere(8, 24);
      const sphere = sphereRaw.translate([40, 0, 0]);
      const combined = wasm.Manifold.union([box, sphere]);
      handles.push(box, sphereRaw, sphere, combined);

      const mesh = normalizeMeshToBed(manifoldToMeshData(combined));
      const obj = makeSceneObject('two_shells', mesh);
      const seg = await detectStructuralRegions(obj);

      expect(seg.regions.length).toBe(2);
      expect(seg.regions.every((r) => r.isDisconnectedShell)).toBe(true);

      const dome = seg.regions.find((r) => r.archetype === 'dome_helmet');
      expect(dome).toBeDefined();

      const { extracted } = await extractStructuralRegion(obj, dome!, false);
      const stats = computeMeshStats(extracted.mesh);
      expect(stats.isManifold).toBe(true);
      const analyticalSphereVol = (4 / 3) * Math.PI * 8 ** 3;
      expect(stats.volumeMm3).toBeGreaterThan(analyticalSphereVol * 0.94);
      expect(stats.volumeMm3).toBeLessThanOrEqual(analyticalSphereVol);
    } finally {
      for (const h of handles) h.delete();
    }
  });

  it('mirrorMeshAxis refleja en X, Y y Z manteniendo isManifold: true, volumen exacto y faceColors', async () => {
    const diverMesh = await buildDiverCompositeMesh();
    const diverObj = makeSceneObject('diver_mirror', diverMesh);
    const seg = await detectStructuralRegions(diverObj);
    const colored = applyStructureColorsToMesh(diverMesh, seg);
    const origStats = computeMeshStats(colored);

    for (const axis of ['x', 'y', 'z'] as const) {
      const mirrored = mirrorMeshAxis(colored, axis);
      const mirStats = computeMeshStats(mirrored);

      expect(mirStats.isManifold).toBe(true);
      expect(mirStats.triangles).toBe(origStats.triangles);
      expect(mirStats.volumeMm3).toBeCloseTo(origStats.volumeMm3, 1);
      expect(mirrored.faceColors).toEqual(colored.faceColors);

      // Verificar apoyo en la cama Y >= 0
      let minY = Infinity;
      for (let i = 1; i < mirrored.positions.length; i += 3) {
        if (mirrored.positions[i] < minY) minY = mirrored.positions[i];
      }
      expect(minY).toBeCloseTo(0, 4);
    }

    // Comprobar que el tubo en +X del buzo ahora queda en el lado opuesto tras mirror X
    const tubeOrig = seg.regions.find((r) => r.archetype === 'tube_conduit')!;
    const mirroredX = mirrorMeshAxis(colored, 'x');
    const segMirX = await detectStructuralRegions(makeSceneObject('mir_x', mirroredX));
    const tubeMir = segMirX.regions.find((r) => r.archetype === 'tube_conduit')!;
    expect(tubeOrig.centerMm[0] * tubeMir.centerMm[0]).toBeLessThan(0);
  });

  it('maneja mallas vacías y primitivas individuales simples sin errores', async () => {
    const emptyObj = makeSceneObject('empty', {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
    });
    const emptyRes = await detectStructuralRegions(emptyObj);
    expect(emptyRes.regions).toEqual([]);
    expect(emptyRes.totalTriangles).toBe(0);

    const boxMesh = await createPrimitiveMesh('box', { width: 20, height: 20, depth: 20 });
    const boxObj = makeSceneObject('single_box', boxMesh);
    const boxSeg = await detectStructuralRegions(boxObj, { maxRegions: 4 });
    expect(boxSeg.regions.length).toBe(1);
    expect(boxSeg.regions[0].archetype).toBe('main_body');
  });
});
