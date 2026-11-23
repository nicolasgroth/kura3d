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
import { formatNumber } from '../../utils/plural';
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

    diagnoseObjectMesh: async (id) => {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return null;
      try {
        const diagnosis = await ctx.runEngineDetached('diagnoseMesh', { mesh: { positions: obj.mesh.positions, indices: obj.mesh.indices } });
        if (get().objects.find((o) => o.id === id)?.mesh === obj.mesh) set({ meshDiagnosis: { objectId: id, mesh: obj.mesh, diagnosis } });
        return diagnosis;
      } catch (err) {
        reportOperationError(err);
        return null;
      }
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
        get().addToast(tr('toast.repairDone', { summary: repairSummaryText(tr, get().language, report) }), 'success');
        reportEngineWarnings(change.warnings);
        return report;
      });
    },
  };
}
