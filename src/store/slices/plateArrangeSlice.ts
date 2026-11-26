/**
 * @file src/store/slices/plateArrangeSlice.ts
 * @description «Repartir en placas» en el store (lote P5, sin interfaz): `planArrangeOnPlates` calcula el plan en el
 * Worker sin tocar escena ni historial (vista previa del diálogo; un pedido nuevo descarta el anterior con
 * cancelación suave) y `arrangeOnPlatesApply` lo calcula (o reutiliza la vista previa si la escena no cambió) y lo
 * aplica en UN paso de deshacer: crea placas, asigna `plateRef` y mueve. En armado traslada la pose de impresión
 * (`restPose`), no la figura. Lógica pura en `core/scene/plateArrange.ts` (plan) y `core/scene/arrangeApply.ts` (aplicar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isEngineCancelled, type EngineJob } from '../../core/operations/engineClient';
import type { ArrangeTaskArgs } from '../../core/operations/plateArrangeOperations';
import { projectBed } from '../../core/scene/activePlateBed';
import { applyArrangePlan, firstUsedPlate, reportWithPlateIds } from '../../core/scene/arrangeApply';
import { ARRANGE_RANGES, type ArrangeOptions, type ArrangePlan, type ArrangeReport } from '../../core/scene/plateArrangeTypes';
import { makeId } from '../../core/scene/sceneObjects';
import { StoreOperationError } from '../commandErrors';
import { tagLastPushedStep } from '../historyLabels';
import { printPosedObjects } from '../sceneLayout';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface ArrangePreview {
  plan: ArrangePlan;
  report: ArrangeReport;
}

export interface PlateArrangeSliceState {
  /** Hay una vista previa de «Repartir en placas» calculándose. */
  plateArrangeRunning: boolean;
  /**
   * Plan e informe sin tocar escena ni historial (para el diálogo). null si se canceló, la escena cambió mientras
   * se calculaba o falló (el error ya se avisó). Un pedido nuevo cancela en suave el anterior.
   */
  planArrangeOnPlates: (options?: ArrangeOptions) => Promise<ArrangePreview | null>;
  /**
   * Calcula y aplica el reparto en un paso de deshacer (reutiliza la última vista previa si la escena y las opciones
   * no cambiaron). Devuelve el informe con ids reales de placa, o null si no se pudo (ocupado, cancelado, error).
   * No cambia de modo: en armado mueve las poses de impresión. El paso queda nombrado «Repartir en placas» en el
   * historial. `quiet`: no emite sus avisos (el panel «Repartir en placas…» da el suyo).
   */
  arrangeOnPlatesApply: (options?: ArrangeOptions, flags?: { quiet?: boolean }) => Promise<ArrangeReport | null>;
  /** Cancela en suave la vista previa en curso. */
  cancelArrangeOnPlates: () => void;
}

type Snapshot = Pick<KuraStoreState, 'objects' | 'plates' | 'groups' | 'layout' | 'printerProfile' | 'customBedDimensions'>;

const clamp = (v: number | undefined, r: { min: number; max: number; default: number }) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.default;

/** Opciones saneadas (rango de separación y margen) y en forma canónica (clave de la vista previa). */
export function normalizeArrangeOptions(o: ArrangeOptions = {}): ArrangeOptions {
  return {
    ids: o.ids?.length ? [...o.ids] : null,
    criterion: o.criterion ?? 'compact',
    spacingMm: clamp(o.spacingMm, ARRANGE_RANGES.spacingMm),
    marginMm: clamp(o.marginMm, ARRANGE_RANGES.marginMm),
    orient: o.orient ?? 'keep',
    plateIds: o.plateIds?.length ? [...o.plateIds] : null,
  };
}

const sameScene = (a: Snapshot, b: Snapshot) =>
  a.objects === b.objects && a.plates === b.plates && a.groups === b.groups && a.layout === b.layout
  && a.printerProfile === b.printerProfile && a.customBedDimensions === b.customBedDimensions;

