/**
 * @file src/store/slices/geometrySlice.ts
 * @description Slice de operaciones geométricas sobre objetos existentes: booleanas, aplicar
 * huecos, ahuecar, simplificar, refinar, envolvente, reflejar, textura, goma, proyección,
 * imprimibilidad y pintado. Cada acción valida bloqueos, delega en `src/core/operations` y
 * aplica el `SceneChange` con historial y aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { boxesOverlap } from '../../core/scene/overlap';
import * as ops from '../../core/operations';
import { resolveBooleanInputs, resolveHoleScope, resolveHullTargets } from '../../core/scene/sceneRules';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { formatNumber } from '../../utils/plural';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { userAxisLabel } from '../../core/scene/displayAxes';

export function createGeometrySlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, rejectWhileLocked, opCtx, assertCurrent, commitChange, runtime, runEngine } = ctx;
  const { reportOperationError, reportEngineWarnings } = ctx;

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };

  return {
    runBooleanOnSelection: async (op, explicitTargetId, explicitToolId) => {
      const { objects, selectedIds } = get();
      const inputs = resolveBooleanInputs(objects, selectedIds, explicitTargetId, explicitToolId);
      if (!inputs || rejectWhileLocked()) return null;
      const all = [inputs.target, inputs.tool, ...inputs.extrasInSceneOrder];
      // Los objetos bloqueados no se consumen ni se modifican.
      if (all.some((o) => o.locked)) {
        get().addToast(tr('store.error.locked'), 'error');
        return null;
      }
      // Restar o intersectar piezas que no se tocan no cambia nada: se avisa sin crear paso de historial.
      const tools = [inputs.tool, ...inputs.extras];
      if (op !== 'union' && !tools.some((tool) => boxesOverlap(inputs.target, tool))) {
        get().addToast(tr('toast.booleanNoContact'), 'info');
        return null;
      }
      return runExclusive(`boolean:${op}`, null, async () => {
        const { result, change } = await runEngine('boolean', {
          target: inputs.target,
          tools: [inputs.tool, ...inputs.extras],
          op,
          name: opCtx().naming.booleanResult(op, all),
        });
        assertCurrent(all);
        // Piezas que no se tocan: aviso BOOLEAN_NO_EFFECT, sin cambio de escena ni historial.
        if (!result) {
          reportEngineWarnings(change.warnings);
          return null;
        }
        commitChange(change, { select: [result.id] });
        get().addToast(tr(`toast.booleanDone.${op}`), 'success');
        return result;
      });
    },

    applyHolesOnSolids: async () => {
      const { objects, selectedIds } = get();
      // Los objetos bloqueados ni se recortan ni se consumen.
      const { solids, holes } = resolveHoleScope(objects, selectedIds);
      if (solids.length === 0 || holes.length === 0 || rejectWhileLocked()) return;
      return runExclusive('apply_holes', undefined, async () => {
        const { updated, change } = await runEngine('applyHoles', { solids, holes });
        assertCurrent([...solids, ...holes]);
        commitChange(change, { select: updated.map((s) => s.id) });
        get().addToast(tr('toast.booleanDone.subtract'), 'success');
      });
    },

    hollowObject: async (id, options) => {
      const obj = editable(id);
      if (!obj) return false;
      return runExclusive('hollow', false, async () => {
        const change = await runEngine('hollow', { obj, options });
        assertCurrent([obj]);
        commitChange(change);
        // Muestra la pared con un corte de sección temporal (el aviso explica cómo volver).
        get().showInteriorSection(id);
        get().addToast(tr('toast.hollowDone', { thickness: options.wallThickness }), 'success');
        reportEngineWarnings(change.warnings);
        return true;
      });
    },

    simplifySelectedMesh: async (id, toleranceMm) => {
      const obj = editable(id);
      if (!obj) return false;
      return runExclusive('simplify', false, async () => {
        await get().initEngine();
        const change = await runEngine('simplify', { obj, toleranceMm });
        assertCurrent([obj]);
        const before = obj.stats.triangles;
        const tris = change.patches[0].patch.stats!.triangles;
        // Sin reducción no hay paso de historial: el aviso lo dice tal cual.
        if (tris >= before) {
          get().addToast(tr('toast.simplifyNoChange', { tris: formatNumber(get().language, before) }), 'info');
          return false;
        }
        commitChange(change);
        const lang = get().language;
        get().addToast(tr('toast.simplifyDone', { before: formatNumber(lang, before), tris: formatNumber(lang, tris) }), 'success');
        return true;
      });
    },

    refineSelectedMesh: async (id, targetEdgeLengthMm, smooth = false) => {
      const obj = editable(id);
      if (!obj) return false;
      return runExclusive('refine', false, async () => {
        await get().initEngine();
        const change = await runEngine('refine', { obj, edgeMm: targetEdgeLengthMm, smooth });
        assertCurrent([obj]);
        commitChange(change);
        const tris = change.patches[0].patch.stats!.triangles;
        get().addToast(tr('toast.refineDone', { tris: formatNumber(get().language, tris) }), 'success');
        reportEngineWarnings(change.warnings);
        return true;
      });
    },

    runConvexHull: async (ids) => {
      const { objects, selectedIds } = get();
      const targetObjs = resolveHullTargets(objects, selectedIds, ids);
      if (targetObjs.length === 0) return null;
      return runExclusive('convex_hull', null, async () => {
        await get().initEngine();
        const { result, change } = await runEngine('convexHull', { targets: targetObjs });
        assertCurrent(targetObjs);
        commitChange(change, { select: [result.id], spawned: [result] });
        get().addToast(tr('toast.hullDone'), 'success');
        return result;
      });
    },

    mirrorObject: (id, axis) => {
      const obj = editable(id);
      if (!obj) return false;
      try {
        const change = ops.mirrorObject(opCtx(), obj, axis);
        commitChange(change, {
          extra: { activeSegmentation: get().activeSegmentation?.objectId === id ? null : get().activeSegmentation },
        });
        get().addToast(tr('toast.mirrored', { axis: userAxisLabel(axis) }), 'success');
        return true;
      } catch (err) {
        reportOperationError(err);
        return false;
      }
    },

    applyTextureToObject: (id, options) => {
      const obj = editable(id);
      if (!obj) return false;
      try {
        commitChange(ops.textureObject(opCtx(), obj, options));
        get().addToast(tr('toast.textureDone', { pattern: options.pattern }), 'success');
        return true;
      } catch (err) {
        reportOperationError(err);
        return false;
      }
    },

    eraseSphereOnObject: async (id, worldCenter, radiusMm) => {
      const obj = editable(id);
      if (!obj) return;
      return runExclusive('erase', undefined, async () => {
        const change = await runEngine('erase', { obj, center: worldCenter, radiusMm: radiusMm ?? get().eraseRadiusMm });
        assertCurrent([obj]);
        commitChange(change);
        get().addToast(tr('toast.erased'), 'success');
      });
    },

    projectOnObjectSurface: async (id, options) => {
      const obj = editable(id);
      if (!obj) return null;
      return runExclusive('project_surface', null, async () => {
        await get().initEngine();
        const change = await runEngine('projectSurface', { obj, options });
        assertCurrent([obj]);
        commitChange(change, { select: [id] });
        get().addToast(tr('toast.projectDone', { name: obj.name }), 'success');
        get().requestCameraPreset('ensure', [id]);
        return get().objects.find((o) => o.id === id) ?? null;
      });
    },

    runPrintabilityCheck: async (
      id,
      infillPercent: number = OPERATION_DEFAULTS.printability.infillPercent,
      overhangAngleDeg: number = OPERATION_DEFAULTS.printability.overhangAngleDeg,
      minWallMm,
    ) => {
      const { objects, printerProfile } = get();
      const obj = objects.find((o) => o.id === id);
      if (!obj) return null;
      try {
        // Solo lectura: corre en el Worker sin tomar el bloqueo de operaciones.
        const report = await ctx.runEngineDetached('printability', {
          obj,
          bed: printerProfile,
          materialId: obj.materialPreset ?? 'pla_matte',
          infillPercent,
          overhangAngleDeg,
          minWallMm,
        });
        // Si el objeto cambió mientras se analizaba, el informe ya no corresponde: no se muestra.
        if (get().objects.find((o) => o.id === id) !== obj) return report;
        set({ activePrintReport: report, printReportSource: obj, showOverhangs: report.overhangFaceCount > 0 });
        get().addToast(
          tr('toast.printabilityDone', { score: report.score, weight: report.estimatedWeightGrams.toFixed(1) }),
          report.score >= 70 ? 'success' : 'info',
        );
        return report;
      } catch (err) {
        reportOperationError(err);
        return null;
      }
    },

    paintObjectSurface: (id, localPoint, faceIndex, modeOverride) => {
      const state = get();
      const obj = editable(id);
      // Durante una operación en curso (o un arrastre sin confirmar) no se pinta: el resultado la pisaría.
      if (!obj || rejectWhileLocked()) return;
      const mode = modeOverride ?? state.paintMode;
      const color = state.paintColor;
      let change: ops.SceneChange | null;
      if (mode === 'whole') {
        change = ops.paintWholeObject(opCtx(), obj, color, false);
      } else if (mode === 'smart_fill' && faceIndex !== null) {
        change = ops.paintRegion(opCtx(), obj, faceIndex, color);
      } else if (localPoint) {
        change = ops.paintBrushSample(opCtx(), obj, localPoint, state.paintRadiusMm, color, { refineEdge: state.paintRefineEdge });
      } else {
        return;
      }
      // Sin cambios de color (pasar el pincel sobre caras ya pintadas): ni historial ni render.
      if (!change || change.patches.length === 0) return;
      const stroke = runtime.paintStroke;
      if (!stroke.open || !stroke.recorded) {
        pushHistory();
        stroke.recorded = true;
      }
      set((prev) => ({ objects: ops.applySceneChange(prev.objects, change) }));
    },

    beginPaintStroke: () => {
      runtime.paintStroke = { open: true, recorded: false };
    },
    endPaintStroke: () => {
      runtime.paintStroke = { open: false, recorded: false };
    },
  };
}
