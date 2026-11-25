/**
 * @file src/core/addons/__tests__/surfaceNormalDense.perf.test.ts
 * @description Costo por consulta de la normal de superficie (lo que corre en cada `pointermove` al colocar un
 * agregado) sobre una esfera densa de ~500 mil triángulos: tras construir el índice una vez por malla, cada consulta
 * debe quedar bajo 3 ms (mediana). Informa también el costo de la versión anterior (recorrido completo) como referencia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../../types/kura';
import { averagedSurfaceNormal } from '../surfaceNormal';
import { denseSphere } from './denseMeshes';
import { legacyAveragedSurfaceNormal } from './surfaceNormalLegacy';

const QUERY_BUDGET_MS = 3;

describe('normal de superficie sobre malla densa (perf)', () => {
  it('esfera de ~500 mil triángulos: cada consulta bajo 3 ms', () => {
    const mesh = denseSphere(20, 360, 700);
    const tris = mesh.indices.length / 3;
    expect(tris).toBeGreaterThanOrEqual(500_000);
    const p = mesh.positions, idx = mesh.indices;
    const queries = Array.from({ length: 50 }, (_, s) => {
      const face = (s * 104_729) % tris;
      const [a, b, c] = [idx[face * 3] * 3, idx[face * 3 + 1] * 3, idx[face * 3 + 2] * 3];
      const point: Vec3 = [0, 1, 2].map((k) => (p[a + k] + p[b + k] + p[c + k]) / 3) as Vec3;
      const l = Math.hypot(...point);
      return { face, point, normal: point.map((v) => v / l) as Vec3 };
    });
    const tb = performance.now();
    averagedSurfaceNormal(mesh, queries[0].point, queries[0].normal, 4, undefined, queries[0].face);
    const buildMs = performance.now() - tb;
    // Calentamiento del JIT (en el visor corre decenas de veces por segundo).
    for (const q of queries.slice(0, 10)) averagedSurfaceNormal(mesh, q.point, q.normal, 4, undefined, q.face);
    // Mediana por consulta: resiste a una pausa del recolector o de la máquina en una consulta suelta.
    const times = queries.map((q) => {
      const t0 = performance.now();
      averagedSurfaceNormal(mesh, q.point, q.normal, 4, undefined, q.face);
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    const perQuery = times[times.length >> 1];
    const tl = performance.now();
    for (const q of queries.slice(0, 3)) legacyAveragedSurfaceNormal(mesh, q.point, q.normal, 4);
    const legacyPerQuery = (performance.now() - tl) / 3;
    console.info(`[perf] normal de superficie, ${tris} triángulos: índice ${buildMs.toFixed(0)} ms (una vez), consulta ${perQuery.toFixed(3)} ms (mediana), peor ${times[times.length - 1].toFixed(2)} ms; antes ${legacyPerQuery.toFixed(1)} ms por consulta`);
    expect(perQuery).toBeLessThan(QUERY_BUDGET_MS);
  });
});
