/**
 * @file src/engine/pipeCouplingLayout.ts
 * @description Opciones, validación y medidas derivadas del acople de tubería (macho + hembra para unir dos tubos o
 * mangueras impresos). Dos uniones: `thread` (rosca de recipiente de `containerThread.ts`, trapecio a 45°, imprimible
 * sin soportes) y `press` (espiga lisa con conicidad de 1° y tope, hembra con boca ensanchada). Cada mitad termina en un
 * tramo liso del mismo diámetro exterior para pegar o continuar el tubo, y el paso interior (`boreDiameterMm`) queda
 * libre de punta a punta. Marco: eje Z, macho abajo con el tramo liso en Z = 0 y el hombro (asiento) en Z = `seatZ`; la
 * hembra, armada, apoya su boca en ese hombro.
 *
 * Pared mínima: el rango del motor parte en 0,8 mm (dos perímetros de boquilla 0,4) y bajo `PIPE_COUPLING_MIN_WALL_MM`
 * (1,2 mm, tres perímetros) se avisa: una pared de dos perímetros en una pieza que se enrosca o se enchufa se raja al
 * apretar. La pared pedida es la más delgada de cada mitad: espiga del macho (entre el paso y la raíz de la rosca o la
 * punta de la espiga cónica) y hembra (entre la cresta de la rosca hembra, o la boca ensanchada, y el exterior).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { EngineError, requireNumberInRange } from './engineErrors';
import { containerColumns, containerProfile, containerTapProfile } from './containerThread';
import { OPERATION_RANGES } from './operationLimits';

const R = OPERATION_RANGES.pipeCoupling;

export const PIPE_COUPLING_JOINTS = ['thread', 'press'] as const;
export type PipeCouplingJoint = (typeof PIPE_COUPLING_JOINTS)[number];

export interface PipeCouplingOptions {
  readonly joint: PipeCouplingJoint;
  /** Diámetro libre del paso interior (mm): el del tubo que se une. */
  readonly boreDiameterMm: number;
  /** Pared más delgada de cada mitad (mm). */
  readonly wallMm: number;
  /** Largo del tramo liso de cada mitad (mm). */
  readonly tailLengthMm: number;
  /** Largo de la espiga a presión (mm); en la roscada el largo lo dan vueltas × avance. */
  readonly engageMm: number;
  /** Holgura radial (mm). Por defecto 0,3 (roscado) o 0,15 (a presión). */
  readonly clearanceMm: number;
  readonly pitchMm: number;
  readonly starts: number;
  readonly turns: number;
}

/** Valores por defecto sin la holgura (depende de la unión). */
export const PIPE_COUPLING_DEFAULTS = Object.freeze({
  joint: 'thread' as PipeCouplingJoint,
  boreDiameterMm: 20,
  wallMm: 2,
  tailLengthMm: 15,
  engageMm: 15,
  pitchMm: 3,
  starts: 1,
  turns: 2.5,
});

/** Holgura radial por defecto de cada unión (mm). */
export const PIPE_COUPLING_DEFAULT_CLEARANCE: Readonly<Record<PipeCouplingJoint, number>> = Object.freeze({ thread: 0.3, press: 0.15 });

/** Pared bajo la cual se avisa (mm): tres perímetros con boquilla de 0,4 mm. */
export const PIPE_COUPLING_MIN_WALL_MM = 1.2;
/** Conicidad de la espiga a presión: semiángulo (grados). Centra la hembra al enchufar sin trabarla. */
export const PRESS_TAPER_DEG = 1;
/** Ensanche radial de la boca de la hembra a presión, a 45° (mm). */
export const PRESS_FLARE_MM = 0.6;
/** Luz entre la punta del macho y el fondo del enchufe de la hembra, además de la holgura (mm). */
export const TIP_GAP_MM = 0.5;

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Valida y completa con los valores por defecto. Errores tipados `INVALID_PARAMETER` (nada se acota en silencio). */
export function resolvePipeCoupling(options: Partial<PipeCouplingOptions>): PipeCouplingOptions {
  const o = { ...PIPE_COUPLING_DEFAULTS, ...stripUndefined(options) } as Partial<PipeCouplingOptions> & typeof PIPE_COUPLING_DEFAULTS;
  const joint = o.joint;
  if (typeof joint !== 'string' || !(PIPE_COUPLING_JOINTS as readonly string[]).includes(joint)) {
    throw new EngineError('INVALID_PARAMETER', { name: 'joint', value: String(joint).slice(0, 32), min: 0, max: PIPE_COUPLING_JOINTS.length - 1 });
  }
  const num = (k: keyof typeof R, v: unknown) => requireNumberInRange(k, v as number, R[k].min, R[k].max);
  const starts = num('starts', o.starts);
  if (!Number.isInteger(starts)) throw new EngineError('INVALID_PARAMETER', { name: 'starts', value: String(o.starts), min: R.starts.min, max: R.starts.max });
  const spec: PipeCouplingOptions = {
    joint,
    boreDiameterMm: num('boreDiameterMm', o.boreDiameterMm),
    wallMm: num('wallMm', o.wallMm),
    tailLengthMm: num('tailLengthMm', o.tailLengthMm),
    engageMm: num('engageMm', o.engageMm),
    clearanceMm: num('clearanceMm', o.clearanceMm ?? PIPE_COUPLING_DEFAULT_CLEARANCE[joint]),
    pitchMm: num('pitchMm', o.pitchMm),
    starts,
    turns: num('turns', o.turns),
  };
  layoutPipeCoupling(spec); // el perfil y el juego axial lanzan si no calzan
  return spec;
}

