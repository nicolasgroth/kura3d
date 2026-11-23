/**
 * @file src/store/slices/repairSlice.ts
 * @description Slice de "Reparar malla": diagnosticar (solo lectura, resalta bordes abiertos) y
 * reparar en el Worker del motor con progreso, cancelación y un paso de deshacer. El aviso final
 * resume lo hecho; los avisos del motor dicen lo que no se pudo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../../engine';
import type { SceneChange } from '../../core/operations/operationTypes';
import { formatNumber } from '../../utils/plural';
import { focusById } from '../../utils/focusById';

/** Id de la tarjeta de estadísticas de geometría del inspector (destino de «Ver detalles»). */
export const GEOMETRY_STATS_ID = 'kura-geometry-stats';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Texto corto de lo que hizo la reparación (claves `repair.part.*`). */
export function repairSummaryText(tr: StoreContext['tr'], lang: KuraStoreState['language'], r: engine.MeshRepairReport): string {
  const n = (x: number) => formatNumber(lang, x);
  const parts: string[] = [];
  if (r.filledHoles > 0) parts.push(tr('repair.part.holes', { count: n(r.filledHoles) }));
  if (r.removedDuplicate + r.removedDegenerate > 0) parts.push(tr('repair.part.faces', { count: n(r.removedDuplicate + r.removedDegenerate) }));
  if (r.flippedFaces > 0 || r.reorientedShells > 0) parts.push(tr('repair.part.flipped', { count: n(r.flippedFaces + r.reorientedShells) }));
  if (r.splitVertices + r.droppedFaces > 0) parts.push(tr('repair.part.nonManifold', { count: n(r.before.nonManifoldEdges) }));
  if (r.removedShells > 0) parts.push(tr('repair.part.shells', { count: n(r.removedShells) }));
  if (parts.length === 0) parts.push(tr('repair.part.welded'));
  return parts.join(' · ');
}

export function createRepairSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, runExclusive, assertCurrent, commitChange, runEngine, reportEngineWarnings, reportOperationError } = ctx;

  return {
    meshDiagnosis: null,
    clearMeshDiagnosis: () => set({ meshDiagnosis: null }),

    diagnoseObjectMesh: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return null;
      try {
        const diagnosis = await ctx.runEngineDetached('diagnoseMesh', { mesh: { positions: obj.mesh.positions, indices: obj.mesh.indices } });
        if (get().objects.find((o) => o.id === id)?.mesh === obj.mesh) {
          // Un diagnóstico solo informativo no apaga un resaltado ya pedido para esa misma malla.
          const prev = get().meshDiagnosis;
          const keep = prev?.objectId === id && prev.mesh === obj.mesh && prev.highlight !== false;
          const highlight = options?.highlight === false && !keep ? false : undefined;
          set({ meshDiagnosis: { objectId: id, mesh: obj.mesh, diagnosis, ...(highlight === false ? { highlight } : {}) } });
        }
        return diagnosis;
      } catch (err) {
        reportOperationError(err);
        return null;
      }
    },

    setOpenEdgesVisible: async (id, visible) => {
      const obj = get().objects.find((o) => o.id === id);
      const prev = get().meshDiagnosis;
      if (!obj) return;
      if (prev && prev.objectId === id && prev.mesh === obj.mesh) {
        set({ meshDiagnosis: { ...prev, highlight: visible } });
        return;
      }
      if (!visible) return;
      await get().diagnoseObjectMesh(id);
    },

    repairObjectMesh: async (id, options) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return null;
      if (obj.locked) {
        get().addToast(tr('store.error.locked'), 'error');
        return null;
      }
      return runExclusive('repair', null, async () => {
        await get().initEngine();
        const { report, change } = await runEngine('repair', { obj, options });
        assertCurrent([obj]);
        if (!report.changed) {
          get().addToast(tr('toast.repairNothing'), 'info');
          reportEngineWarnings(change.warnings);
          return report;
        }
        commitChange(change, { extra: { meshDiagnosis: null } });
        // El aviso dice qué se reparó y cómo cambió la malla, y lleva a las estadísticas del inspector.
        const lang = get().language;
        const after = get().objects.find((o) => o.id === id)?.stats.triangles ?? obj.stats.triangles;
        const tris = tr('ux3.repair.tris', { before: formatNumber(lang, obj.stats.triangles), after: formatNumber(lang, after) });
        get().addToast(
          `${tr('toast.repairDone', { summary: repairSummaryText(tr, lang, report) })} · ${tris}`,
          'success',
          { label: tr('toast.printabilityDetails'), run: () => void focusById(GEOMETRY_STATS_ID) },
        );
        reportEngineWarnings(change.warnings);
        return report;
      });
    },

    repairObjectMeshes: async (groups) => {
      // Cada grupo comparte una malla: se repara una vez y el resultado se aplica a todas sus piezas.
      const targets = groups
        .map((ids) => ids.map((id) => get().objects.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => Boolean(o) && !o!.locked))
        .filter((objs) => objs.length > 0);
      if (targets.length === 0) return null;
      return runExclusive('repair', null, async () => {
        await get().initEngine();
        const patches: SceneChange['patches'] = [];
        const warnings: engine.EngineWarning[] = [];
        const failed: string[] = [];
        let closed = 0;
        let pieces = 0;
        for (const objs of targets) {
          const [first, ...rest] = objs;
          const { report, change } = await runEngine('repair', { obj: first });
          assertCurrent(objs);
          warnings.push(...change.warnings);
          const patch = change.patches.find((p) => p.id === first.id)?.patch;
          if (patch) {
            patches.push({ id: first.id, patch });
            // Las estadísticas son locales a la malla: las comparten todas las piezas que la usan.
            for (const o of rest) patches.push({ id: o.id, patch });
          }
          if (report.after.closed) {
            closed++;
            pieces += objs.length;
          } else failed.push(first.name);
        }
        if (patches.length > 0) {
          commitChange({ added: [], removedIds: [], patches, warnings: [] }, { extra: { meshDiagnosis: null } });
        }
        const total = targets.length;
        const text = failed.length === 0
          ? tr('realesMotor.repairAllDone', { closed, total, pieces })
          : tr('realesMotor.repairAllPartial', { closed, total, pieces, list: failed.slice(0, 3).join(', ') + (failed.length > 3 ? '…' : '') });
        get().addToast(text, failed.length === 0 ? 'success' : 'info');
        reportEngineWarnings(warnings);
        return { closed, total, failed };
      });
    },
  };
}
