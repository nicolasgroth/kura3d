/**
 * @file src/store/plateArrangeCommands.ts
 * @description Comando `arrange_on_plates` del Command Bus («Repartir en placas», lote P5): esquema de parámetros
 * (`ids`, `criterion`, `spacingMm`, `marginMm`, `orient`, `plateIds`, `dryRun`) y manejador. Con `dryRun` devuelve el
 * plan y el informe sin tocar escena ni historial; sin él lo aplica en un paso de deshacer. Usa las mismas acciones
 * del store que el diálogo. El MCP sin interfaz no tiene placas: no lo expone.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ARRANGE_CRITERIA, ARRANGE_ORIENTS, ARRANGE_RANGES, type ArrangeOptions, type ArrangeReport } from '../core/scene/plateArrangeTypes';
import { CommandError } from './commandErrors';
import { findObject } from './commandTargets';
import { readBoolean, readEnum, readIds, readRange, type RawParams } from './commandValidation';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState };

export interface ArrangeOnPlatesRequest {
  options: ArrangeOptions;
  dryRun: boolean;
}

/** Valida los parámetros contra la escena (ids y placas existentes). */
export function parseArrangeOnPlates(state: Pick<KuraStoreState, 'objects' | 'selectedIds' | 'plates'>, p: RawParams): ArrangeOnPlatesRequest {
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

const failed = () => new CommandError('failed', 'bus.error.failed', { command: 'arrange_on_plates' });

const reportToUser = (r: ArrangeReport) => ({
  platesUsed: r.platesUsed, platesCreated: r.platesCreated, placed: r.placed, moved: r.moved,
  unplaced: r.unplaced, skipped: r.skipped, splitGroups: r.splitGroups, keptOrientation: r.keptOrientation,
});

export const PLATE_ARRANGE_HANDLERS = {
  arrange_on_plates: async (p: RawParams, { get }: Deps) => {
    const request = parseArrangeOnPlates(get(), p);
    if (request.dryRun) {
      const preview = await get().planArrangeOnPlates(request.options);
      if (!preview) throw failed();
      return {
        dryRun: true,
        ...reportToUser(preview.report),
        // Destino de cada objeto que se movería (ids de placa existentes, `implicit` o claves `new:N`).
        assignments: preview.plan.placements.map((pl) => ({ id: pl.id, plate: pl.plate })),
      };
    }
    const report = await get().arrangeOnPlatesApply(request.options);
    if (!report) throw failed();
    return {
      dryRun: false,
      ...reportToUser(report),
      assignments: get().objects.filter((o) => report.placed.includes(o.id)).map((o) => ({ id: o.id, plate: o.plateRef ?? null })),
    };
  },
};
