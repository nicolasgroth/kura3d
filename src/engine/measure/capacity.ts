/**
 * @file src/engine/measure/capacity.ts
 * @description Capacidad de un recipiente en su orientación actual: volumen del espacio vacío que el
 * sólido retiene por debajo de un nivel de llenado. Determinístico con Manifold: al aire de una caja
 * mayor que el objeto (caja − sólido) se le corta todo lo que está sobre el nivel, se separa en
 * cuerpos conexos y se descartan los que tocan los lados o el fondo de la caja (eso es "afuera").
 * Las cavidades selladas (no tocan ninguna cara de la caja aun sin cortar) se informan aparte y se
 * rellenan antes de medir. El nivel de rebalse de cada cuenca se halla con un barrido de niveles y
 * una bisección hasta `toleranceMm`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData, Vec3 } from '../../types/kura';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from '../manifoldKernel';
import { WasmScope, withWasmScope } from '../wasmScope';

/** Huella horizontal (ejes internos X y Z) de una cuenca. */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CapacityBasin {
  /** Altura del rebalse sobre la base del objeto (mm, Z del usuario). */
  overflowHeightMm: number;
  /** Capacidad máxima (mm³): lo retenido justo antes de rebalsar. */
  maxCapacityMm3: number;
  footprint: Footprint;
}

export interface CapacityOptions {
  /** Nivel de llenado sobre la base del objeto (mm). Sin valor: el rebalse de la cuenca elegida. */
  levelHeightMm?: number;
  /** Cuenca a medir (índice en `basins`, ordenadas de mayor a menor capacidad). */
  basinIndex?: number;
  /** Tolerancia de la bisección del rebalse (mm). */
  toleranceMm?: number;
  /** Devuelve la malla del líquido (para mostrarlo). */
  includeLiquidMesh?: boolean;
  onProgress?: (phase: string) => void;
}

export interface CapacityResult {
  /** Altura mínima y máxima del objeto (Y interno = Z del usuario, mm de mundo). */
  baseY: number;
  topY: number;
  /** Cuencas abiertas que retienen líquido, de mayor a menor capacidad. */
  basins: CapacityBasin[];
  /** Volúmenes de las cavidades cerradas (mm³): no cuentan como capacidad. */
  sealedCavitiesMm3: number[];
  basinIndex: number;
  /** Nivel medido sobre la base (mm) y lo que cabe hasta ahí en la cuenca elegida (mm³). */
  levelHeightMm: number;
  filledMm3: number;
  /** Malla del líquido en ejes de mundo internos, si se pidió y hay líquido. */
  liquid: MeshData | null;
}

/** Cuerpos más chicos que esto (o negativos: cáscaras invertidas) no cuentan. */
const MIN_VOLUME_MM3 = 1e-3;
/** Distancia al tope del último nivel del barrido (evita cortar justo en el plano del borde). */
const TOP_GAP_MM = 0.005;

export const CAPACITY_DEFAULTS = { toleranceMm: 0.05, scanLevels: 24, maxBasins: 8 } as const;

interface Retained {
  volume: number;
  box: { min: Vec3; max: Vec3 };
  part: Manifold;
}

const overlaps = (a: Footprint, b: Footprint) => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;
const footprintOf = (box: { min: Vec3; max: Vec3 }): Footprint => ({ minX: box.min[0], maxX: box.max[0], minZ: box.min[2], maxZ: box.max[2] });

