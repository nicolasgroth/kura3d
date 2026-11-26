/**
 * @file src/store/slices/geometrySlice.ts
 * @description Slice de operaciones geométricas sobre objetos existentes: booleanas, aplicar
 * huecos, ahuecar, simplificar, refinar, envolvente, reflejar, textura, goma, proyección e
 * imprimibilidad (la pintura vive en `paintSlice`). Cada acción valida bloqueos, delega en `src/core/operations` y
 * aplica el `SceneChange` con historial y aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { focusById } from '../../utils/focusById';
import { boxesOverlap } from '../../core/scene/overlap';
import { isReference } from '../../core/scene/objectRole';
import * as ops from '../../core/operations';
import { resolveBooleanInputs, resolveHoleScope, resolveHullTargets, touchingHoleScope } from '../../core/scene/sceneRules';
import { dissolveLoneAddonGroups } from '../../core/scene/addonGroups';
import { withAddonPosts } from '../../core/operations/addonPostMerge';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { classifySimplifyResult } from '../../core/operations/simplifyOutcome';
import type { SimplifyRequest } from '../../engine/simplify';
import { simplifyBlockedToast, simplifySafeAppliedSentence, simplifyWarningText } from '../../i18n/simplifyWarnings';
import { sceneSimplifyReport } from './simplifyPreviewSlice';
import { formatNumber } from '../../utils/plural';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { userAxisLabel } from '../../core/scene/displayAxes';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { undoToastAction } from '../toastActionState';

export function createGeometrySlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, rejectWhileLocked, opCtx, assertCurrent, commitChange, runtime, runEngine } = ctx;
  const { reportOperationError, reportEngineWarnings } = ctx;

  const editable = (id: string) => {
    const obj = get().objects.find((o) => o.id === id);
    return obj && !obj.locked ? obj : null;
  };
  /** Como `editable`, pero rechaza referencias (no se dividen, ahuecan, cortan ni texturizan) con aviso. */
  const shapeable = (id: string) => {
    const obj = editable(id);
    if (obj && isReference(obj)) {
      get().addToast(tr('reference.toast.notAllowed'), 'info');
      return null;
    }
    return obj;
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
      const scope = resolveHoleScope(objects, selectedIds);
      if (scope.solids.length === 0 || scope.holes.length === 0 || rejectWhileLocked()) return false;
      // Solo se recortan los sólidos que algún negativo toca, y solo se consumen esos negativos: los
      // objetos ajenos no se reconstruyen ni quedan seleccionados (evita una segunda resta por error).
      const touching = touchingHoleScope(scope.solids, scope.holes);
      // Los postes de torreta se unen a su pieza al restar: entran juntos al alcance.
      const solids = withAddonPosts(scope.solids, touching.solids);
      const { holes } = touching;
      if (solids.length === 0) {
        get().addToast(tr('toast.booleanNoContact'), 'info');
        return false;
      }
      return runExclusive('apply_holes', false, async () => {
        const { updated, change } = await runEngine('applyHoles', { solids, holes });
        assertCurrent([...solids, ...holes]);
        commitChange(change, { select: updated.map((s) => s.id) });
        // El grupo que creó una torreta para sus piezas deja de tener sentido si solo queda la pieza.
        const scene = { objects: get().objects, groups: get().groups };
        const tidy = dissolveLoneAddonGroups(scene);
        if (tidy !== scene) set({ objects: tidy.objects, groups: tidy.groups });
        get().addToast(tr('toast.booleanDone.subtract'), 'success');
        return true;
      });
    },

    hollowObject: async (id, options) => {
      const obj = shapeable(id);
      if (!obj) return false;
      return runExclusive('hollow', false, async () => {
        const change = await runEngine('hollow', { obj, options });
        assertCurrent([obj]);
        commitChange(change);
        // Muestra la pared con un corte de sección temporal (el aviso explica cómo volver).
        get().showInteriorSection(id);
        get().addToast(tr('toast.hollowDone', { thickness: options.wallThickness }), 'success');
        if (!options.drainHole) get().addToast(tr('toast.hollowSealed'), 'info');
        reportEngineWarnings(change.warnings);
        return true;
      });
    },

    simplifySelectedMesh: async (id, request, options = {}) => {
      const obj = editable(id);
      if (!obj) return false;
      const req: SimplifyRequest = typeof request === 'number' ? { mode: 'tolerance', toleranceMm: request } : request;
      return runExclusive('simplify', false, async () => {
        // La vista previa con la misma malla y parámetros ya lo calculó: se reutiliza en vez de recalcular.
        const previewed = get().consumeSimplifyPreview(obj, req);
        if (!previewed) await get().initEngine();
        const change = previewed ?? await runEngine('simplify', { obj, request: req });
        assertCurrent([obj]);
        const lang = get().language;
        const before = obj.stats.triangles;
        // Informe y avisos usan la malla real de la escena (el motor cuenta la soldada; puede diferir en unos pocos).
        const report = sceneSimplifyReport(obj, change);
        const blocked = !report.applied && (report.destructive?.length ?? 0) > 0;
        options.onReport?.(report);
        // Sin reducción, «Sin pérdida» rechazado o destructivo: no hay paso de historial y el aviso dice por qué.
        if (!report.applied) {
          if (blocked) {
            get().addToast(simplifyBlockedToast(lang, report), 'info');
          } else if (report.warnings.includes('no_reduction')) {
            const key = req.mode === 'tolerance' ? 'toast.simplifyNoChange' : 'simplify.toast.noChange';
            get().addToast(tr(key, { tris: formatNumber(lang, before) }), 'info');
          } else {
            get().addToast(tr('simplify.toast.losslessRejected', { reasons: simplifyWarningText(lang, report, report.rejectedBy) }), 'info');
          }
          return false;
        }
        commitChange(change);
        reportEngineWarnings(change.warnings);
        const tris = change.patches[0].patch.stats?.triangles ?? report.trianglesAfter;
        const outcome = classifySimplifyResult(before, tris);
        const counts = { before: formatNumber(lang, before), tris: formatNumber(lang, tris) };
        // Menos de 1 % de reducción no se anuncia como éxito.
        if (outcome === 'marginal') get().addToast(tr(req.mode === 'tolerance' ? 'toast.simplifyMarginal' : 'simplify.toast.marginal', counts), 'info');
        // Siempre: triángulos antes -> después y cambio de volumen en % (el aviso de > 2 % sigue aparte).
        const pct = report.volumeChangePct;
        const delta = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(Math.round(pct * 100) / 100);
        // Avisos de la verificación (género, volumen, desviación, objetivo) en el mismo aviso: deja de ser «éxito».
        const checks = report.warnings.filter((w) => w !== 'no_reduction');
        const plain = tr('realesMotor.simplifyResult', { before: counts.before, after: counts.tris, delta });
        // Se aplicó la versión segura en lugar de lo pedido: el aviso lo dice primero.
        const result = report.appliedVariant === 'safe' ? `${simplifySafeAppliedSentence(lang, report)} ${plain}` : plain;
        const text = checks.length > 0 ? `${result} ${tr('simplify.toast.check', { reasons: simplifyWarningText(lang, report, checks) })}` : result;
        get().addToast(
          text,
          outcome === 'marginal' || checks.length > 0 || report.appliedVariant === 'safe' ? 'info' : 'success',
          // Persistente: Simplificar tarda (minutos en mallas de millones) y el aviso no debe caducar antes de que se vea.
          undoToastAction(tr('toast.undo'), () => get().past, () => get().undo(), true, true),
        );
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
      if (targetObjs.length === 0) {
        const asked = ids && ids.length >= 2 ? ids : selectedIds;
        if (objects.some((o) => asked.includes(o.id) && isReference(o))) get().addToast(tr('reference.toast.notAllowed'), 'info');
        return null;
      }
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
      const obj = shapeable(id);
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
      const obj = shapeable(id);
      if (!obj) return;
      return runExclusive('erase', undefined, async () => {
        const change = await runEngine('erase', { obj, center: worldCenter, radiusMm: radiusMm ?? get().eraseRadiusMm });
        assertCurrent([obj]);
        commitChange(change);
        get().addToast(tr('toast.erased'), 'success');
      });
    },

    projectOnObjectSurface: async (id, options) => {
      const obj = shapeable(id);
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
      if (isReference(obj)) {
        get().addToast(tr('reference.toast.notAllowed'), 'info');
        return null;
      }
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
          `${tr('toast.printabilityDone', { score: report.score, weight: formatLocaleNumber(get().language, report.estimatedWeightGrams, { maxFrac: 1, minFrac: 1 }) })} ${tr('toast.printabilityHelp')}`,
          report.score >= 70 ? 'success' : 'info',
          { label: tr('toast.printabilityDetails'), run: () => void focusById('kura-print-report'), targetIds: [id], transient: true },
        );
        return report;
      } catch (err) {
        reportOperationError(err);
        return null;
      }
    },
  };
}
