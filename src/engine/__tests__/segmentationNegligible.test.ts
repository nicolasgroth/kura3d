/**
 * @file src/engine/__tests__/segmentationNegligible.test.ts
 * @description La segmentación estructural no lista partes de grosor cero ni de volumen
 * despreciable: una escalera de bloques unidos producía una "placa" de 40 × 0 × 40 mm (solo el
 * anillo plano del escalón). Esas regiones se absorben en su vecina sin perder triángulos y cada
 * pieza dividida conserva volumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject } from '../../types/kura';
import {
  computeMeshStats,
  detectStructuralRegions,
  initManifoldEngine,
  manifoldToMeshData,
  normalizeMeshToBed,
  splitAllDetectedStructures,
} from '../index';
import { isNegligibleRegionBox, NEGLIGIBLE_THICKNESS_REL, NEGLIGIBLE_VOLUME_REL } from '../segmentation/negligibleRegions';

const object = (mesh: MeshData): SceneObject => ({
  id: 'steps', name: 'steps', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#38bdf8', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
});

async function steps(): Promise<MeshData> {
  const w = await initManifoldEngine();
  const hs: Manifold[] = [];
  const own = (m: Manifold) => (hs.push(m), m);
  try {
    const fused = own(w.Manifold.union([
      own(w.Manifold.cube([40, 10, 40], false)),
      own(w.Manifold.cube([20, 20, 20], false)),
      own(w.Manifold.cube([10, 30, 10], false)),
    ]));
    return normalizeMeshToBed(manifoldToMeshData(fused));
  } finally {
    hs.forEach((h) => h.delete());
  }
}

describe('segmentación: sin partes de grosor cero', () => {
  it('umbral relativo documentado', () => {
    // Una cara plana (grosor 0) es despreciable; una aleta real de 1 mm en un modelo de 200 mm no.
    expect(isNegligibleRegionBox([40, 0, 40], [40, 30, 40])).toBe(true);
    expect(isNegligibleRegionBox([200, 1, 40], [200, 200, 200])).toBe(false);
    expect(isNegligibleRegionBox([0.01, 0.01, 0.01], [100, 100, 100])).toBe(true);
    expect(NEGLIGIBLE_THICKNESS_REL).toBeLessThanOrEqual(1e-3);
    expect(NEGLIGIBLE_VOLUME_REL).toBeLessThanOrEqual(1e-6);
  });

  it('escalera de bloques: ninguna región de grosor cero y todos los triángulos asignados', async () => {
    const mesh = await steps();
    const seg = await detectStructuralRegions(object(mesh));
    expect(seg.regions.length).toBeGreaterThan(0);
    for (const r of seg.regions) expect(Math.min(...r.dimensionsMm)).toBeGreaterThan(0.1);
    const assigned = seg.regions.reduce((n, r) => n + r.triangleCount, 0);
    expect(assigned).toBe(seg.totalTriangles);
    const faces = new Set(seg.regions.flatMap((r) => r.faceIndices));
    expect(faces.size).toBe(seg.totalTriangles);
  });

  it('cada pieza dividida tiene volumen', async () => {
    const mesh = await steps();
    const obj = object(mesh);
    const parts = await splitAllDetectedStructures(obj, await detectStructuralRegions(obj));
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) expect(computeMeshStats(p.mesh).volumeMm3).toBeGreaterThan(1);
  });
});
