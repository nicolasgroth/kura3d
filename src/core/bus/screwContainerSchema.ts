/**
 * @file src/core/bus/screwContainerSchema.ts
 * @description Validación estricta compartida (paso de receta `create_screw_container`, Command Bus y MCP) de las
 * medidas del recipiente con tapa roscada y de la comprobación de enroscado entre dos objetos. Usa los rangos de
 * `OPERATION_RANGES.screwContainer` / `screwFit`; un valor fuera de rango o de tipo es un error tipado, nunca se acota.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { OPERATION_RANGES as OR } from '../../engine/operationLimits';
import {
  SCREW_CONTAINER_BASES,
  SCREW_CONTAINER_GRIPS,
  type ScrewContainerOptions,
} from '../../engine/screwContainer';
import { threadDefaults } from '../../engine/threadDefaults';
import { CommandError } from './commandErrors';
import { readEnum, readNumber, readRange, type RawParams } from './commandValidation';

/** Receta incorporada que crea el recipiente (el comando `create_screw_container` y el MCP la ejecutan). */
export const SCREW_CONTAINER_RECIPE_ID = 'kura.tapa-roscada';

export const SCREW_CONTAINER_PARTS = ['body', 'lid'] as const;
export type ScrewContainerPart = (typeof SCREW_CONTAINER_PARTS)[number];

/** Claves numéricas del recipiente (mismo nombre en receta, bus y MCP). */
export const SCREW_CONTAINER_NUMBER_KEYS = [
  'innerDiameterMm', 'innerHeightMm', 'wallMm', 'bottomMm', 'pitchMm', 'starts', 'turns', 'radialClearanceMm', 'axialClearanceMm',
] as const;

const missing = (param: string, expected: string) => new CommandError('invalid-params', 'bus.error.invalidParam', { param, expected });

function readInteger(p: RawParams, range: { min: number; max: number }, key: string): number | undefined {
  return readNumber(p, { min: range.min, max: range.max, integer: true }, key);
}

/** Opciones parciales del recipiente (lo omitido toma el valor por defecto del motor). */
export function parseScrewContainer(p: RawParams): Partial<ScrewContainerOptions> {
  const out: Record<string, unknown> = {};
  for (const key of SCREW_CONTAINER_NUMBER_KEYS) {
    const v = key === 'starts' ? readInteger(p, OR.screwContainer.starts, key) : readRange(p, OR.screwContainer[key], key);
    if (v !== undefined) out[key] = v;
  }
  const grip = readEnum(p, SCREW_CONTAINER_GRIPS, 'grip');
  const base = readEnum(p, SCREW_CONTAINER_BASES, 'base');
  if (grip !== undefined) out.grip = grip;
  if (base !== undefined) out.base = base;
  return out as Partial<ScrewContainerOptions>;
}

export function parseScrewContainerPart(p: RawParams): ScrewContainerPart {
  const part = readEnum(p, SCREW_CONTAINER_PARTS, 'part');
  if (part === undefined) throw missing('part', SCREW_CONTAINER_PARTS.join(' | '));
  return part;
}

export const THREAD_PAIRS = ['bolt-nut', 'hole-bolt'] as const;

/** Pareja de roscas ISO (`create_thread_pair`): sin paso ni largo, los del diámetro. */
export function parseThreadPair(p: RawParams) {
  const pair = readEnum(p, THREAD_PAIRS, 'pair') ?? 'bolt-nut';
  const diameterMm = readRange(p, OR.thread.diameterMm, 'diameterMm') ?? 8;
  const defaults = threadDefaults(diameterMm, 'bolt');
  return {
    pair,
    diameterMm,
    pitchMm: readRange(p, OR.thread.pitchMm, 'pitchMm') ?? defaults.pitchMm,
    lengthMm: readRange(p, OR.thread.lengthMm, 'lengthMm') ?? defaults.lengthMm,
    clearanceMm: readRange(p, OR.thread.clearanceMm, 'clearanceMm'),
  };
}

export interface ScrewFitInput {
  readonly leadMm: number;
  readonly turns?: number;
  readonly samples?: number;
  /** Eje de la rosca en ejes del usuario. */
  readonly axis: 'x' | 'y' | 'z';
}

export function parseScrewFit(p: RawParams): ScrewFitInput {
  const leadMm = readRange(p, OR.screwFit.leadMm, 'leadMm');
  if (leadMm === undefined) throw missing('leadMm', `number ∈ [${OR.screwFit.leadMm.min}, ${OR.screwFit.leadMm.max}]`);
  const samples = readInteger(p, OR.screwFit.samples, 'samples');
  return {
    leadMm,
    turns: readRange(p, OR.screwFit.turns, 'turns'),
    samples,
    axis: readEnum(p, ['x', 'y', 'z'] as const, 'axis') ?? 'z',
  };
}
