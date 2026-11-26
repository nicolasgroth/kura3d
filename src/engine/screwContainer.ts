/**
 * @file src/engine/screwContainer.ts
 * @description Recipiente con tapa roscada: cuerpo (base redonda o cuadrada, cavidad cilíndrica recta de las medidas
 * interiores pedidas) con cuello roscado de recipiente (`containerThread.ts`) y bisel de entrada; tapa con la rosca
 * hembra (holgura radial y axial), bisel en la boca, luz sobre el cuello y agarre (moleteado o caras planas). La tapa
 * llega a tope cuando su borde apoya en el hombro del cuerpo (asiento en Z = `seatZ`). El cuerpo sale apoyado en la
 * cama; la tapa, boca arriba (techo sobre la cama), así ninguna de las dos necesita soportes. `screwContainerFit`
 * mide con `screwFit.ts` que la tapa enrosque sin interferir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { EngineError, requireNumberInRange } from './engineErrors';
import { containerColumns, containerProfile, containerTapProfile, containerThreadMesh } from './containerThread';
import { initManifoldEngine, manifoldToMeshData, meshDataToManifold } from './manifoldKernel';
import { OPERATION_RANGES } from './operationLimits';
import { checkScrewFitSolids, type ScrewFitReport } from './screwFit';
import { withWasmScope, type WasmScope } from './wasmScope';

const R = OPERATION_RANGES.screwContainer;

export const SCREW_CONTAINER_GRIPS = ['none', 'knurl', 'flats'] as const;
export const SCREW_CONTAINER_BASES = ['round', 'square'] as const;
export type ScrewContainerGrip = (typeof SCREW_CONTAINER_GRIPS)[number];
export type ScrewContainerBase = (typeof SCREW_CONTAINER_BASES)[number];

export interface ScrewContainerOptions {
  readonly innerDiameterMm: number;
  readonly innerHeightMm: number;
  readonly wallMm: number;
  /** Fondo del cuerpo y techo de la tapa (mm). */
  readonly bottomMm: number;
  readonly pitchMm: number;
  readonly starts: number;
  /** Vueltas de rosca (largo roscado = vueltas × avance). */
  readonly turns: number;
  readonly radialClearanceMm: number;
  /** Juego axial por flanco (mm). */
  readonly axialClearanceMm: number;
  readonly flankAngleDeg: number;
  readonly grip: ScrewContainerGrip;
  readonly base: ScrewContainerBase;
}

export const SCREW_CONTAINER_DEFAULTS: ScrewContainerOptions = Object.freeze({
  innerDiameterMm: 50,
  innerHeightMm: 40,
  wallMm: 2,
  bottomMm: 2,
  pitchMm: 4,
  starts: 1,
  turns: 2,
  radialClearanceMm: 0.3,
  // Con flancos a 45° la holgura radial ya da 0,3 mm de juego axial; 0,45 deja ≈ 0,32 mm normal al flanco.
  axialClearanceMm: 0.45,
  flankAngleDeg: 45,
  grip: 'knurl',
  base: 'round',
});

/** Luz entre la boca del cuello y el techo de la tapa (mm): el tope es el hombro, no la boca. */
export const LID_TOP_GAP_MM = 0.6;
/** Profundidad del agarre (moleteado o caras planas) en la tapa (mm). */
export const GRIP_DEPTH_MM = 0.8;
/** Alto mínimo del cuerpo bajo el cuello por encima del fondo (mm). */
const MIN_BODY_BELOW_NECK_MM = 2;

function readEnum<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new EngineError('INVALID_PARAMETER', { name, value: String(value).slice(0, 32), min: 0, max: allowed.length - 1 });
}

