/**
 * @file src/engine/__tests__/simplifyMeasureSupport.ts
 * @description Apoyo de la medición de Simplificar: por cuerpo cerrado, `Manifold.simplify` a varias tolerancias con
 * cambio de volumen, desviación máxima aproximada (Hausdorff muestreado en ambos sentidos con `three-mesh-bvh`),
 * cierre (`isMeshClosed`), género y tiempo; más la cota de lo plano y el indicio de primitivas del original y del
 * resultado a la menor tolerancia. Solo medición: no es código de la app (la desviación usa la misma función
 * que la verificación de Simplificar, `src/engine/simplify/simplifyDeviation.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshBVH } from 'three-mesh-bvh';
import type { MeshData } from '../../types/kura';
import { meshDataToManifold } from '../manifoldKernel';
import { isMeshClosed } from '../repair/meshTopology';
import { bvhOf, manifoldMesh, maxDistanceTo } from '../simplify';
import { planarStats } from './simplifyMeasurePlanar';
import { primitiveStats, type PrimitiveStats } from './simplifyMeasurePrimitives';

export const TOLERANCES_MM = [0.001, 0.005, 0.01, 0.05, 0.1];
const MAX_SAMPLES = 150_000;
/** Si una tolerancia tarda más que esto, no se prueban las siguientes de ese cuerpo. */
const SLOW_MS = 120_000;

export interface TolRow {
  tol: number;
  tris: number;
  volPct: number;
  hausdorffMm: number;
  closed: boolean;
  genusSame: boolean;
  ms: number;
}

export interface BodyReport {
  tris: number;
  volume: number;
  planarTris: number;
  planarMin: number;
  planarRegions: number;
  prim: PrimitiveStats;
  rows: TolRow[];
  /** Cota plana sobre el resultado de la menor tolerancia. */
  simpPlanarTris: number;
  simpPlanarMin: number;
  skipped?: string;
}

/** Máxima distancia de puntos muestreados (vértices y centroides de `from`) a la superficie de `to`. */
const maxDistance = (from: MeshData, to: MeshBVH): number => maxDistanceTo(from, to, MAX_SAMPLES).maxMm;

export function measureBody(wasm: ManifoldToplevel, input: MeshData): BodyReport {
  let original: Manifold;
  try {
    original = meshDataToManifold(wasm, input);
  } catch (e) {
    return emptyReport(Math.floor(input.indices.length / 3), `no se pudo cerrar: ${(e as Error).message}`);
  }
  try {
    if (original.isEmpty() || original.status() !== 'NoError') {
      return emptyReport(Math.floor(input.indices.length / 3), `Manifold: ${original.status()}`);
    }
    const mesh = manifoldMesh(original);
    const volume = original.volume();
    const genus = original.genus();
    const planar = planarStats(mesh);
    const prim = primitiveStats(mesh, planar);
    const origBvh = bvhOf(mesh);
    const rows: TolRow[] = [];
    let simpPlanarTris = 0, simpPlanarMin = 0;
    for (const tol of TOLERANCES_MM) {
      const t0 = performance.now();
      const s = original.simplify(tol);
      const ms = performance.now() - t0;
      try {
        const sm = manifoldMesh(s);
        const hausdorffMm = Math.max(maxDistance(mesh, bvhOf(sm)), maxDistance(sm, origBvh));
        rows.push({
          tol, tris: s.numTri(), volPct: ((s.volume() - volume) / volume) * 100, hausdorffMm,
          closed: isMeshClosed(sm.positions, sm.indices), genusSame: s.genus() === genus, ms,
        });
        if (tol === TOLERANCES_MM[0]) {
          const sp = planarStats(sm);
          simpPlanarTris = sp.planarTris;
          simpPlanarMin = sp.planarMin;
        }
      } finally {
        s.delete();
      }
      if (ms > SLOW_MS) break;
    }
    return {
      tris: original.numTri(), volume, planarTris: planar.planarTris, planarMin: planar.planarMin,
      planarRegions: planar.regions, prim, rows, simpPlanarTris, simpPlanarMin,
    };
  } finally {
    original.delete();
  }
}

function emptyReport(tris: number, skipped: string): BodyReport {
  return {
    tris, volume: 0, planarTris: 0, planarMin: 0, planarRegions: 0, rows: [], simpPlanarTris: 0, simpPlanarMin: 0,
    prim: { cylinderTris: 0, sphereTris: 0, cylinders: 0, spheres: 0, unfitTris: 0 }, skipped,
  };
}

/** Suma de los cuerpos de un archivo (las desviaciones se toman como máximo). */
export function combine(
  bodies: BodyReport[],
): BodyReport & { bodies: number; skippedBodies: number; skippedTris: number; skipReasons: string[] } {
  const ok = bodies.filter((b) => !b.skipped);
  const sum = (f: (b: BodyReport) => number) => ok.reduce((acc, b) => acc + f(b), 0);
  const volume = sum((b) => b.volume);
  const rows: TolRow[] = TOLERANCES_MM.flatMap((tol) => {
    const rs = ok.map((b) => b.rows.find((r) => r.tol === tol));
    if (!rs.length || rs.some((r) => !r)) return [];
    const all = rs as TolRow[];
    const newVol = ok.reduce((acc, b, k) => acc + b.volume * (1 + all[k].volPct / 100), 0);
    return [{
      tol, tris: all.reduce((a, r) => a + r.tris, 0), volPct: ((newVol - volume) / volume) * 100,
      hausdorffMm: Math.max(...all.map((r) => r.hausdorffMm)), closed: all.every((r) => r.closed),
      genusSame: all.every((r) => r.genusSame), ms: all.reduce((a, r) => a + r.ms, 0),
    }];
  });
  return {
    bodies: bodies.length, skippedBodies: bodies.length - ok.length,
    skippedTris: bodies.filter((b) => b.skipped).reduce((a, b) => a + b.tris, 0),
    skipReasons: [...new Set(bodies.flatMap((b) => (b.skipped ? [b.skipped] : [])))],
    tris: sum((b) => b.tris), volume, planarTris: sum((b) => b.planarTris), planarMin: sum((b) => b.planarMin),
    planarRegions: sum((b) => b.planarRegions), rows, simpPlanarTris: sum((b) => b.simpPlanarTris),
    simpPlanarMin: sum((b) => b.simpPlanarMin),
    prim: {
      cylinderTris: sum((b) => b.prim.cylinderTris), sphereTris: sum((b) => b.prim.sphereTris),
      cylinders: sum((b) => b.prim.cylinders), spheres: sum((b) => b.prim.spheres), unfitTris: sum((b) => b.prim.unfitTris),
    },
  };
}
