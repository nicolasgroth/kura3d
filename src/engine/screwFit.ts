/**
 * @file src/engine/screwFit.ts
 * @description Comprobación reutilizable de enroscado entre una pieza macho y una hembra (recipiente y tapa, perno y
 * tuerca, después el acople de tubería). Con la hembra en su posición enroscada final, la mueve hacia atrás por la
 * hélice (girar α y avanzar avance·α/2π) en varias posiciones y en cada una mide con Manifold el volumen de
 * intersección y la holgura mínima (`minGap`). El asiento (la cara donde la tapa llega a tope) se excluye de la
 * holgura con `clipBelowZ`: allí el contacto es a propósito. Eje de la rosca: Z por el origen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { requireNumberInRange } from './engineErrors';
import { initManifoldEngine, meshDataToManifold } from './manifoldKernel';
import { OPERATION_RANGES } from './operationLimits';
import { withWasmScope } from './wasmScope';

const R = OPERATION_RANGES.screwFit;

/** Volumen de intersección (mm³) por debajo del cual se considera contacto, no interferencia. */
export const SCREW_FIT_INTERFERENCE_TOL_MM3 = 1e-3;
/** Holgura mínima (mm) que se pide para dar por buena la pareja impresa: menos que esto se suelda al imprimir. */
export const SCREW_FIT_MIN_CLEARANCE_MM = 0.1;
/** Tope de búsqueda de la holgura (mm): más lejos se informa este valor. */
export const SCREW_FIT_SEARCH_MM = 1;

export interface ScrewFitOptions {
  /** Avance por vuelta (mm). */
  readonly leadMm: number;
  /** Vueltas que se desenrosca la hembra para medir (las posiciones van de 0 a este valor, sin incluirlo). */
  readonly turns: number;
  /** Posiciones donde se mide la interferencia (incluida la final). Por defecto 6. */
  readonly samples?: number;
  /** +1 si la hembra sale hacia +Z (tapa arriba), −1 si sale hacia −Z. */
  readonly direction?: 1 | -1;
  /** Z bajo la cual no se mide holgura (asiento de la tapa). */
  readonly clipBelowZ?: number;
}

export type ScrewFitStatus = 'ok' | 'tight' | 'interference';

export interface ScrewFitPosition {
  /** Vueltas desenroscadas desde la posición final. */
  readonly turns: number;
  readonly interferenceMm3: number;
  /**
   * Holgura mínima en esta posición, o null si no se midió: se mide en la posición final y a media carrera (la malla es
   * invariante ante el movimiento de tornillo, así que la holgura casi no cambia por la hélice; la interferencia sí se
   * mide en todas, porque es la que delata un perfil que no calza).
   */
  readonly clearanceMm: number | null;
}

export interface ScrewFitReport {
  readonly status: ScrewFitStatus;
  /** `true` solo con `status: 'ok'`. */
  readonly fits: boolean;
  /** Holgura mínima medida en todas las posiciones (mm, tope `SCREW_FIT_SEARCH_MM`). */
  readonly minClearanceMm: number;
  /** Mayor volumen de intersección (mm³). */
  readonly maxInterferenceMm3: number;
  readonly positions: readonly ScrewFitPosition[];
}

const round = (v: number, k: number) => Math.round(v * 10 ** k) / 10 ** k;

/** Estado según la peor posición. */
export function screwFitStatus(minClearanceMm: number, maxInterferenceMm3: number): ScrewFitStatus {
  if (maxInterferenceMm3 > SCREW_FIT_INTERFERENCE_TOL_MM3) return 'interference';
  if (minClearanceMm < SCREW_FIT_MIN_CLEARANCE_MM) return 'tight';
  return 'ok';
}

/**
 * Mide el enroscado de `female` (en su posición final) sobre `male`. No libera las entradas.
 * @throws EngineError `INVALID_PARAMETER` con avance, vueltas o posiciones fuera de rango.
 */
