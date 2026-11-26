/**
 * @file src/store/fitCommandSchemas.ts
 * @description Esquema del comando `fit_to_bed` ("Ajustar a la impresora"): objetos (`ids` o la
 * selección, como bloque), cama (por defecto la activa, ejes del usuario: X ancho, Y fondo, Z alto),
 * margen, `dryRun` (solo alternativas) y `alternative` a aplicar. Respuesta en ejes del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { FitAlternativeKind, FitBed } from '../engine/fitToBed';
import type { FitAnalysisResult } from '../core/operations/fitOperations';
import { activeFitBed } from '../core/scene/plateFitBed';
import { OPERATION_RANGES as OR } from '../engine/operationLimits';
import type { SceneObject } from '../types/kura';
import { CommandError } from './commandErrors';
import { resolveIdsOrSelection, type SceneView } from './commandTargets';
import { readBoolean, readEnum, readRange, type RawParams } from './commandValidation';
import type { BedSource } from './splitCommandSchemas';

export const FIT_ALTERNATIVES = ['scale', 'rotate', 'rotateScale'] as const;

export interface FitToBedRequest {
  targets: SceneObject[];
  bed: FitBed;
  dryRun: boolean;
  alternative?: FitAlternativeKind;
}

export function parseFitToBed(scene: SceneView & BedSource & { printerProfile: { marginMm?: number } }, p: RawParams): FitToBedRequest {
  const targets = resolveIdsOrSelection(scene, p, { unlocked: true });
  // Con placas, la cama de la placa de las piezas (P7: puede ser otra impresora); sin placas, la del proyecto.
  const base = activeFitBed(scene, targets);
  const bed: FitBed = {
    widthMm: readRange(p, OR.split.bedMm, 'bedWidthMm') ?? base.widthMm,
    depthMm: readRange(p, OR.split.bedMm, 'bedDepthMm') ?? base.depthMm,
    heightMm: readRange(p, OR.split.bedMm, 'bedHeightMm') ?? base.heightMm,
    marginMm: readRange(p, OR.split.marginMm, 'marginMm') ?? base.marginMm,
  };
  const alternative = readEnum(p, FIT_ALTERNATIVES, 'alternative');
  const dryRun = readBoolean(p, 'dryRun') ?? alternative === undefined;
  if (!dryRun && !alternative) throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'alternative', expected: FIT_ALTERNATIVES.join(' | ') });
  return { targets, bed, dryRun, ...(alternative && !dryRun ? { alternative } : {}) };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Análisis para la respuesta del bus y del MCP (los tamaños ya están en ejes del usuario). */
export function fitAnalysisToUser(a: FitAnalysisResult) {
  return {
    objectIds: a.objectIds,
    bed: a.bed,
    sizeMm: a.sizeMm.map(r2),
    usableMm: a.usableMm.map(r2),
    fitsAsIs: a.fitsAsIs,
    alternatives: a.alternatives.map((alt) => ({
      kind: alt.kind, available: alt.available, ...(alt.reason ? { reason: alt.reason } : {}), recommended: alt.recommended,
      factor: alt.factor, sizeMm: alt.sizeMm.map(r2),
      orientation: { downFace: alt.orientation.downFace, turnZDeg: alt.orientation.turnZDeg, steps: alt.orientation.steps },
      changesDownFace: alt.changesDownFace, warnings: alt.warnings,
      ...(alt.kind === 'split' && alt.available ? { next: 'kura_split_for_bed' } : {}),
    })),
    functional: a.functional,
  };
}
