/**
 * @file src/engine/pipeCoupling.ts
 * @description Acople de tubería: sólidos de macho y hembra (roscados o a presión) en posición de armado, mallas para
 * imprimir (las dos mitades apoyadas en su tramo liso, boca o espiga hacia arriba: sin soportes) y verificación. La
 * roscada se mide con `screwFit.ts` (desenroscando por la hélice); la de presión, con la hembra a tope en el hombro:
 * volumen de intersección y holgura mínima (`minGap`) sin contar el asiento. Medidas en `pipeCouplingLayout.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { containerThreadMesh } from './containerThread';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from './manifoldKernel';
import {
  layoutPipeCoupling,
  PIPE_COUPLING_DEFAULTS,
  PIPE_COUPLING_DEFAULT_CLEARANCE,
  PIPE_COUPLING_MIN_WALL_MM,
  PRESS_FLARE_MM,
  resolvePipeCoupling,
  type PipeCouplingJoint,
  type PipeCouplingLayout,
  type PipeCouplingOptions,
} from './pipeCouplingLayout';
import {
  checkScrewFitSolids,
  screwFitStatus,
  SCREW_FIT_INTERFERENCE_TOL_MM3,
  SCREW_FIT_SEARCH_MM,
  type ScrewFitReport,
} from './screwFit';
import { withWasmScope, type WasmScope } from './wasmScope';

/** Franja sobre el hombro que no cuenta para la holgura: ahí la hembra apoya a propósito (mm). */
const SEAT_CLIP_MM = 0.3;

function frustum(wasm: ManifoldToplevel, scope: WasmScope, z0: number, z1: number, r0: number, r1: number, n: number): Manifold {
  return scope.track(scope.track(wasm.Manifold.cylinder(z1 - z0, r0, r1, n, false)).translate([0, 0, z0]));
}

/** Espiga del macho (sin tramo liso ni paso) y negativo del enchufe de la hembra, según la unión. */
function jointShapes(wasm: ManifoldToplevel, scope: WasmScope, L: PipeCouplingLayout): { spigot: Manifold; socket: Manifold } {
  const N = L.columns;
  const seat = L.seatZ;
  const top = seat + L.engageLengthMm;
  if (L.thread) {
    const { profile, tap, rootRadiusMm: root, majorRadiusMm: major } = L.thread;
    const thread = (rMin: number, rMaj: number, z0: number, z1: number, breaks: typeof tap.tapBreaks) =>
      scope.track(meshDataToManifold(wasm, containerThreadMesh(profile, rMin, rMaj, z0, z1, N, breaks)));
    // Macho: rosca con bisel de entrada a 45° en la punta (igual que el cuello del recipiente).
    const raw = thread(root, major, seat - 0.5, top, tap.maleBreaks);
    const bevelTopR = root + 0.25 * profile.depthMm;
    const bevelBottomZ = top - (major + 0.2 - bevelTopR);
    const envelope = scope.track(wasm.Manifold.union([
      frustum(wasm, scope, seat - 1, bevelBottomZ, major + 0.2, major + 0.2, N),
      frustum(wasm, scope, bevelBottomZ, top + 1, major + 0.2, bevelTopR - 1, N),
    ]));
    const spigot = scope.track(raw.intersect(envelope));
    // Hembra: rosca hembra con la holgura + bisel de la boca a 45°.
    const c = L.effClearanceMm;
    const female = thread(root + c, major + c, seat - 1, seat + L.socketDepthMm, tap.tapBreaks);
    const mouthR = major + c - 0.1 * profile.depthMm;
    const mouth = frustum(wasm, scope, seat - 1, seat + (mouthR - root - c), mouthR + 1, root + c, N);
    return { spigot, socket: scope.track(female.add(mouth)) };
  }
  const k = L.taper ?? 0;
  const rAt = (z: number) => L.spigotBaseRadiusMm - (z - seat) * k;
  // Macho: espiga cónica (base ancha en el hombro) con chaflán de entrada en la punta.
  const raw = frustum(wasm, scope, seat - 0.5, top, rAt(seat - 0.5), rAt(top), N);
  const ch = Math.min(0.4, 0.25 * (L.spigotTipRadiusMm - L.boreRadiusMm));
  const tipR = L.spigotTipRadiusMm;
  const reach = L.outerRadiusMm + 2;
  const envelope = scope.track(wasm.Manifold.union([
    frustum(wasm, scope, seat - 1, top - ch, reach, reach, N),
    frustum(wasm, scope, top - ch - reach, top + 1, tipR + reach, tipR - ch - 1, N),
  ]));
  const spigot = scope.track(raw.intersect(envelope));
  // Hembra: el mismo cono con la holgura y la boca ensanchada a 45°.
  const c = L.effClearanceMm;
  const bottom = seat + L.socketDepthMm;
  const cone = frustum(wasm, scope, seat - 1, bottom, rAt(seat - 1) + c, rAt(bottom) + c, N);
  const flare = frustum(wasm, scope, seat - 1, seat + PRESS_FLARE_MM, rAt(seat) + c + PRESS_FLARE_MM + 1, rAt(seat) + c - 0.01, N);
  return { spigot, socket: scope.track(cone.add(flare)) };
}

