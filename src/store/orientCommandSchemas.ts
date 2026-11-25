/**
 * @file src/store/orientCommandSchemas.ts
 * @description Esquemas de «Orientar para imprimir» para comandos: `orient_for_print` (solo lectura: ángulo de
 * voladizo, cama opcional e idioma de las frases) y `apply_orientation` (un candidato por id o por cuaternión, con
 * `keepXY`). Da forma al análisis en ejes del usuario (Z arriba): dirección hacia la cama, cuaternión, medidas y
 * motivos como clave + parámetros y como frase. Lo comparten el Command Bus de la app y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { reasonText } from '../core/orient/orientReasonText';
import { t } from '../i18n';
import { CommandError } from '../core/bus/commandErrors';
import { pick, readBoolean, readEnum, readRange, readString, type RawParams } from '../core/bus/commandValidation';
import { fromUserVector, toUserVector } from '../core/scene/displayAxes';
import { ORIENT_RANGES, type OrientAnalysis, type OrientBed, type OrientCandidate } from '../engine/orient';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import type { FitBed } from '../engine/fitToBed';
import { SUPPORTED_LANGUAGES, type LanguageCode, type SceneObject, type Vec3 } from '../types/kura';

export const ORIENT_LANGUAGES: readonly LanguageCode[] = SUPPORTED_LANGUAGES.map((l) => l.code);

export type Quaternion = [number, number, number, number];

export interface OrientCommandOptions {
  overhangAngleDeg: number;
  bed: OrientBed | null;
}

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/** Ángulo y cama del análisis: la cama por defecto es la activa; `ignoreBed: true` analiza sin cama. */
export function parseOrientOptions(p: RawParams, activeBed: FitBed): OrientCommandOptions {
  const overhangAngleDeg = readRange(p, ORIENT_RANGES.overhangAngleDeg, 'overhangAngleDeg') ?? ORIENT_RANGES.overhangAngleDeg.default;
  if (readBoolean(p, 'ignoreBed')) return { overhangAngleDeg, bed: null };
  const bed: OrientBed = {
    widthMm: readRange(p, OR.split.bedMm, 'bedWidthMm') ?? activeBed.widthMm,
    depthMm: readRange(p, OR.split.bedMm, 'bedDepthMm') ?? activeBed.depthMm,
    heightMm: readRange(p, OR.split.bedMm, 'bedHeightMm') ?? activeBed.heightMm,
    marginMm: readRange(p, OR.split.marginMm, 'marginMm') ?? activeBed.marginMm,
  };
  return { overhangAngleDeg, bed };
}

/** Idioma de las frases de los motivos (inglés por defecto, como los mensajes del servidor). */
export const parseOrientLanguage = (p: RawParams): LanguageCode => readEnum(p, ORIENT_LANGUAGES, 'language') ?? 'en';

/** Cuaternión (x, y, z, w) interno → usuario: la parte vectorial cambia de ejes como un vector (giro propio). */
export function quaternionToUser(q: Readonly<Quaternion>): Quaternion {
  const [x, y, z] = toUserVector([q[0], q[1], q[2]]);
  return [x, y, z, q[3] + 0];
}

/** Cuaternión del usuario → interno, normalizado; null si no es finito o es nulo. */
export function quaternionFromUser(q: readonly number[]): Quaternion | null {
  if (q.length !== 4 || !q.every((n) => Number.isFinite(n))) return null;
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(len > 1e-9)) return null;
  const [x, y, z] = fromUserVector([q[0] / len, q[1] / len, q[2] / len]);
  return [x, y, z, q[3] / len + 0];
}

/** Lo que pide `apply_orientation`: un candidato por id o un cuaternión (usuario), y si conserva X/Y en la cama. */
export interface ApplyOrientationRequest {
  candidateId: string | null;
  /** Cuaternión interno (ya convertido desde los ejes del usuario). */
  quaternion: Quaternion | null;
  keepXY: boolean;
}