/** Juego axial por flanco de la rosca: 1,5 × la holgura radial (como el recipiente), lo que quepa en las mesetas. */
export function couplingAxialPlayMm(clearanceMm: number, pitchMm: number): number {
  return Math.max(0, Math.min(1.5 * clearanceMm, clearanceMm + 0.15 * pitchMm));
}

/** Medidas derivadas (mm, eje Z). No valida rangos: lo hace `resolvePipeCoupling`. */
export function layoutPipeCoupling(spec: PipeCouplingOptions) {
  const boreRadiusMm = spec.boreDiameterMm / 2;
  const seatZ = spec.tailLengthMm;
  const c = spec.clearanceMm;
  const tipGapMm = TIP_GAP_MM + Math.max(0, c);
  if (spec.joint === 'thread') {
    const profile = containerProfile(spec.pitchMm, 45, spec.starts);
    const rootRadiusMm = boreRadiusMm + spec.wallMm;
    const majorRadiusMm = rootRadiusMm + profile.depthMm;
    const columns = containerColumns(majorRadiusMm + Math.max(0, c) + spec.wallMm);
    // Las cuerdas quedan hasta r·(1−cos π/N) dentro del arco: se suma a la holgura de la hembra.
    const effClearanceMm = c + (majorRadiusMm + c) * (1 - Math.cos(Math.PI / columns));
    const tap = containerTapProfile(profile, effClearanceMm, couplingAxialPlayMm(c, spec.pitchMm));
    const engageLengthMm = spec.turns * profile.leadMm;
    const outerRadiusMm = majorRadiusMm + effClearanceMm + spec.wallMm;
    const socketDepthMm = engageLengthMm + tipGapMm;
    return {
      joint: spec.joint, columns, boreRadiusMm, seatZ, tailLengthMm: spec.tailLengthMm, engageLengthMm, outerRadiusMm,
      socketDepthMm, maleHeightMm: seatZ + engageLengthMm, femaleHeightMm: socketDepthMm + spec.tailLengthMm,
      minWallMm: spec.wallMm, effClearanceMm, leadMm: profile.leadMm,
      thread: { profile, tap, rootRadiusMm, majorRadiusMm },
      spigotBaseRadiusMm: majorRadiusMm, spigotTipRadiusMm: rootRadiusMm,
    };
  }
  const taper = Math.tan((PRESS_TAPER_DEG * Math.PI) / 180);
  const engageLengthMm = spec.engageMm;
  const spigotTipRadiusMm = boreRadiusMm + spec.wallMm;
  const spigotBaseRadiusMm = spigotTipRadiusMm + engageLengthMm * taper;
  const outerRadiusMm = spigotBaseRadiusMm + c + PRESS_FLARE_MM + spec.wallMm;
  const columns = containerColumns(outerRadiusMm);
  const socketDepthMm = engageLengthMm + tipGapMm;
  return {
    joint: spec.joint, columns, boreRadiusMm, seatZ, tailLengthMm: spec.tailLengthMm, engageLengthMm, outerRadiusMm,
    socketDepthMm, maleHeightMm: seatZ + engageLengthMm, femaleHeightMm: socketDepthMm + spec.tailLengthMm,
    minWallMm: spec.wallMm, effClearanceMm: c, leadMm: 0,
    thread: null,
    spigotBaseRadiusMm, spigotTipRadiusMm, taper,
  };
}

export type PipeCouplingLayout = ReturnType<typeof layoutPipeCoupling>;