export function createPlateArrangeSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr, pushHistory, runExclusive, runEngine, startEngineJob, reportOperationError } = ctx;
  let job: EngineJob<ArrangePlan> | null = null;
  let last: { key: string; scene: Snapshot; plan: ArrangePlan } | null = null;

  const snapshot = (): Snapshot => {
    const s = get();
    return { objects: s.objects, plates: s.plates, groups: s.groups, layout: s.layout, printerProfile: s.printerProfile, customBedDimensions: s.customBedDimensions };
  };
  // Se llama justo tras `snapshot()`: el estado completo (cama activa, placas) es el de la instantánea.
  const argsOf = (scene: Snapshot, options: ArrangeOptions): ArrangeTaskArgs => ({
    objects: printPosedObjects(get()), plates: scene.plates, groups: scene.groups, projectBed: projectBed(scene), options,
  });
  const plateName = (n: number) => tr('plates.defaultName', { n });

  /** Escena con el plan aplicado (pura salvo los ids nuevos) y el mapa clave → id de placa. */
  const applyPlan = (scene: Snapshot, plan: ArrangePlan) => applyArrangePlan(scene, plan, { makeId: () => makeId('plate'), nameFor: plateName });

  return {
    plateArrangeRunning: false,

    planArrangeOnPlates: async (options) => {
      job?.cancel('soft');
      const opts = normalizeArrangeOptions(options);
      const scene = snapshot();
      const current = startEngineJob('arrangeOnPlates', argsOf(scene, opts));
      job = current;
      set({ plateArrangeRunning: true });
      try {
        const plan = await current.promise;
        if (job !== current) return null;
        job = null;
        set({ plateArrangeRunning: false });
        if (!sameScene(scene, snapshot())) return null;
        last = { key: JSON.stringify(opts), scene, plan };
        return { plan, report: plan.report };
      } catch (err) {
        if (job === current) {
          job = null;
          set({ plateArrangeRunning: false });
        }
        if (!isEngineCancelled(err)) reportOperationError(err);
        return null;
      }
    },

    cancelArrangeOnPlates: () => {
      if (!job) return;
      job.cancel('soft');
      job = null;
      set({ plateArrangeRunning: false });
    },

    arrangeOnPlatesApply: async (options, flags) => {
      const opts = normalizeArrangeOptions(options);
      const key = JSON.stringify(opts);
      return runExclusive<ArrangeReport | null>('arrangePlates', null, async () => {
        const scene = snapshot();
        const plan = last && last.key === key && sameScene(last.scene, scene) ? last.plan : await runEngine('arrangeOnPlates', argsOf(scene, opts));
        if (!sameScene(scene, snapshot())) throw new StoreOperationError('stale-input', tr('store.error.staleInput'));
        last = null;
        if (plan.placements.length === 0) {
          // `quiet`: quien llama (el panel) da su propio aviso, también cuando nada se colocó.
          if (!flags?.quiet) get().addToast(tr(plan.report.unplaced.length ? 'plates.arrange.toast.unplaced' : 'plates.arrange.toast.nothing', { count: plan.report.unplaced.length }), 'info');
          return plan.report;
        }
        const { scene: next, keyToId } = applyPlan(scene, plan);
        pushHistory();
        tagLastPushedStep({ kind: 'arrangePlates' }, get().past);
        const firstUsed = firstUsedPlate(plan.report, keyToId);
        set({ objects: next.objects, plates: next.plates, ...(firstUsed ? { activePlateId: firstUsed } : {}) });
        if (plan.createdPlates.length) get().requestCameraPreset('plates');
        const report = reportWithPlateIds(plan.report, keyToId);
        if (!flags?.quiet) {
          get().addToast(tr('plates.arrange.toast.done', { count: report.placed.length, plates: report.platesUsed.length }), 'success');
          if (report.unplaced.length) get().addToast(tr('plates.arrange.toast.unplaced', { count: report.unplaced.length }), 'info');
        }
        return report;
      });
    },
  };
}
