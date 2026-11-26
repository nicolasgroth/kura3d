/**
 * @file src/engine/__tests__/smoothZoneFalloff.test.ts
 * @description Cota de la transición de una zona de «Suavizar malla»: con `falloffRings` R, fuera de los triángulos
 * de la zona solo se mueven los vértices a ≤ R aristas de ella (anillos de transición, por diseño), con peso
 * 1 − r/(R+1); con R = 0 no se mueve nada fuera de la zona. Reproduce el caso «zona en la mitad x > 0, falloff 2».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { smoothMesh } from '../smooth';
import { buildSmoothGraph } from '../smooth/smoothGraph';
import { resolveSmoothOptions } from '../smooth/smoothOptions';
import { uvSphere, withRadialNoise } from './smoothFixtures';

/** Anillo (distancia en aristas) de cada vértice soldado a la zona; −1 = más lejos que `max`. */
function ringsFromZone(mesh: MeshData, tris: number[], max: number): { weld: Uint32Array; ring: Int32Array } {
  const g = buildSmoothGraph(mesh, resolveSmoothOptions({ preserveSharpEdges: false }));
  const ring = new Int32Array(g.weldedCount).fill(-1);
  let frontier: number[] = [];
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const w = g.weld[mesh.indices[t * 3 + k]];
    if (ring[w] === -1) { ring[w] = 0; frontier.push(w); }
  }
  for (let r = 1; r <= max; r++) {
    const next: number[] = [];
    for (const v of frontier) for (let j = g.nbrStart[v]; j < g.nbrStart[v + 1]; j++) {
      const u = g.nbr[j];
      if (ring[u] === -1) { ring[u] = r; next.push(u); }
    }
    frontier = next;
  }
  return { weld: g.weld, ring };
}

function displacement(a: MeshData, b: MeshData, v: number): number {
  return Math.hypot(b.positions[v * 3] - a.positions[v * 3], b.positions[v * 3 + 1] - a.positions[v * 3 + 1], b.positions[v * 3 + 2] - a.positions[v * 3 + 2]);
}

describe('zona pintada: la transición queda acotada a los anillos pedidos', () => {
  const mesh = withRadialNoise(uvSphere(20, 96, 48), 0.3);
  const zone: number[] = [];
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    const cx = [0, 1, 2].reduce((s, k) => s + mesh.positions[mesh.indices[t * 3 + k] * 3], 0) / 3;
    if (cx > 0) zone.push(t);
  }

  it.each([0, 2, 5])('falloff %i: nada se mueve a más de R anillos de la zona y el anillo r se mueve menos que dentro', (R) => {
    const out = smoothMesh(mesh, { preserveSharpEdges: false, zone: { triangles: zone, falloffRings: R } }).mesh;
    const { weld, ring } = ringsFromZone(mesh, zone, R);
    const sum = new Float64Array(R + 1), n = new Uint32Array(R + 1);
    let outsideMoved = 0;
    for (let v = 0; v < weld.length; v++) {
      const r = ring[weld[v]];
      const d = displacement(mesh, out, v);
      if (r === -1) { if (d > 0) outsideMoved++; continue; }
      sum[r] += d;
      n[r]++;
    }
    expect(outsideMoved).toBe(0);
    // El desplazamiento medio baja de la zona hacia afuera (sin escalón: el anillo R aún se mueve si R > 0).
    for (let r = 1; r <= R; r++) {
      expect(n[r]).toBeGreaterThan(0);
      expect(sum[r] / n[r]).toBeLessThan(sum[0] / n[0]);
      expect(sum[r]).toBeGreaterThan(0);
    }
  });
});
