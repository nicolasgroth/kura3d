/**
 * @file src/core/bus/simplifySchema.ts
 * @description Esquema del comando `simplify_mesh`: modo («lossless», «tolerance», «target»), tolerancia en mm y
 * objetivo por cantidad (triángulos o %), con los rangos de `OPERATION_RANGES.simplify`; y la forma del informe
 * que devuelven el Command Bus de la app y el MCP sin interfaz (misma respuesta en los dos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { OPERATION_DEFAULTS, OPERATION_RANGES as OR } from '../../engine/operationLimits';
import { SIMPLIFY_MODES, type SimplifyReport, type SimplifyRequest } from '../../engine/simplify';
import { CommandError } from './commandErrors';
import { resolveTarget, type SceneView } from './commandTargets';
import { readEnum, readRange, type RawParams } from './commandValidation';

const invalid = (param: string, expected: string) =>
  new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

/**
 * Sin `mode`: «target» si llega `targetTriangles` o `targetPercent`, si no «tolerance» (compatibilidad). En
 * «target» va exactamente uno de los dos objetivos. Un parámetro que no corresponde al modo (`toleranceMm` en
 * «lossless» o «target»; un objetivo en «lossless» o «tolerance») es `invalid-params`: no se ignora en silencio.
 */
export function parseSimplifyRequest(p: RawParams): SimplifyRequest {
  const targetTriangles = readRange(p, OR.simplify.targetTriangles, 'targetTriangles');
  const targetPercent = readRange(p, OR.simplify.targetPercent, 'targetPercent');
  const toleranceMm = readRange(p, OR.simplify.toleranceMm, 'toleranceMm');
  const hasTarget = targetTriangles !== undefined || targetPercent !== undefined;
  const mode = readEnum(p, SIMPLIFY_MODES, 'mode') ?? (hasTarget ? 'target' : 'tolerance');
  const notFor = (param: string) => invalid(param, `not used by mode "${mode}"`);
  if (mode !== 'target' && targetTriangles !== undefined) throw notFor('targetTriangles');
  if (mode !== 'target' && targetPercent !== undefined) throw notFor('targetPercent');
  if (mode !== 'tolerance' && toleranceMm !== undefined) throw notFor('toleranceMm');
  if (mode === 'lossless') return { mode };
  if (mode === 'tolerance') return { mode, toleranceMm: toleranceMm ?? OPERATION_DEFAULTS.simplify.toleranceMm };
  if (targetTriangles !== undefined && targetPercent !== undefined) {
    throw invalid('targetPercent', 'only one of targetTriangles | targetPercent');
  }
  if (!hasTarget) throw invalid('targetTriangles', 'targetTriangles or targetPercent for mode "target"');
  return targetTriangles !== undefined ? { mode, targetTriangles } : { mode, targetPercent };
}

export function parseSimplify(scene: SceneView, p: RawParams) {
  return { target: resolveTarget(scene, p, { unlocked: true }), request: parseSimplifyRequest(p) };
}

const r = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits + 0;

/** Informe para el comando (sin malla): mismo objeto en la app y sin interfaz. */
export function simplifyReportToUser(report: SimplifyReport) {
  return {
    mode: report.mode,
    applied: report.applied,
    toleranceMm: r(report.toleranceMm, 6),
    trianglesBefore: report.trianglesBefore,
    trianglesAfter: report.trianglesAfter,
    volumeBeforeMm3: r(report.volumeBeforeMm3, 3),
    volumeAfterMm3: r(report.volumeAfterMm3, 3),
    volumeChangePct: r(report.volumeChangePct),
    genusBefore: report.genusBefore,
    genusAfter: report.genusAfter,
    maxDeviationMm: r(report.maxDeviationMm),
    deviationSamples: report.deviationSamples,
    /** Avisos de la verificación (`SimplifyWarningCode`); `warnings` queda para los avisos generales del motor. */
    checks: [...report.warnings],
    rejectedBy: [...report.rejectedBy],
    ...(report.target ? { target: { ...report.target } } : {}),
  };
}
