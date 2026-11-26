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
import {
  SIMPLIFY_MODES,
  SIMPLIFY_ON_DESTRUCTIVE,
  type SimplifyReport,
  type SimplifyRequest,
  type SimplifyRequestedResult,
  type SimplifySafeAlternative,
} from '../../engine/simplify';
import { CommandError } from './commandErrors';
import { resolveTarget, type SceneView } from './commandTargets';
import { readBoolean, readEnum, readRange, type RawParams } from './commandValidation';

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
  const allowDestructive = readBoolean(p, 'allowDestructive');
  const onDestructive = readEnum(p, SIMPLIFY_ON_DESTRUCTIVE, 'onDestructive');
  // «Sin pérdida» nunca entrega un resultado destructivo (sus límites son más estrictos): forzarlo no tiene sentido.
  if (mode === 'lossless' && allowDestructive) throw notFor('allowDestructive');
  if (mode === 'lossless' && onDestructive !== undefined) throw notFor('onDestructive');
  // `allowDestructive: true` es el alias de `onDestructive: "force"`: contradecirlo no se resuelve en silencio.
  if (allowDestructive && onDestructive !== undefined && onDestructive !== 'force') {
    throw invalid('onDestructive', '"force" (or omit it) when allowDestructive is true');
  }
  const force = allowDestructive ? { allowDestructive: true } : onDestructive !== undefined ? { onDestructive } : {};
  if (mode === 'lossless') return { mode };
  if (mode === 'tolerance') return { mode, toleranceMm: toleranceMm ?? OPERATION_DEFAULTS.simplify.toleranceMm, ...force };
  if (targetTriangles !== undefined && targetPercent !== undefined) {
    throw invalid('targetPercent', 'only one of targetTriangles | targetPercent');
  }
  if (!hasTarget) throw invalid('targetTriangles', 'targetTriangles or targetPercent for mode "target"');
  return targetTriangles !== undefined ? { mode, targetTriangles, ...force } : { mode, targetPercent, ...force };
}

/** `dryRun: true` calcula el mismo informe sin tocar la escena ni el historial (vista previa). */
export function parseSimplify(scene: SceneView, p: RawParams) {
  return {
    target: resolveTarget(scene, p, { unlocked: true }),
    request: parseSimplifyRequest(p),
    dryRun: readBoolean(p, 'dryRun') === true,
  };
}

const r = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits + 0;

/** Informe para el comando (sin malla): mismo objeto en la app y sin interfaz. */
export function simplifyReportToUser(report: SimplifyReport) {
  return {
    mode: report.mode,
    applied: report.applied,
    /** `requested` (lo pedido), `safe` (la versión segura en su lugar: ver `requested`) o `none`. */
    appliedVariant: report.appliedVariant,
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
    /** Motivos de resultado destructivo (`holes_lost`, `volume_changed`, `deviation_high`); vacío si no lo es. */
    destructive: [...(report.destructive ?? [])],
    /** Solo si fue destructivo: la alternativa segura (aplicable con mode "tolerance"), o null. */
    ...(report.safe !== undefined ? { safe: report.safe && safeToUser(report.safe) } : {}),
    /** Solo si se aplicó la segura en lugar de lo pedido: las medidas de lo pedido. */
    ...(report.requested ? { requested: requestedToUser(report.requested) } : {}),
    ...(report.forced ? { forced: true } : {}),
  };
}

function requestedToUser(q: SimplifyRequestedResult) {
  return {
    toleranceMm: r(q.toleranceMm, 6),
    triangles: q.triangles,
    volumeAfterMm3: r(q.volumeAfterMm3, 3),
    volumeChangePct: r(q.volumeChangePct),
    genusAfter: q.genusAfter,
    maxDeviationMm: r(q.maxDeviationMm),
  };
}

function safeToUser(s: SimplifySafeAlternative) {
  return {
    toleranceMm: r(s.toleranceMm, 6),
    triangles: s.triangles,
    volumeAfterMm3: r(s.volumeAfterMm3, 3),
    volumeChangePct: r(s.volumeChangePct),
    genusAfter: s.genusAfter,
    maxDeviationMm: r(s.maxDeviationMm),
  };
}