/** Capacidad de `worldMesh` (malla cerrada en mm de mundo, Y interno arriba). */
export async function measureCapacity(worldMesh: MeshData, options: CapacityOptions = {}): Promise<CapacityResult> {
  const wasm = await initManifoldEngine();
  const tol = Math.max(1e-3, options.toleranceMm ?? CAPACITY_DEFAULTS.toleranceMm);
  return withWasmScope((scope) => {
    const solid = scope.track(meshDataToManifold(wasm, worldMesh));
    const bb = solid.boundingBox();
    const min = bb.min as Vec3, max = bb.max as Vec3;
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const margin = Math.max(2, diag * 0.02);
    const bigMin: Vec3 = [min[0] - margin, min[1] - margin, min[2] - margin];
    const bigSize: Vec3 = [max[0] - min[0] + 2 * margin, max[1] - min[1] + 2 * margin, max[2] - min[2] + 2 * margin];
    const bigMax: Vec3 = [bigMin[0] + bigSize[0], bigMin[1] + bigSize[1], bigMin[2] + bigSize[2]];
    const big = scope.track(scope.track(wasm.Manifold.cube(bigSize, false)).translate(bigMin));
    const half = margin / 2;
    const touchesSidesOrBottom = (b: { min: Vec3; max: Vec3 }) =>
      b.min[0] < bigMin[0] + half || b.max[0] > bigMax[0] - half || b.min[2] < bigMin[2] + half || b.max[2] > bigMax[2] - half ||
      b.min[1] < bigMin[1] + half;

    // Cavidades selladas: cuerpos de aire que no tocan ninguna cara de la caja. `decompose` separa
    // por cáscaras conexas: la cáscara del propio sólido sale con volumen negativo y se ignora.
    options.onProgress?.('capacity-sealed');
    const air = scope.track(big.subtract(solid));
    const sealed = scope.trackAll(air.decompose()).filter((p) => {
      const b = p.boundingBox() as { min: Vec3; max: Vec3 };
      return p.volume() > MIN_VOLUME_MM3 && !touchesSidesOrBottom(b) && b.max[1] < bigMax[1] - half;
    });
    const sealedCavitiesMm3 = sealed.map((p) => p.volume()).sort((a, b) => b - a);
    const openAir = sealed.length === 0 ? air : scope.track(air.subtract(scope.track(wasm.Manifold.union(sealed))));

    /** Cuerpos retenidos con nivel en `y` (mundo). Los registra en `local` para liberarlos. */
    const retainedAt = (y: number, local: WasmScope): Retained[] => {
      const cut = local.track(openAir.trimByPlane([0, -1, 0], -y));
      if (cut.isEmpty()) return [];
      return local
        .trackAll(cut.decompose())
        .map((part) => ({ part, box: part.boundingBox() as { min: Vec3; max: Vec3 }, volume: part.volume() }))
        .filter((r) => r.volume > MIN_VOLUME_MM3 && !touchesSidesOrBottom(r.box));
    };
    const volumesAt = (y: number, keep: (f: Footprint) => boolean): Array<{ volume: number; footprint: Footprint }> =>
      withWasmScope((local) =>
        retainedAt(y, local)
          .map((r) => ({ volume: r.volume, footprint: footprintOf(r.box) }))
          .filter((r) => keep(r.footprint)),
      );

    // Barrido de niveles (el último justo bajo el tope: sobre él nada puede quedar retenido).
    options.onProgress?.('capacity-scan');
    const n = CAPACITY_DEFAULTS.scanLevels;
    const levels = Array.from({ length: n }, (_, i) => (i === n - 1 ? max[1] - Math.min(tol / 2, TOP_GAP_MM) : min[1] + ((max[1] - min[1]) * (i + 1)) / n));
    const scan = levels.map((y) => volumesAt(y, () => true));

    // Cuencas: la de rebalse más alto primero; luego las que no se pisan con las ya halladas.
    options.onProgress?.('capacity-refine');
    const basins: CapacityBasin[] = [];
    const taken: Footprint[] = [];
    const free = (f: Footprint) => !taken.some((t) => overlaps(t, f));
    for (let guard = 0; guard < CAPACITY_DEFAULTS.maxBasins; guard++) {
      let idx = -1;
      for (let i = n - 1; i >= 0; i--) {
        if (scan[i].some((r) => free(r.footprint))) {
          idx = i;
          break;
        }
      }
      if (idx < 0) break;
      let lo = levels[idx];
      let hi = idx + 1 < n ? levels[idx + 1] : lo;
      while (hi - lo > tol) {
        const mid = (lo + hi) / 2;
        if (volumesAt(mid, free).length > 0) lo = mid;
        else hi = mid;
      }
      const found = volumesAt(lo, free);
      if (found.length === 0) break;
      for (const r of found) {
        basins.push({ overflowHeightMm: lo - min[1], maxCapacityMm3: r.volume, footprint: r.footprint });
        taken.push(r.footprint);
      }
    }
    basins.sort((a, b) => b.maxCapacityMm3 - a.maxCapacityMm3);

    const basinIndex = Math.min(Math.max(0, Math.floor(options.basinIndex ?? 0)), Math.max(0, basins.length - 1));
    const basin = basins[basinIndex];
    const base = { baseY: min[1], topY: max[1], basins, sealedCavitiesMm3, basinIndex };
    if (!basin) return { ...base, levelHeightMm: 0, filledMm3: 0, liquid: null };
    const level = Math.min(Math.max(0, options.levelHeightMm ?? basin.overflowHeightMm), basin.overflowHeightMm);
    return withWasmScope((local) => {
      const parts = retainedAt(min[1] + level, local).filter((r) => overlaps(footprintOf(r.box), basin.footprint));
      const filledMm3 = parts.reduce((s, r) => s + r.volume, 0);
      let liquid: MeshData | null = null;
      if (options.includeLiquidMesh && parts.length > 0) {
        const merged = parts.length === 1 ? parts[0].part : local.track(wasm.Manifold.union(parts.map((r) => r.part)));
        liquid = manifoldToMeshData(merged);
      }
      return { ...base, levelHeightMm: level, filledMm3, liquid };
    });
  });
}
