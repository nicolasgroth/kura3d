/**
 * @file src/core/bus/plateArrangeSchema.ts
 * @description Esquema compartido del comando `arrange_on_plates` («Repartir en placas»): validación de parámetros
 * (`ids`, `criterion`, `spacingMm`, `marginMm`, `orient`, `plateIds`, `dryRun`) contra la escena y forma del informe.
 * Lo usan igual el bus de la app (`store/plateArrangeCommands.ts`) y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ARRANGE_CRITERIA, ARRANGE_ORIENTS, ARRANGE_RANGES, type ArrangeOptions, type ArrangeReport } from '../scene/plateArrangeTypes';
import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { CommandError } from './commandErrors';
import { findObject } from './commandTargets';
import { readBoolean, readEnum, readIds, readRange, type RawParams } from './commandValidation';

export interface ArrangeOnPlatesRequest {
  options: ArrangeOptions;
  dryRun: boolean;
}

/** Valida los parámetros contra la escena (ids y placas existentes). */
export function parseArrangeOnPlates(state: { objects: SceneObject[]; selectedIds: string[]; plates: ScenePlate[] }, p: RawParams): ArrangeOnPlatesRequest {
  const ids = readIds(p, 'ids', 'objectIds');
  for (const id of ids ?? []) findObject(state, id);
  const plateIds = readIds(p, 'plateIds');
  for (const id of plateIds ?? []) {
    if (!state.plates.some((pl) => pl.id === id)) throw new CommandError('not-found', 'bus.error.plateNotFound', { id });
  }
  return {
    dryRun: readBoolean(p, 'dryRun') ?? false,
    options: {
      ids: ids ?? null,
      criterion: readEnum(p, ARRANGE_CRITERIA, 'criterion') ?? 'compact',
      spacingMm: readRange(p, ARRANGE_RANGES.spacingMm, 'spacingMm') ?? ARRANGE_RANGES.spacingMm.default,
      marginMm: readRange(p, ARRANGE_RANGES.marginMm, 'marginMm') ?? ARRANGE_RANGES.marginMm.default,
      orient: readEnum(p, ARRANGE_ORIENTS, 'orient') ?? 'keep',
      plateIds: plateIds ?? null,
    },
  };
}

/** Informe en la respuesta (mismo en la app y en el MCP sin interfaz). */
export const arrangeReportToUser = (r: ArrangeReport) => ({
  platesUsed: r.platesUsed, platesCreated: r.platesCreated, placed: r.placed, moved: r.moved,
  unplaced: r.unplaced, skipped: r.skipped, splitGroups: r.splitGroups, keptOrientation: r.keptOrientation,
});