/** Macho y hembra en posición de armado (hembra a tope en el hombro), eje Z. Quien llama libera los dos. */
export function buildPipeCouplingSolids(wasm: ManifoldToplevel, spec: PipeCouplingOptions): { male: Manifold; female: Manifold; layout: PipeCouplingLayout } {
  const L = layoutPipeCoupling(spec);
  const N = L.columns;
  return withWasmScope((scope) => {
    const { spigot, socket } = jointShapes(wasm, scope, L);
    const total = L.seatZ + L.femaleHeightMm;
    const bore = frustum(wasm, scope, -1, total + 1, L.boreRadiusMm, L.boreRadiusMm, N);
    const tail = frustum(wasm, scope, 0, L.seatZ, L.outerRadiusMm, L.outerRadiusMm, N);
    const male = scope.track(scope.track(tail.add(spigot)).subtract(bore));
    const shell = frustum(wasm, scope, L.seatZ, total, L.outerRadiusMm, L.outerRadiusMm, N);
    const female = scope.track(scope.track(shell.subtract(socket)).subtract(bore));
    return { male: scope.keep(male), female: scope.keep(female), layout: L };
  });
}

/** Malla en Y arriba (ejes internos), apoyada en Y = 0, eje en X = Z = 0. */
function toBedMesh(m: Manifold): MeshData {
  const rotated = m.rotate([-90, 0, 0]);
  try {
    const mesh = manifoldToMeshData(rotated);
    const minY = rotated.boundingBox().min[1];
    for (let v = 1; v < mesh.positions.length; v += 3) mesh.positions[v] -= minY;
    return mesh;
  } finally {
    rotated.delete();
  }
}

/** Genera macho y hembra para imprimir: cada uno apoyado en su tramo liso, centrados en su eje. */
export async function createPipeCoupling(options: Partial<PipeCouplingOptions>): Promise<{ male: MeshData; female: MeshData; spec: PipeCouplingOptions; layout: PipeCouplingLayout }> {
  const spec = resolvePipeCoupling(options);
  const wasm = await initManifoldEngine();
  const { male, female, layout } = buildPipeCouplingSolids(wasm, spec);
  try {
    const flipped = female.rotate([180, 0, 0]);
    try {
      return { male: toBedMesh(male), female: toBedMesh(flipped), spec, layout };
    } finally {
      flipped.delete();
    }
  } finally {
    male.delete();
    female.delete();
  }
}

/**
 * Encaje a presión: hembra a tope, volumen de intersección y holgura mínima sobre `clipBelowZ` (el asiento toca a
 * propósito). Una sola posición: con la conicidad, cualquier posición menos metida tiene más holgura. No libera nada.
 */
export function checkPressFitSolids(wasm: ManifoldToplevel, male: Manifold, female: Manifold, clipBelowZ: number): ScrewFitReport {
  return withWasmScope((scope) => {
    const big = 1e5;
    const keep = scope.track(scope.track(wasm.Manifold.cube([big, big, big], false)).translate([-big / 2, -big / 2, clipBelowZ]));
    const vol = Math.max(0, scope.track(male.intersect(female)).volume());
    const interfering = vol > SCREW_FIT_INTERFERENCE_TOL_MM3;
    const gap = interfering ? 0 : scope.track(male.intersect(keep)).minGap(scope.track(female.intersect(keep)), SCREW_FIT_SEARCH_MM);
    const clearanceMm = Math.round(Math.min(gap, SCREW_FIT_SEARCH_MM) * 1000) / 1000;
    const interferenceMm3 = Math.round(vol * 1e4) / 1e4;
    const status = screwFitStatus(clearanceMm, interferenceMm3);
    return { status, fits: status === 'ok', minClearanceMm: clearanceMm, maxInterferenceMm3: interferenceMm3, positions: [{ turns: 0, interferenceMm3, clearanceMm }] };
  });
}

export interface PipeCouplingFitReport extends ScrewFitReport {
  readonly joint: PipeCouplingJoint;
  /** Pared más delgada (mm) y si queda bajo el mínimo imprimible (`PIPE_COUPLING_MIN_WALL_MM`). */
  readonly minWallMm: number;
  readonly thinWall: boolean;
}

/**
 * Verificación del acople: roscado → desenrosca por la hélice en `samples` posiciones (`screwFit.ts`); a presión →
 * hembra a tope. `trusted` acepta un `spec` ya resuelto sin revalidar rangos (pruebas con holgura negativa).
 */
export async function pipeCouplingFit(
  options: Partial<PipeCouplingOptions>,
  { samples = 6, trusted = false }: { samples?: number; trusted?: boolean } = {},
): Promise<PipeCouplingFitReport> {
  const spec = trusted
    ? ({ ...PIPE_COUPLING_DEFAULTS, clearanceMm: PIPE_COUPLING_DEFAULT_CLEARANCE[options.joint ?? 'thread'], ...options } as PipeCouplingOptions)
    : resolvePipeCoupling(options);
  const wasm = await initManifoldEngine();
  const { male, female, layout } = buildPipeCouplingSolids(wasm, spec);
  try {
    const clip = layout.seatZ + SEAT_CLIP_MM;
    const report = layout.thread
      ? checkScrewFitSolids(wasm, male, female, { leadMm: layout.leadMm, turns: Math.min(spec.turns, 1), samples, direction: 1, clipBelowZ: clip })
      : checkPressFitSolids(wasm, male, female, clip);
    return { ...report, joint: spec.joint, minWallMm: layout.minWallMm, thinWall: layout.minWallMm < PIPE_COUPLING_MIN_WALL_MM };
  } finally {
    male.delete();
    female.delete();
  }
}
