/**
 * @file src/store/splitManualCutsParam.ts
 * @description Lectura estricta del parámetro `cuts` de `split_for_bed` (cortes a mano, ejes del usuario): lista de
 * 1 a `SPLIT_MANUAL_MAX_CUTS` objetos `{ axis, positionMm, tiltDeg? }` sin otras claves, eje x/y/z, posición finita
 * en mm y dos ángulos de ±`SPLIT_MANUAL_MAX_TILT_DEG`. Devuelve los cortes en ejes del motor; que la posición caiga
 * dentro del modelo y que los planos no se crucen lo valida el motor al planificar (`splitManualCuts.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SplitManualCut } from '../engine/split/splitTypes';
import { SPLIT_MANUAL_MAX_CUTS, SPLIT_MANUAL_MAX_TILT_DEG } from '../engine/split/splitManualCuts';
import { userCutToInternal } from '../core/scene/splitManualCutAxes';
import { CommandError } from './commandErrors';
import { pick, type RawParams } from './commandValidation';

const KEYS = new Set(['axis', 'positionMm', 'tiltDeg']);
const MAX_ABS_MM = 1_000_000;

const invalid = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/** `cuts` validado y en ejes del motor; `undefined` si no viene. */
export function readManualCuts(p: RawParams): SplitManualCut[] | undefined {
  const found = pick(p, 'cuts');
  if (!found) return undefined;
  const list = found[1];
  if (!Array.isArray(list) || list.length < 1 || list.length > SPLIT_MANUAL_MAX_CUTS) {
    throw invalid('cuts', `array of 1–${SPLIT_MANUAL_MAX_CUTS} cuts`);
  }
  return list.map((raw, i) => {
    const at = `cuts[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid(at, '{ axis, positionMm, tiltDeg? }');
    const c = raw as Record<string, unknown>;
    const extra = Object.keys(c).find((k) => !KEYS.has(k));
    if (extra) throw invalid(`${at}.${extra}`, 'axis | positionMm | tiltDeg');
    if (c.axis !== 'x' && c.axis !== 'y' && c.axis !== 'z') throw invalid(`${at}.axis`, 'x | y | z');
    const pos = c.positionMm;
    if (typeof pos !== 'number' || !Number.isFinite(pos) || Math.abs(pos) > MAX_ABS_MM) throw invalid(`${at}.positionMm`, `number ∈ [-${MAX_ABS_MM}, ${MAX_ABS_MM}]`);
    const tilt = c.tiltDeg ?? [0, 0];
    const okTilt = Array.isArray(tilt) && tilt.length === 2 &&
      tilt.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= SPLIT_MANUAL_MAX_TILT_DEG);
    if (!okTilt) throw invalid(`${at}.tiltDeg`, `[number, number] ∈ [-${SPLIT_MANUAL_MAX_TILT_DEG}, ${SPLIT_MANUAL_MAX_TILT_DEG}]`);
    return userCutToInternal({ axis: c.axis, positionMm: pos, tiltDeg: [tilt[0] as number, tilt[1] as number] });
  });
}
