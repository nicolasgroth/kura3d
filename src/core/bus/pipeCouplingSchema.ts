/**
 * @file src/core/bus/pipeCouplingSchema.ts
 * @description Validación estricta compartida (paso de receta `create_pipe_coupling`, Command Bus y MCP) de las medidas
 * del acople de tubería. Usa los rangos de `OPERATION_RANGES.pipeCoupling`; un valor fuera de rango o de tipo es un
 * error tipado, nunca se acota. Lo omitido toma el valor por defecto del motor (la holgura, según la unión).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { OPERATION_RANGES as OR } from '../../engine/operationLimits';
import { PIPE_COUPLING_JOINTS, type PipeCouplingOptions } from '../../engine/pipeCouplingLayout';
import { CommandError } from './commandErrors';
import { readEnum, readNumber, readRange, type RawParams } from './commandValidation';

/** Receta incorporada que crea el acople (el comando `create_pipe_coupling` y el MCP la ejecutan). */
export const PIPE_COUPLING_RECIPE_ID = 'kura.acople-tuberia';

export const PIPE_COUPLING_PARTS = ['male', 'female'] as const;
export type PipeCouplingPart = (typeof PIPE_COUPLING_PARTS)[number];

/** Claves numéricas del acople (mismo nombre en receta, bus y MCP). */
export const PIPE_COUPLING_NUMBER_KEYS = [
  'boreDiameterMm', 'wallMm', 'tailLengthMm', 'engageMm', 'clearanceMm', 'pitchMm', 'starts', 'turns',
] as const;

/** Opciones parciales del acople. */
export function parsePipeCoupling(p: RawParams): Partial<PipeCouplingOptions> {
  const out: Record<string, unknown> = {};
  for (const key of PIPE_COUPLING_NUMBER_KEYS) {
    const v = key === 'starts'
      ? readNumber(p, { min: OR.pipeCoupling.starts.min, max: OR.pipeCoupling.starts.max, integer: true }, key)
      : readRange(p, OR.pipeCoupling[key], key);
    if (v !== undefined) out[key] = v;
  }
  const joint = readEnum(p, PIPE_COUPLING_JOINTS, 'joint');
  if (joint !== undefined) out.joint = joint;
  return out as Partial<PipeCouplingOptions>;
}

/**
 * Respuestas de la receta `kura.acople-tuberia` para unas opciones ya validadas: la receta pide la holgura en dos
 * campos (uno por unión, cada uno con su valor por defecto), así que `clearanceMm` va al de la unión elegida.
 */
export function couplingAnswers(options: Partial<PipeCouplingOptions>): Record<string, string | number> {
  const { clearanceMm, ...rest } = options;
  const answers: Record<string, string | number> = { ...rest };
  if (clearanceMm !== undefined) answers[(options.joint ?? 'thread') === 'press' ? 'pressClearanceMm' : 'threadClearanceMm'] = clearanceMm;
  return answers;
}

export function parsePipeCouplingPart(p: RawParams): PipeCouplingPart {
  const part = readEnum(p, PIPE_COUPLING_PARTS, 'part');
  if (part === undefined) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'part', expected: PIPE_COUPLING_PARTS.join(' | ') });
  return part;
}
