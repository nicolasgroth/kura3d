/**
 * @file src/engine/containerThread.ts
 * @description Perfil de rosca de recipiente (frascos, tarros): trapecio simétrico de paso grueso pensado para FDM
 * sin soportes, con flancos a ≤ 45° del eje (el eje es la vertical de impresión, así que ningún flanco es un
 * voladizo más tendido que 45°), mesetas planas en cresta y raíz, y una o varias entradas (avance = entradas × paso).
 * Reutiliza el mallado helicoidal exacto de `threads.ts` (`buildHelicalThreadMesh`, con fase n·θ/2π − z/P), así que
 * macho y hembra generados con las mismas columnas calzan igual en cualquier fase de giro.
 *
 * Holgura: la hembra (macho negativo que se resta a la tapa) sube sus dos radios la holgura radial `c`; en un flanco
 * a β del eje eso ya deja un juego axial de c/tan β por flanco. Si se pide más juego axial `a`, el exceso
 * s = a − c/tan β se reparte por igual entre las dos mesetas (la cresta del macho y la de la tapa se angostan s/2
 * cada una), para no dejar ninguna cresta más delgada que 0,05·P.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../types/kura';
import { EngineError, requireNumberInRange } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import { buildHelicalThreadMesh, profileRadius, type ProfileBreaks } from './threads';

const R = OPERATION_RANGES.screwContainer;

/** Fracción de paso de cada flanco (con β = 45° la profundidad es 0,3·P). */
export const CONTAINER_FLANK_PHASE = 0.3;
/** Fracción de paso de cada meseta (cresta y raíz) sin holgura axial extra. */
export const CONTAINER_FLAT_PHASE = 0.2;
/** Meseta mínima que debe quedar en cada cresta tras repartir la holgura axial (fracción de paso). */
const MIN_FLAT_PHASE = 0.05;

export interface ContainerProfile {
  readonly pitchMm: number;
  readonly starts: number;
  /** Avance por vuelta = entradas × paso. */
  readonly leadMm: number;
  /** Profundidad radial del filete. */
  readonly depthMm: number;
  /** Ángulo de cada flanco respecto del eje (vertical de impresión), en grados. */
  readonly flankAngleDeg: number;
  /** Quiebres del macho sin holgura axial extra: raíz, flanco, cresta, flanco. */
  readonly breaks: ProfileBreaks;
}

/** Perfil validado. Errores tipados `INVALID_PARAMETER` (nada se acota en silencio). */
export function containerProfile(pitchMm: number, flankAngleDeg = 45, starts = 1): ContainerProfile {
  const pitch = requireNumberInRange('pitchMm', pitchMm, R.pitchMm.min, R.pitchMm.max);
  const flank = requireNumberInRange('flankAngleDeg', flankAngleDeg, R.flankAngleDeg.min, R.flankAngleDeg.max);
  const n = requireNumberInRange('starts', starts, R.starts.min, R.starts.max);
  if (!Number.isInteger(n)) throw new EngineError('INVALID_PARAMETER', { name: 'starts', value: String(starts), min: R.starts.min, max: R.starts.max });
  const depthMm = CONTAINER_FLANK_PHASE * pitch * Math.tan((flank * Math.PI) / 180);
  const f = CONTAINER_FLAT_PHASE;
  return {
    pitchMm: pitch,
    starts: n,
    leadMm: n * pitch,
    depthMm,
    flankAngleDeg: flank,
    breaks: [0, f, f + CONTAINER_FLANK_PHASE, 2 * f + CONTAINER_FLANK_PHASE],
  };
}

export interface ContainerTapProfile {
  /** Quiebres del macho (boca del recipiente) con la parte de holgura axial que le toca. */
  readonly maleBreaks: ProfileBreaks;
  /** Quiebres de la hembra (negativo que se resta a la tapa). */
  readonly tapBreaks: ProfileBreaks;
  /** Desplazamiento axial extra de cada flanco (mm). */
  readonly extraAxialMm: number;
  /** Holgura nominal: radial (crestas y raíces), normal al flanco y juego axial por flanco. */
  readonly nominal: { readonly radialMm: number; readonly flankNormalMm: number; readonly axialPlayMm: number };
}

/**
 * Quiebres del macho y de la hembra para la holgura radial `radialMm` (ya compensada por las cuerdas, si se quiere)
 * y el juego axial por flanco `axialMm`. Lanza `INVALID_PARAMETER` si el juego axial no cabe en las mesetas.
 */
export function containerTapProfile(profile: ContainerProfile, radialMm: number, axialMm: number): ContainerTapProfile {
  const beta = (profile.flankAngleDeg * Math.PI) / 180;
  const fromRadial = radialMm / Math.tan(beta);
  const extra = Math.max(0, axialMm - Math.max(0, fromRadial));
  const d = extra / profile.pitchMm;
  const maxD = CONTAINER_FLAT_PHASE - MIN_FLAT_PHASE;
  if (d > maxD + 1e-12) {
    const max = Math.floor((maxD * profile.pitchMm + Math.max(0, fromRadial)) * 100) / 100;
    throw new EngineError('INVALID_PARAMETER', { name: 'axialClearanceMm', value: String(axialMm), min: 0, max });
  }
  const [b0, b1, b2, b3] = profile.breaks;
  const maleBreaks: ProfileBreaks = [b0, b1 + d, b2 + d, b3];
  const tapBreaks: ProfileBreaks = [b0 + d, b1, b2, b3 + d];
  const gap = radialMm + extra * Math.tan(beta);
  return {
    maleBreaks,
    tapBreaks,
    extraAxialMm: extra,
    nominal: { radialMm, flankNormalMm: gap * Math.cos(beta), axialPlayMm: gap / Math.tan(beta) },
  };
}

/** Ángulo máximo (grados) de los flancos respecto del eje: atan(profundidad / ancho axial del flanco). */
export function profileMaxFlankAngleDeg(breaks: ProfileBreaks, depthMm: number, pitchMm: number): number {
  const rise = (breaks[2] - breaks[1]) * pitchMm;
  const fall = (breaks[0] + 1 - breaks[3]) * pitchMm;
  return (Math.atan(depthMm / Math.min(rise, fall)) * 180) / Math.PI;
}

/** Media de r² sobre una vuelta de fase (el área de la sección es π·⟨r²⟩ en cualquier altura). */
export function meanSquaredRadius(breaks: ProfileBreaks, rMinor: number, rMajor: number, samples = 4000): number {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const r = profileRadius((i + 0.5) / samples, rMinor, rMajor, breaks);
    sum += r * r;
  }
  return sum / samples;
}

/** Columnas angulares para el radio exterior `radius`: cuerdas de ~1,2 mm, múltiplo de 8, entre 64 y 256. */
export function containerColumns(radius: number): number {
  return Math.min(256, Math.max(64, Math.ceil((2 * Math.PI * radius) / 1.2 / 8) * 8));
}

/** Malla cerrada del cilindro roscado de recipiente entre `z0` y `z1` (eje Z, hélice derecha). */
export function containerThreadMesh(
  profile: ContainerProfile,
  rMinor: number,
  rMajor: number,
  z0: number,
  z1: number,
  columns: number,
  breaks: ProfileBreaks,
): MeshData {
  return buildHelicalThreadMesh(rMinor, rMajor, profile.pitchMm, z0, z1, columns, breaks, profile.starts);
}
