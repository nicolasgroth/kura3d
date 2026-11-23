/**
 * @file src/store/slices/partsSlice.ts
 * @description Slice de operaciones que producen piezas: corte por plano, islas, separación por
 * color, dividir para imprimir (`split_for_bed`), moldes y detección/coloreado/extracción/división de
 * estructuras. Adaptador delgado sobre
 * `src/core/operations/partOperations`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../../engine';
import * as ops from '../../core/operations';
import { keepClearOfOthers, placePartsInFreeSpot, separateCutHalves } from '../../core/scene/freeSpot';
import type { SceneChange } from '../../core/operations/operationTypes';
import { resolveKeptHalf } from '../../core/scene/keptHalf';
import { userAxisLabel, userAxisOfInternal } from '../../core/scene/displayAxes';
import { resolveStructureTarget } from '../../core/scene/sceneRules';
import { hasPaintedFaces } from '../../core/scene/parametric';
import { attachNotesToParts, buildGroupNotes } from '../../core/scene/splitGroupNotes';
import { segmentationMatchesMesh } from '../../engine/segmentationGuards';
import { tCount } from '../../utils/plural';
import type { Vec3 } from '../../types/kura';
import { activeBedSize } from '../bedSize';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export function createPartsSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, runExclusive, opCtx, assertCurrent, commitChange, currentSegmentationFor, runEngine } = ctx;
  const { reportOperationError, reportEngineWarnings } = ctx;

  /**
   * Resultado de una operación que pisa a OTROS objetos (no a la pieza que reemplaza): se mueve como
   * bloque al primer hueco libre y se avisa si no cupo en la cama. Las piezas entre sí no se separan.
   */
  const clearOfOthers = (change: SceneChange): SceneChange => {
    const added = change.added ?? [];
    if (added.length === 0) return change;
    // La pieza de origen (quitada, o recortada a su remanente) no cuenta: las piezas salen de ella.
    const source = new Set([...(change.removedIds ?? []), ...(change.patches ?? []).map((p) => p.id)]);
    const others = get().objects.filter((o) => !source.has(o.id));
    const result = keepClearOfOthers(others, added, activeBedSize(get()));
    if (!result.moved) return change;
    if (!result.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
    get().requestCameraPreset('ensure', result.parts.map((p) => p.id));
    return { ...change, added: result.parts };
  };
  const byIds = (change: SceneChange, ids: readonly string[]) => change.added.filter((o) => ids.includes(o.id));

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };

  return {
    planeCutObject: async (id, options) => {
      const obj = editable(id);
      if (!obj) return [];
      return runExclusive('plane_cut', [], async () => {
        const { parts, change } = await runEngine('planeCut', { obj, options });
        // Primero se confirma que la pieza sigue vigente: un corte descartado no muestra avisos.
        assertCurrent([obj]);
        reportEngineWarnings(change.warnings);
        if (parts.length === 0) return [];
        // Las mitades no quedan encimadas: se separan unos milímetros o la superior va a la cama.
        const others = get().objects.filter((o) => o.id !== obj.id);
        const separated = separateCutHalves(others, parts, options.axis, activeBedSize(get()));
        // Con una sola mitad conservada que no queda en la cama, se aplica lo que eligió el usuario.
        const kept = resolveKeptHalf(others, separated.parts, options, activeBedSize(get()));
        // Si no, y aun así una mitad pisa a otro objeto, el par se mueve junto a un hueco libre.
        // Con `dropToBed` se respeta la elección (aunque se superponga: se avisa).
        const cleared = kept
          ? { ...change, added: [kept.part] }
          : clearOfOthers({ ...change, added: separated.parts });
        commitChange(cleared, { select: cleared.added.map((c) => c.id) });
        // El corte terminó: se vuelve a Seleccionar y se apaga la vista previa del plano.
        set((state) => ({
          activeTool: state.activeTool === 'cut' ? 'select' : state.activeTool,
          cutPreview: { ...state.cutPreview, active: false, objectId: null },
        }));
        const axis = userAxisLabel(options.axis);
        if (kept) {
          // La mitad conservada es la B (lado + del usuario) o la A (lado −), según el eje.
          const isB = (options.keepMode === 'positive') === (userAxisOfInternal(options.axis).sign > 0);
          const half = tr(isB ? 'cut.half.b' : 'cut.half.a', { axis });
          get().addToast(
            tr(kept.applied === 'freeSpot' ? 'toast.cutKeptFreeSpot' : 'toast.cutKeptDropped', { half }),
            'success',
          );
          if (kept.overlaps.length > 0) {
            get().addToast(tr('toast.cutKeptOverlaps', { half, names: kept.overlaps.join(', ') }), 'info');
          }
          if (!kept.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
          return cleared.added;
        }
        get().addToast(
          tr('toast.cutDone', { a: tr('cut.half.a', { axis }), b: tr('cut.half.b', { axis }) }),
          'success',
        );
        if (!separated.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
        return cleared.added;
      });
    },

    splitObjectForBed: async (id, request) => {
      const obj = editable(id);
      if (!obj) return null;
      return runExclusive('split_for_bed', null, async () => {
        const plan = await runEngine('splitPlan', { obj, bed: request.bed, options: request.plan });
        const none = { plan, parts: [], joints: [], plateCount: 0 };
        if (request.dryRun) return none;
        if (plan.fitsWithoutCuts) {
          get().addToast(tr('toast.splitForBedFits'), 'info');
          return none;
        }
        const { result, change } = await runEngine('splitForBed', { obj, plan, options: { ...request.execute, bed: request.bed } });
        assertCurrent([obj]);
        // Lo que dijo el motor viaja con el grupo (se guarda en el .kura) y se muestra junto a cada unión.
        const notes = buildGroupNotes(change.warnings, result.assembly);
        commitChange({ ...change, added: attachNotesToParts(change.added ?? [], notes) }, { select: result.parts.map((p) => p.id) });
        // El grupo dividido se encuadra siempre (aunque haya otros objetos en escena).
        get().requestCameraPreset('focus', result.parts.map((p) => p.id));
        get().addToast(tr('toast.splitForBedDone', { count: result.parts.length, joints: result.joints.length }), 'success');
        reportEngineWarnings(change.warnings);
        get().setSplitNotes(obj.id, notes);
        get().setSplitRequest(obj.id, { objectId: obj.id, request, historyDepth: get().past.length });
        return { plan, parts: result.parts, joints: result.joints, looseDowels: result.looseDowels, plateCount: result.plateCount, assembly: result.assembly };
      });
    },

    validateSplitAssembly: async (targets) => {
      try {
        // Solo lectura: corre en el Worker sin tomar el bloqueo de operaciones.
        return await ctx.runEngineDetached('validateAssembly', { objects: targets });
      } catch (err) {
        reportOperationError(err);
        return null;
      }
    },

    splitDisconnectedObject: async (id) => {
      const obj = editable(id);
      if (!obj) return [];
      return runExclusive('split_parts', [], async () => {
        const { pieceCount, parts, change } = await runEngine('splitDisconnected', { obj });
        if (parts.length === 0) {
          get().addToast(tr('toast.splitPartsDone', { count: pieceCount }), 'info');
          return [obj];
        }
        assertCurrent([obj]);
        const cleared = clearOfOthers(change);
        commitChange(cleared, { select: parts.map((c) => c.id) });
        get().addToast(tr('toast.splitPartsDone', { count: parts.length }), 'success');
        return byIds(cleared, parts.map((c) => c.id));
      });
    },

    splitObjectByColor: async (id, options = {}) => {
      const obj = editable(id);
      if (!obj) return [];
      // Sin zonas pintadas no hay nada que separar: se guía al usuario en vez de «Separado en 1 piezas».
      if (!hasPaintedFaces(obj.mesh)) {
        get().addToast(tr('genUi.splitColors.none'), 'info');
        return [];
      }
      return runExclusive('split_colors', [], async () => {
        const { parts, change } = await runEngine('splitByColor', { obj, options });
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        const cleared = clearOfOthers(change);
        commitChange(cleared, { select: parts.map((c) => c.id) });
        get().addToast(
          tCount(get().language, { one: 'genUi.splitColorsDone.one', other: 'genUi.splitColorsDone.other' }, parts.length),
          'success',
        );
        reportEngineWarnings(change.warnings);
        return byIds(cleared, parts.map((c) => c.id));
      });
    },

    generateMoldForObject: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return [];
      return runExclusive('generate_mold', [], async () => {
        await get().initEngine();
        const { parts, change } = await runEngine('mold', { obj, options });
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        // Las mitades se mueven juntas, como un bloque, a un hueco libre junto a la pieza original.
        // Si una pieza del molde queda sobre otra (p. ej. el positivo dentro de la caja), va sola a otro hueco.
        const spot = placePartsInFreeSpot(get().objects, parts, activeBedSize(get()));
        const placed = spot.parts;
        commitChange({ ...change, added: placed }, { select: placed.map((c) => c.id), spawned: placed });
        const names = placed.map((c) => c.name).join(', ');
        get().addToast(tCount(get().language, { one: 'toast.moldDone.one', other: 'toast.moldDone.other' }, placed.length, { names }), 'success');
        if (!spot.fits) get().addToast(tr('toast.placedOutsideBed'), 'info');
        // El molde queda en un hueco libre que puede estar fuera de la vista: se encuadra siempre.
        get().requestCameraPreset('focus', placed.map((c) => c.id));
        return placed;
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
        const result = await runEngine('detectStructures', { obj, creaseAngleDeg: angle });
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
        const { extracted, change } = await runEngine('extractStructure', { obj, segmentation: seg, region, removeFromSource });
        assertCurrent([obj]);
        // La pieza extraída no queda dentro del objeto de origen: va a un hueco libre.
        const cleared = clearOfOthers(change);
        const placed = byIds(cleared, [extracted.id])[0] ?? extracted;
        commitChange(cleared, {
          select: [placed.id],
          spawned: [placed],
          extra: removeFromSource ? { activeSegmentation: null } : {},
        });
        get().addToast(tr('toast.structureExtracted', { name: placed.name }), 'success');
        return placed;
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
        const { parts, change } = await runEngine('splitStructures', { obj, segmentation });
        if (parts.length === 0) return [];
        assertCurrent([obj]);
        const cleared = clearOfOthers(change);
        const placed = byIds(cleared, parts.map((c) => c.id));
        commitChange(cleared, { select: placed.map((c) => c.id), spawned: placed, extra: { activeSegmentation: null } });
        get().addToast(tr('toast.structuresSplitAll', { count: parts.length }), 'success');
        return placed;
      });
    },
  };
}
