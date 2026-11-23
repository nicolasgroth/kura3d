/**
 * @file src/engine/__tests__/segmentationRegression.test.ts
 * @description Regresión de `detectStructuralRegions`: fija número de regiones, arquetipo, caja
 * envolvente (centro y dimensiones) y recuento de caras por región para tres mallas de referencia
 * (cubo+cilindro+esfera unidos, perno M8 generado por el motor y toro). Protege reorganizaciones
 * del módulo de segmentación: el resultado debe ser idéntico.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Manifold } from 'manifold-3d';
import type { MeshData, SceneObject } from '../../types/kura';
import {
  computeMeshStats,
  createMetricThread,
  createPrimitiveMesh,
  detectStructuralRegions,
  initManifoldEngine,
  manifoldToMeshData,
  normalizeMeshToBed,
} from '../index';

function makeObject(id: string, mesh: MeshData): SceneObject {
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
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Resumen estable y determinista del resultado de detección. */
async function summarize(id: string, mesh: MeshData) {
  const res = await detectStructuralRegions(makeObject(id, mesh));
  return {
    totalTriangles: res.totalTriangles,
    regions: res.regions.map((r) => ({
      archetype: r.archetype,
      faces: r.triangleCount,
      center: r.centerMm.map(r2),
      dims: r.dimensionsMm.map(r2),
      shell: r.isDisconnectedShell,
    })),
  };
}

/** Cubo + cilindro + esfera unidos por CSG en una sola cáscara. */
async function cubeCylinderSphere(): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const handles: Manifold[] = [];
  const own = (m: Manifold): Manifold => {
    handles.push(m);
    return m;
  };
  try {
    const cube = own(own(wasm.Manifold.cube([20, 20, 20], true)).translate([0, 10, 0]));
    const cyl = own(own(own(wasm.Manifold.cylinder(30, 5, 5, 32, false)).rotate([-90, 0, 0])).translate([14, 4, 0]));
    const sphere = own(own(wasm.Manifold.sphere(9, 32)).translate([-12, 24, 0]));
    const fused = own(wasm.Manifold.union([cube, cyl, sphere]));
    return normalizeMeshToBed(manifoldToMeshData(fused));
  } finally {
    for (const h of handles) h.delete();
  }
}

describe('detectStructuralRegions — regresión de resultados fijados', () => {
  it('cubo + cilindro + esfera unidos', async () => {
    expect(await summarize('ccs', await cubeCylinderSphere())).toMatchSnapshot();
  });

  it('perno M8 generado por el motor', async () => {
    const mesh = await createMetricThread({ kind: 'bolt', diameterMm: 8, lengthMm: 16, includeHead: true });
    expect(await summarize('bolt', mesh)).toMatchSnapshot();
  });

  it('toro', async () => {
    const mesh = await createPrimitiveMesh('torus', { outerRadius: 14, tubeRadius: 4, segments: 32 });
    expect(await summarize('torus', mesh)).toMatchSnapshot();
  });
});
