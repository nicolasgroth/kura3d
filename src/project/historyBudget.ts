/**
 * @file src/project/historyBudget.ts
 * @description Memoria retenida por el historial de deshacer/rehacer y recorte por presupuesto. Los
 * snapshots comparten por referencia las mallas que no cambiaron, así que cada buffer (posiciones,
 * índices, normales, colores por cara) se cuenta UNA vez por identidad, más un costo fijo por objeto
 * y por paso; un delta de pintura cuenta solo sus arreglos. Funciones puras, sin dependencia del store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { formatLocaleNumber } from '../i18n/numberLocale';
import type { LanguageCode } from '../types/kura';
import { faceColorDeltaBytes } from '../engine/paint/colorDelta';
import type { MeshData } from '../types/kura';
import { isPaintDeltaStep, type HistoryStep } from '../store/historySteps';

type SceneSnapshot = HistoryStep;

/** Costo fijo estimado de un paso del historial (arreglos, selección, envoltorio). */
export const STEP_OVERHEAD_BYTES = 256;
/** Costo fijo estimado de cada objeto de escena dentro de un paso (vectores, stats, textura…). */
export const OBJECT_OVERHEAD_BYTES = 640;
/** Costo estimado de cada color por cara guardado como texto. */
const FACE_COLOR_BYTES = 12;

export interface HistoryLimits {
  /** Presupuesto de memoria estimada del historial, en MB. */
  budgetMb: number;
  /** Máximo duro de pasos (pasado + futuro). */
  maxSteps: number;
}

export const BUDGET_OPTIONS_MB = [64, 128, 256, 512, 1024] as const;
export const MIN_HISTORY_STEPS = 50;
export const MAX_HISTORY_STEPS = 2000;
export const DEFAULT_MAX_STEPS = 500;
export const DEFAULT_BUDGET_MB = 256;
export const LOW_MEMORY_BUDGET_MB = 96;
/** Presupuesto propio del archivo `.kura`: lo que ocurra primero entre pasos y bytes. */
export const FILE_HISTORY_MAX_STEPS = 40;
export const FILE_HISTORY_BUDGET_MB = 64;
const MB = 1024 * 1024;

export interface HistoryUsage {
  steps: number;
  bytes: number;
}

type Buffer = object;

/** Buffers de una malla con su tamaño estimado (todos distintos por identidad). */
function meshBuffers(mesh: MeshData): Array<[Buffer, number]> {
  const out: Array<[Buffer, number]> = [
    [mesh.positions, mesh.positions.byteLength],
    [mesh.indices, mesh.indices.byteLength],
  ];
  if (mesh.normals) out.push([mesh.normals, mesh.normals.byteLength]);
  if (mesh.faceColors) out.push([mesh.faceColors, mesh.faceColors.length * FACE_COLOR_BYTES]);
  return out;
}

function stepBuffers(step: SceneSnapshot): Array<[Buffer, number]> {
  // Un delta de pintura retiene solo sus arreglos (los índices los comparte con la escena).
  if (isPaintDeltaStep(step)) return [[step.delta, faceColorDeltaBytes(step.delta)]];
  const out: Array<[Buffer, number]> = [];
  for (const obj of step.objects) out.push(...meshBuffers(obj.mesh));
  return out;
}

function stepFixedBytes(step: SceneSnapshot): number {
  if (isPaintDeltaStep(step)) return STEP_OVERHEAD_BYTES;
  return STEP_OVERHEAD_BYTES + step.objects.length * OBJECT_OVERHEAD_BYTES;
}

/** Bytes retenidos por una lista de pasos, contando cada buffer una sola vez. */
export function estimateHistoryBytes(steps: readonly SceneSnapshot[]): number {
  const seen = new Set<Buffer>();
  let total = 0;
  for (const step of steps) {
    total += stepFixedBytes(step);
    for (const [buf, size] of stepBuffers(step)) {
      if (seen.has(buf)) continue;
      seen.add(buf);
      total += size;
    }
  }
  return total;
}

export function describeHistoryUsage(past: readonly SceneSnapshot[], future: readonly SceneSnapshot[]): HistoryUsage {
  return { steps: past.length + future.length, bytes: estimateHistoryBytes([...past, ...future]) };
}

