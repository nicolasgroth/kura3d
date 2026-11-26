/**
 * @file src/store/exportCommands.ts
 * @description Comandos `export_stl` y `export_3mf` del Command Bus, con las reglas de exportar por placa (lote P6):
 * cada pieza respecto de la cama de su placa y, con `plateId`, solo esa placa. Con bytes (MCP o sin interfaz), un
 * 3MF con piezas de varias placas lleva todas las placas en un archivo; un STL con varias placas pide `plateId` (un
 * STL no tiene placas y el MCP escribe un solo `.stl`). Sin bytes, la app guarda como el diálogo (varias placas en
 * STL = un ZIP con un archivo por placa). Lo que no tiene placa se excluye y se informa en `skippedUnplaced`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { projectMetaOf } from '../project/projectMeta3mf';
import { projectBed } from '../core/scene/activePlateBed';
import { BRAND } from '../brand';
import * as engine from '../engine';
import type { SceneObject } from '../types/kura';
import { CommandError } from './commandErrors';
import * as schema from './commandSchemas';
import type { RawParams } from './commandValidation';
import { selectExportTargets } from './exportTargets';
import { onlyPlate, singleFilePlan } from './plateExportFlow';
import { printPosedObjects } from './sceneLayout';
import type { KuraStoreState } from './useKuraStore';

type Deps = { get: () => KuraStoreState; toBase64: (bytes: Uint8Array) => string };

const triangles = (objs: SceneObject[]) => objs.reduce((acc, o) => acc + o.stats.triangles, 0);
const headless = () => typeof document === 'undefined';

function required<T>(value: T, command: string): NonNullable<T> {
  if (value === null || value === undefined || value === false) throw new CommandError('failed', 'bus.error.failed', { command });
  return value as NonNullable<T>;
}

/** Piezas a exportar (siempre en pose de impresión), ya reducidas a la placa pedida. */
function scopedTargets(deps: Deps, input: schema.ExportInput) {
  const state = deps.get();
  const plates = state.plates ?? [];
  if (input.plateId && !plates.some((p) => p.id === input.plateId)) throw new CommandError('not-found', 'bus.error.plateNotFound', { id: input.plateId });
  const selection = selectExportTargets(printPosedObjects(state), state.selectedIds, input.onlySelected);
  const targets = input.plateId ? onlyPlate(selection.targets, plates, input.plateId) : selection.targets;
  if (targets.length === 0) throw new CommandError('precondition', 'toast.nothingToExport');
  const plan = singleFilePlan(targets, plates);
  if (plan.targets.length === 0) throw new CommandError('precondition', 'toast.nothingToExport');
  return { plan, skippedHoles: selection.skippedHoles, skippedReferences: selection.skippedReferences };
}

export const EXPORT_HANDLERS = {
  export_stl: async (p: RawParams, deps: Deps, command: string) => {
    const input = schema.parseExport(p);
    if (input.wantsBytes || headless()) {
      const { plan, skippedHoles, skippedReferences } = scopedTargets(deps, input);
      if (plan.plateCount >= 2) throw new CommandError('precondition', 'bus.error.exportPlatesNeedPlateId', { count: plan.plateCount });
      const bytes = engine.exportSceneToBinarySTL(plan.targets, engine.stlBrandHeader(BRAND));
      return {
        format: 'stl', bytesBase64: deps.toBase64(bytes), triangleCount: triangles(plan.targets), skippedHoles, skippedReferences,
        skippedUnplaced: plan.excluded, plateCount: plan.plateCount,
      };
    }
    if (input.plateId) scopedTargets(deps, input);
    required(await deps.get().exportSceneStl(input.onlySelected, input.plateId), command);
    return { format: 'stl' };
  },

  // `slicerTarget` está obsoleto: se acepta e ignora (un único 3MF estándar, compatible con OrcaSlicer, Bambu Studio, PrusaSlicer y Cura).
  export_3mf: async (p: RawParams, deps: Deps, command: string) => {
    const input = schema.parseExport(p);
    if (input.wantsBytes || headless()) {
      const { plan, skippedHoles, skippedReferences } = scopedTargets(deps, input);
      const bytes = engine.exportSceneTo3MF(plan.targets, deps.get().unitSystem, undefined, BRAND, undefined, plan.plateLayout, projectMetaOf(deps.get()), projectBed(deps.get()));
      return {
        format: '3mf', bytesBase64: deps.toBase64(bytes), triangleCount: triangles(plan.targets), skippedHoles, skippedReferences,
        skippedUnplaced: plan.excluded, plateCount: plan.plateCount,
      };
    }
    if (input.plateId) scopedTargets(deps, input);
    required(await deps.get().exportScene3mf(input.onlySelected, input.plateId), command);
    return { format: '3mf' };
  },
};