export function checkScrewFitSolids(wasm: ManifoldToplevel, male: Manifold, female: Manifold, options: ScrewFitOptions): ScrewFitReport {
  const lead = requireNumberInRange('leadMm', options.leadMm, R.leadMm.min, R.leadMm.max);
  const turns = requireNumberInRange('turns', options.turns, R.turns.min, R.turns.max);
  const samples = Math.round(requireNumberInRange('samples', options.samples ?? 6, R.samples.min, R.samples.max));
  const dir = options.direction ?? 1;
  return withWasmScope((scope) => {
    const big = 1e5;
    const clip = options.clipBelowZ;
    const keepAbove = clip === undefined ? null : scope.track(scope.track(wasm.Manifold.cube([big, big, big], false)).translate([-big / 2, -big / 2, clip]));
    // El asiento se recorta una sola vez, en la posición final: la tapa recortada se mueve con su hélice.
    const maleClipped = keepAbove ? scope.track(male.intersect(keepAbove)) : male;
    const femaleClipped = keepAbove ? scope.track(female.intersect(keepAbove)) : female;
    const positions: ScrewFitPosition[] = [];
    const screwed = (m: Manifold, t: number) => scope.track(scope.track(m.rotate([0, 0, dir * 360 * t])).translate([0, 0, dir * lead * t]));
    const half = Math.floor(samples / 2);
    for (let k = 0; k < samples; k++) {
      const t = (turns * k) / samples;
      const vol = Math.max(0, scope.track(male.intersect(screwed(female, t))).volume());
      const measure = k === 0 || k === half || vol > SCREW_FIT_INTERFERENCE_TOL_MM3;
      const gap = vol > SCREW_FIT_INTERFERENCE_TOL_MM3 ? 0 : measure ? maleClipped.minGap(screwed(femaleClipped, t), SCREW_FIT_SEARCH_MM) : null;
      positions.push({ turns: round(t, 4), interferenceMm3: round(vol, 4), clearanceMm: gap === null ? null : round(Math.min(gap, SCREW_FIT_SEARCH_MM), 3) });
    }
    const minClearanceMm = Math.min(...positions.flatMap((p) => (p.clearanceMm === null ? [] : [p.clearanceMm])));
    const maxInterferenceMm3 = Math.max(...positions.map((p) => p.interferenceMm3));
    const status = screwFitStatus(minClearanceMm, maxInterferenceMm3);
    return { status, fits: status === 'ok', minClearanceMm, maxInterferenceMm3, positions };
  });
}

export interface ScrewFitMeshOptions extends Omit<ScrewFitOptions, 'direction' | 'clipBelowZ'> {
  /** Eje de la rosca en coordenadas de la malla (0 = X, 1 = Y, 2 = Z). */
  readonly axis: 0 | 1 | 2;
  /** Punto por donde pasa el eje (coordenadas de la malla). */
  readonly center: readonly [number, number, number];
  /**
   * Franja (mm) desde la cara de entrada de la hembra que no cuenta para la holgura: el asiento donde la tapa o la
   * tuerca llega a tope toca a propósito. Por defecto 0,3 mm. La interferencia se mide en toda la pieza.
   */
  readonly seatMm?: number;
}

/** Lleva `axis` a Z y `center` al origen (permutación cíclica: conserva la lateralidad); `flip` gira 180° en X. */
function toAxisFrame(mesh: MeshData, axis: 0 | 1 | 2, center: readonly [number, number, number], flip: boolean): MeshData {
  const p = mesh.positions;
  const out = new Float32Array(p.length);
  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  const s = flip ? -1 : 1;
  for (let i = 0; i < p.length; i += 3) {
    out[i] = p[i + a] - center[a];
    out[i + 1] = s * (p[i + b] - center[b]);
    out[i + 2] = s * (p[i + axis] - center[axis]);
  }
  return { positions: out, indices: mesh.indices };
}

function axisMid(mesh: MeshData, axis: 0 | 1 | 2): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < mesh.positions.length; i += 3) {
    lo = Math.min(lo, mesh.positions[i]);
    hi = Math.max(hi, mesh.positions[i]);
  }
  return (lo + hi) / 2;
}

/**
 * Igual que `checkScrewFitSolids` para dos mallas cerradas ya colocadas en su posición enroscada (mismo marco). Si la
 * hembra queda «abajo» del macho a lo largo del eje, las dos se giran 180° (giro propio: la hélice conserva su sentido)
 * para que la hembra salga siempre hacia +Z.
 */
export async function checkScrewFitMeshes(male: MeshData, female: MeshData, options: ScrewFitMeshOptions): Promise<ScrewFitReport> {
  const wasm = await initManifoldEngine();
  const flip = axisMid(female, options.axis) < axisMid(male, options.axis);
  const m = toAxisFrame(male, options.axis, options.center, flip);
  const f = toAxisFrame(female, options.axis, options.center, flip);
  const seat = requireNumberInRange('seatMm', options.seatMm ?? 0.3, 0, 10);
  return withWasmScope((scope) => {
    const ms = scope.track(meshDataToManifold(wasm, m));
    const fs = scope.track(meshDataToManifold(wasm, f));
    return checkScrewFitSolids(wasm, ms, fs, { ...options, direction: 1, clipBelowZ: fs.boundingBox().min[2] + seat });
  });
}
