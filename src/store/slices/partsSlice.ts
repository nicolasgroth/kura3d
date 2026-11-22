/**
 * @file src/store/slices/partsSlice.ts
 * @description Slice de operaciones que producen piezas: corte por plano, islas, separación por
 * color, moldes y detección/coloreado/extracción/división de estructuras. Adaptador delgado sobre
 * `src/core/operations/partOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import * as ops from '../../core/operations';
import { resolveStructureTarget } from '../../core/scene/sceneRules';
import { segmentationMatchesMesh } from '../../engine/segmentationGuards';
import { tCount } from '../../utils/plural';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createPartsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, runExclusive, opCtx, assertCurrent, commitChange, currentSegmentationFor } = ctx;
  const { reportOperationError, reportEngineWarnings } = ctx;

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };

  return {
    planeCutObject: async (id, options) => {
      const obj = editable(id);
      if (!obj) return [];
      return runExclusive('plane_cut', [], async () => {
        const { parts, change } = await ops.planeCut(opCtx(), obj, options);
        reportEngineWarnings(change.warnings);
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        commitChange(change, { select: parts.map((c) => c.id) });
        get().addToast(tr('toast.cutDone'), 'success');
        return parts;
      });
    },

    splitDisconnectedObject: async (id) => {
      const obj = editable(id);
      if (!obj) return [];
      return runExclusive('split_parts', [], async () => {
        const { pieceCount, parts, change } = await ops.splitDisconnected(opCtx(), obj);
        if (parts.length === 0) {
          get().addToast(tr('toast.splitPartsDone', { count: pieceCount }), 'info');
          return [obj];
        }
        assertCurrent([obj]);
        commitChange(change, { select: parts.map((c) => c.id) });
        get().addToast(tr('toast.splitPartsDone', { count: parts.length }), 'success');
        return parts;
      });
    },

    splitObjectByColor: (id) => {
      const obj = editable(id);
      if (!obj) return [];
      try {
        const { parts, change } = ops.splitByColor(opCtx(), obj);
        if (parts.length === 0) return [];
        commitChange(change, { select: parts.map((c) => c.id) });
        get().addToast(tr('toast.splitColorsDone', { count: parts.length }), 'success');
        reportEngineWarnings(change.warnings);
        return parts;
      } catch (err) {
        reportOperationError(err);
        return [];
      }
    },

    generateMoldForObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return [];
      return runExclusive('generate_mold', [], async () => {
        await get().initEngine();
        const { parts, change } = await ops.generateMold(opCtx(), obj, options);
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        commitChange(change, { select: parts.map((c) => c.id), spawned: parts });
        get().addToast(tCount(get().language, { one: 'toast.moldDone.one', other: 'toast.moldDone.other' }, parts.length), 'success');
        return parts;
      });
    },

    detectObjectStructures: async (id, creaseAngleDeg) => {
      const state = get();
      const obj = resolveStructureTarget(state.objects, state.selectedIds, id);
      if (!obj) return null;
      const angle = typeof creaseAngleDeg === 'number' && Number.isFinite(creaseAngleDeg)
        ? creaseAngleDeg
        : state.segmentationCreaseDeg;
      set({ segmentationCreaseDeg: angle });
      return runExclusive('detect_structures', null, async () => {
        await get().initEngine();
        const result = await engine.detectStructuralRegions(obj, { creaseAngleDeg: angle });
        set({ activeSegmentation: result });
        get().addToast(
          tCount(get().language, { one: 'toast.structuresDetected.one', other: 'toast.structuresDetected.other' }, result.regions.length),
          'success',
        );
        return result;
      });
    },

    colorizeDetectedStructures: async (id) => {
      const state = get();
      const obj = resolveStructureTarget(state.objects, state.selectedIds, id, state.activeSegmentation?.objectId);
      if (!obj || obj.locked) return false;
      const segmentation = currentSegmentationFor(obj) ?? (await get().detectObjectStructures(obj.id));
      if (!segmentation || segmentation.regions.length === 0) return false;
      try {
        commitChange(ops.colorizeStructures(opCtx(), obj, segmentation));
        get().addToast(tr('toast.structuresColorized', { count: segmentation.regions.length }), 'success');
        return true;
      } catch (err) {
        reportOperationError(err);
        return false;
      }
    },

    extractDetectedStructure: async (regionId, removeFromSource = false) => {
      const seg = get().activeSegmentation;
      if (!seg) return null;
      const obj = get().objects.find((o) => o.id === seg.objectId);
      if (!obj || (removeFromSource && obj.locked)) return null;
      const region = seg.regions.find((r) => r.id === regionId);
      if (!region) return null;

      return runExclusive('extract_structure', null, async () => {
        // Índices calculados sobre otra malla no se aplican: se descarta la segmentación.
        if (!segmentationMatchesMesh(obj.mesh, seg)) {
          set({ activeSegmentation: null });
          throw new engine.EngineError('SEGMENTATION_STALE');
        }
        await get().initEngine();
        const { extracted, change } = await ops.extractStructure(opCtx(), obj, seg, region, removeFromSource);
        assertCurrent([obj]);
        commitChange(change, {
          select: [extracted.id],
          spawned: [extracted],
          extra: removeFromSource ? { activeSegmentation: null } : {},
        });
        get().addToast(tr('toast.structureExtracted', { name: extracted.name }), 'success');
        return extracted;
      });
    },

    splitAllDetectedObjectStructures: async (id) => {
      const state = get();
      const obj = resolveStructureTarget(state.objects, state.selectedIds, id, state.activeSegmentation?.objectId);
      if (!obj || obj.locked) return [];
      const segmentation = currentSegmentationFor(obj) ?? (await get().detectObjectStructures(obj.id));
      if (!segmentation || segmentation.regions.length === 0) return [];

      return runExclusive('split_structures', [], async () => {
        await get().initEngine();
        const { parts, change } = await ops.splitStructures(opCtx(), obj, segmentation);
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        commitChange(change, { select: parts.map((c) => c.id), spawned: parts, extra: { activeSegmentation: null } });
        get().addToast(tr('toast.structuresSplitAll', { count: parts.length }), 'success');
        return parts;
      });
    },
  };
}