/** Valida y completa las opciones con los valores por defecto. Errores tipados `INVALID_PARAMETER`. */
export function resolveScrewContainer(options: Partial<ScrewContainerOptions>): ScrewContainerOptions {
  const o = { ...SCREW_CONTAINER_DEFAULTS, ...stripUndefined(options) };
  const num = (k: keyof typeof R) => requireNumberInRange(k, o[k as keyof ScrewContainerOptions] as number, R[k].min, R[k].max);
  const spec: ScrewContainerOptions = {
    innerDiameterMm: num('innerDiameterMm'),
    innerHeightMm: num('innerHeightMm'),
    wallMm: num('wallMm'),
    bottomMm: num('bottomMm'),
    pitchMm: num('pitchMm'),
    starts: num('starts'),
    turns: num('turns'),
    radialClearanceMm: num('radialClearanceMm'),
    axialClearanceMm: num('axialClearanceMm'),
    flankAngleDeg: num('flankAngleDeg'),
    grip: readEnum('grip', o.grip, SCREW_CONTAINER_GRIPS),
    base: readEnum('base', o.base, SCREW_CONTAINER_BASES),
  };
  // Perfil y holgura axial (lanzan si no calzan) y alto mínimo para que quepa la rosca.
  const layout = layoutScrewContainer(spec);
  const minHeight = Math.ceil(layout.threadLengthMm + MIN_BODY_BELOW_NECK_MM);
  if (spec.innerHeightMm < minHeight) {
    throw new EngineError('INVALID_PARAMETER', { name: 'innerHeightMm', value: String(spec.innerHeightMm), min: minHeight, max: R.innerHeightMm.max });
  }
  return spec;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Medidas derivadas (mm, eje Z, fondo del cuerpo en Z = 0). No valida rangos: lo hace `resolveScrewContainer`. */
export function layoutScrewContainer(spec: ScrewContainerOptions) {
  const profile = containerProfile(spec.pitchMm, spec.flankAngleDeg, spec.starts);
  const innerRadius = spec.innerDiameterMm / 2;
  const rootRadius = innerRadius + spec.wallMm;
  const majorRadius = rootRadius + profile.depthMm;
  const columns = containerColumns(majorRadius + Math.max(0, spec.radialClearanceMm) + spec.wallMm + GRIP_DEPTH_MM);
  // Las cuerdas quedan hasta r·(1−cos π/N) dentro del arco: se suma a la holgura de la hembra.
  const sagitta = (majorRadius + spec.radialClearanceMm) * (1 - Math.cos(Math.PI / columns));
  const effRadialClearanceMm = spec.radialClearanceMm + sagitta;
  const tap = containerTapProfile(profile, effRadialClearanceMm, spec.axialClearanceMm);
  const grip = spec.grip === 'none' ? 0 : GRIP_DEPTH_MM;
  const lidRadius = majorRadius + effRadialClearanceMm + spec.wallMm + grip;
  const threadLengthMm = spec.turns * profile.leadMm;
  const topZ = spec.bottomMm + spec.innerHeightMm;
  const seatZ = topZ - threadLengthMm;
  const lidTopMm = Math.max(spec.bottomMm, 1.2);
  const lidHeight = threadLengthMm + LID_TOP_GAP_MM + lidTopMm;
  return {
    profile, tap, columns, innerRadius, rootRadius, majorRadius, effRadialClearanceMm, lidRadius,
    threadLengthMm, topZ, seatZ, lidTopMm, lidHeight,
  };
}

export type ScrewContainerLayout = ReturnType<typeof layoutScrewContainer>;

function frustum(wasm: ManifoldToplevel, scope: WasmScope, z0: number, z1: number, r0: number, r1: number, n: number): Manifold {
  return scope.track(scope.track(wasm.Manifold.cylinder(z1 - z0, r0, r1, n, false)).translate([0, 0, z0]));
}

function roundedSquare(wasm: ManifoldToplevel, scope: WasmScope, half: number, height: number, n: number): Manifold {
  const r = Math.min(6, half * 0.25);
  const c = half - r;
  const posts = [[c, c], [-c, c], [c, -c], [-c, -c]].map(([x, y]) =>
    scope.track(scope.track(wasm.Manifold.cylinder(height, r, r, Math.max(16, n / 4), false)).translate([x, y, 0])));
  return scope.track(wasm.Manifold.hull(posts));
}

/** Cuerpo y tapa en posición de armado (tapa a tope en el asiento), eje Z. Quien llama libera los dos. */
export function buildScrewContainerSolids(wasm: ManifoldToplevel, spec: ScrewContainerOptions): { body: Manifold; lid: Manifold; layout: ScrewContainerLayout } {
  const L = layoutScrewContainer(spec);
  const { profile, tap, columns: N } = L;
  return withWasmScope((scope) => {
    const thread = (rMin: number, rMaj: number, z0: number, z1: number, breaks: typeof tap.tapBreaks) =>
      scope.track(meshDataToManifold(wasm, containerThreadMesh(profile, rMin, rMaj, z0, z1, N, breaks)));

    // Cuerpo: base + cuello roscado con bisel de entrada a 45° − cavidad recta.
    const base = spec.base === 'square'
      ? roundedSquare(wasm, scope, L.lidRadius, L.seatZ, N)
      : scope.track(wasm.Manifold.cylinder(L.seatZ, L.lidRadius, L.lidRadius, N, false));
    const neckRaw = thread(L.rootRadius, L.majorRadius, L.seatZ - 0.5, L.topZ, tap.maleBreaks);
    const bevelTopR = L.rootRadius + 0.25 * profile.depthMm;
    const bevelBottomZ = L.topZ - (L.majorRadius + 0.2 - bevelTopR);
    const envelope = scope.track(wasm.Manifold.union([
      frustum(wasm, scope, L.seatZ - 1, bevelBottomZ, L.majorRadius + 0.2, L.majorRadius + 0.2, N),
      frustum(wasm, scope, bevelBottomZ, L.topZ + 1, L.majorRadius + 0.2, bevelTopR - 1, N),
    ]));
    const neck = scope.track(neckRaw.intersect(envelope));
    const cavity = frustum(wasm, scope, spec.bottomMm, L.topZ + 1, L.innerRadius, L.innerRadius, N);
    const body = scope.track(scope.track(base.add(neck)).subtract(cavity));

    // Tapa (armada): cilindro − rosca hembra − bisel de la boca − agarre.
    const lidTop = L.seatZ + L.lidHeight;
    const shell = frustum(wasm, scope, L.seatZ, lidTop, L.lidRadius, L.lidRadius, N);
    const c = L.effRadialClearanceMm;
    const female = thread(L.rootRadius + c, L.majorRadius + c, L.seatZ - 1, L.topZ + LID_TOP_GAP_MM, tap.tapBreaks);
    const mouthR = L.majorRadius + c - 0.1 * profile.depthMm;
    const mouth = frustum(wasm, scope, L.seatZ - 1, L.seatZ + (mouthR - L.rootRadius - c), mouthR + 1, L.rootRadius + c, N);
    let lid = scope.track(scope.track(shell.subtract(female)).subtract(mouth));
    if (spec.grip === 'knurl') {
      const count = Math.min(120, Math.max(12, Math.round((2 * Math.PI * L.lidRadius) / 3)));
      const grooves = Array.from({ length: count }, (_, i) => {
        const a = (2 * Math.PI * i) / count;
        return frustum(wasm, scope, L.seatZ - 1, lidTop + 1, GRIP_DEPTH_MM, GRIP_DEPTH_MM, 8)
          .translate([L.lidRadius * Math.cos(a), L.lidRadius * Math.sin(a), 0]);
      });
      grooves.forEach((g) => scope.track(g));
      lid = scope.track(lid.subtract(scope.track(wasm.Manifold.union(grooves))));
    } else if (spec.grip === 'flats') {
      const apothem = L.lidRadius - GRIP_DEPTH_MM;
      const hex = frustum(wasm, scope, L.seatZ - 1, lidTop + 1, apothem / Math.cos(Math.PI / 6), apothem / Math.cos(Math.PI / 6), 6);
      lid = scope.track(lid.intersect(hex));
    }
    return { body: scope.keep(body), lid: scope.keep(lid), layout: L };
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

/** Genera el cuerpo (apoyado en su fondo) y la tapa (techo sobre la cama, boca arriba), ambos centrados en su eje. */
export async function createScrewContainer(options: Partial<ScrewContainerOptions>): Promise<{ body: MeshData; lid: MeshData; spec: ScrewContainerOptions }> {
  const spec = resolveScrewContainer(options);
  const wasm = await initManifoldEngine();
  const { body, lid } = buildScrewContainerSolids(wasm, spec);
  try {
    const flipped = lid.rotate([180, 0, 0]);
    try {
      return { body: toBedMesh(body), lid: toBedMesh(flipped), spec };
    } finally {
      flipped.delete();
    }
  } finally {
    body.delete();
    lid.delete();
  }
}

/**
 * Verificación de enroscado del recipiente: tapa a tope y desenroscada por la hélice en `samples` posiciones.
 * `trusted` acepta un `spec` ya resuelto sin revalidar los rangos (pruebas con holgura negativa).
 */
export async function screwContainerFit(
  options: Partial<ScrewContainerOptions>,
  { samples = 6, trusted = false }: { samples?: number; trusted?: boolean } = {},
): Promise<ScrewFitReport & { nominal: ScrewContainerLayout['tap']['nominal'] }> {
  const spec = trusted ? ({ ...SCREW_CONTAINER_DEFAULTS, ...options } as ScrewContainerOptions) : resolveScrewContainer(options);
  const wasm = await initManifoldEngine();
  // El agarre y la forma de la base no tocan la rosca: se miden sin ellos (menos triángulos, mismo resultado).
  const { body, lid, layout } = buildScrewContainerSolids(wasm, { ...spec, grip: 'none', base: 'round' });
  try {
    const report = checkScrewFitSolids(wasm, body, lid, {
      leadMm: layout.profile.leadMm,
      turns: Math.min(spec.turns, 1),
      samples,
      direction: 1,
      clipBelowZ: layout.seatZ + 0.3,
    });
    return { ...report, nominal: layout.tap.nominal };
  } finally {
    body.delete();
    lid.delete();
  }
}