export function parseApplyOrientation(p: RawParams): ApplyOrientationRequest {
  const candidateId = readString(p, 128, 'candidateId') ?? null;
  const rawQ = pick(p, 'quaternion')?.[1];
  if (candidateId && rawQ !== undefined) throw invalid('candidateId', 'either candidateId or quaternion, not both');
  let quaternion: Quaternion | null = null;
  if (rawQ !== undefined) {
    quaternion = Array.isArray(rawQ) ? quaternionFromUser(rawQ as number[]) : null;
    if (!quaternion) throw invalid('quaternion', '[x, y, z, w] finite and non-zero');
  }
  if (!candidateId && !quaternion) throw invalid('candidateId', 'candidateId (from orient_for_print) or quaternion');
  return { candidateId, quaternion, keepXY: readBoolean(p, 'keepXY') ?? true };
}

/** Candidato del análisis por id, o `not-found` con los ids disponibles. */
export function findOrientCandidate(analysis: OrientAnalysis, id: string): OrientCandidate {
  const found = analysis.candidates.find((c) => c.id === id);
  if (!found) {
    // `available` va como parámetro propio (no mezclado en `id`): quien llama puede leerlo y reintentar.
    throw new CommandError('not-found', 'orient.error.candidateNotFound', { id, available: analysis.candidates.map((c) => c.id).join(', ') });
  }
  return found;
}

const r = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits + 0;
const rq = (q: Quaternion): Quaternion => q.map((v) => r(v, 6)) as Quaternion;

function candidateToUser(c: OrientCandidate, language: LanguageCode) {
  const m = c.measures;
  return {
    id: c.id,
    rank: c.rank,
    source: c.source,
    /** Dirección (ejes del usuario) que queda hacia la cama. */
    down: toUserVector(c.down).map((v) => r(v, 4)) as Vec3,
    /** Giro relativo a la pose actual (x, y, z, w en ejes del usuario): se pasa tal cual a `apply_orientation`. */
    quaternion: rq(quaternionToUser(c.quaternion)),
    measures: {
      supportVolumeMm3: r(m.supportVolumeMm3, 1),
      overhangAreaMm2: r(m.overhangAreaMm2, 1),
      contactAreaMm2: r(m.contactAreaMm2, 1),
      supportPolygonMm2: r(m.supportPolygonMm2, 1),
      heightMm: r(m.heightMm),
      footprintMm: [r(m.footprintMm[0]), r(m.footprintMm[1])],
      tipAngleDeg: r(m.tipAngleDeg, 1),
      stable: m.stable,
      fitsBed: m.fitsBed,
    },
    cost: r(c.cost, 4),
    equivalentToBest: c.equivalentToBest,
    vsCurrent: c.vsCurrent,
    reasons: c.reasons.map((reason) => ({ ...reason, text: reasonText(language, reason) })),
  };
}

/** Análisis completo en ejes del usuario, con la recomendada (null si la actual ya es la mejor o son equivalentes). */
export function orientAnalysisToUser(a: OrientAnalysis, language: LanguageCode) {
  return {
    candidates: a.candidates.map((c) => candidateToUser(c, language)),
    currentId: a.currentId,
    // Sin recomendada si la actual ya es la mejor, si son equivalentes o si la primera es la actual (sin base).
    recommendedId: a.allEquivalent || a.currentIsBest || a.candidates[0]?.id === a.currentId ? null : (a.candidates[0]?.id ?? null),
    currentIsBest: a.currentIsBest,
    allEquivalent: a.allEquivalent,
    /** `noStableBase`: ninguna orientación se sostiene sola; `warnings` trae el aviso en el idioma pedido. */
    baseStatus: a.baseStatus,
    warnings: a.baseStatus === 'noStableBase' ? [{ key: 'noStableBase', text: t(language, 'orient.ui.noStableBase') }] : [],
    overhangAngleDeg: a.overhangAngleDeg,
    supportCellMm: r(a.supportCellMm),
    partVolumeMm3: r(a.partVolumeMm3, 1),
    language,
  };
}

/** Ids de los objetos (además de `exceptId`) cuya pose cambió entre dos escenas. */
export function movedObjectIds(before: readonly SceneObject[], after: readonly SceneObject[], exceptId: string): string[] {
  const prev = new Map(before.map((o) => [o.id, o]));
  const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);
  return after
    .filter((o) => {
      const was = prev.get(o.id);
      return o.id !== exceptId && was && (!same(was.position, o.position) || !same(was.rotation, o.rotation) || !same(was.scale, o.scale));
    })
    .map((o) => o.id);
}