export interface TrimResult<T extends HistoryStep = HistoryStep> {
  past: T[];
  future: T[];
  /** Pasos descartados por superar el presupuesto de memoria. */
  droppedByBudget: number;
  /** Pasos descartados por superar el máximo de pasos. */
  droppedByCount: number;
}

/**
 * Descarta primero los pasos más antiguos del pasado y, si aún sobra, los más lejanos del futuro,
 * hasta respetar presupuesto y máximo de pasos. Siempre queda al menos un paso (el último del
 * pasado, o el primero del futuro si no hay pasado) aunque exceda el presupuesto. Devuelve los
 * mismos arreglos si no hay nada que descartar.
 */
export function trimHistory<T extends HistoryStep>(
  past: T[],
  future: T[],
  limits: { budgetBytes: number; maxSteps: number },
): TrimResult<T> {
  const noChange: TrimResult<T> = { past, future, droppedByBudget: 0, droppedByCount: 0 };
  const refs = new Map<Buffer, { size: number; count: number }>();
  let bytes = 0;
  const add = (step: SceneSnapshot, sign: 1 | -1) => {
    bytes += sign * stepFixedBytes(step);
    for (const [buf, size] of stepBuffers(step)) {
      const entry = refs.get(buf);
      if (sign === 1) {
        if (entry) entry.count++;
        else {
          refs.set(buf, { size, count: 1 });
          bytes += size;
        }
      } else if (entry && --entry.count === 0) {
        refs.delete(buf);
        bytes -= entry.size;
      }
    }
  };
  for (const step of past) add(step, 1);
  for (const step of future) add(step, 1);

  let total = past.length + future.length;
  if (total <= limits.maxSteps && bytes <= limits.budgetBytes) return noChange;

  let pastStart = 0;
  let futureEnd = future.length;
  let droppedByBudget = 0;
  let droppedByCount = 0;
  while (total > 1) {
    const overCount = total > limits.maxSteps;
    if (!overCount && bytes <= limits.budgetBytes) break;
    if (past.length - pastStart > 1) add(past[pastStart++], -1);
    else if (futureEnd > 0) add(future[--futureEnd], -1);
    else break;
    total--;
    if (overCount) droppedByCount++;
    else droppedByBudget++;
  }
  return { past: past.slice(pastStart), future: future.slice(0, futureEnd), droppedByBudget, droppedByCount };
}

export function limitsToBytes(limits: HistoryLimits): { budgetBytes: number; maxSteps: number } {
  return { budgetBytes: limits.budgetMb * MB, maxSteps: limits.maxSteps };
}

/** Presupuesto por defecto: menor en equipos con poca memoria o ancho de móvil. */
export function defaultHistoryLimits(env?: { deviceMemory?: number; width?: number }): HistoryLimits {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
  const memory = env?.deviceMemory ?? nav?.deviceMemory;
  const width = env?.width ?? (typeof window !== 'undefined' ? window.innerWidth : undefined);
  const low = (memory !== undefined && memory <= 4) || (width !== undefined && width > 0 && width <= 768);
  return { budgetMb: low ? LOW_MEMORY_BUDGET_MB : DEFAULT_BUDGET_MB, maxSteps: DEFAULT_MAX_STEPS };
}

/** Megabytes legibles: un decimal bajo 10 MB, enteros desde ahí. */
export function formatMb(bytes: number, lang: LanguageCode = 'es'): string {
  const mb = bytes / MB;
  return mb < 10 ? formatLocaleNumber(lang, mb, { maxFrac: 1, minFrac: 1 }) : formatLocaleNumber(lang, Math.round(mb), { maxFrac: 0 });
}

/**
 * Historial que cabe en el archivo `.kura`: los pasos MÁS RECIENTES (los últimos del pasado y los
 * primeros del futuro) hasta 40 pasos o 64 MB, lo que ocurra primero. Mantiene el archivo acotado.
 */
export function trimHistoryForFile<T extends HistoryStep>(
  past: T[],
  future: T[],
): { past: T[]; future: T[] } {
  const result = trimHistory(past, future, {
    budgetBytes: FILE_HISTORY_BUDGET_MB * MB,
    maxSteps: FILE_HISTORY_MAX_STEPS,
  });
  return { past: result.past, future: result.future };
}
