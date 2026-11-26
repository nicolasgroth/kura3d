/**
 * @file src/store/slices/plateArrangeSlice.ts
 * @description «Repartir en placas» en el store (lote P5, sin interfaz): `planArrangeOnPlates` calcula el plan en el
 * Worker sin tocar escena ni historial (vista previa del diálogo; un pedido nuevo descarta el anterior con
 * cancelación suave) y `arrangeOnPlatesApply` lo calcula (o reutiliza la vista previa si la escena no cambió) y lo
 * aplica en UN paso de deshacer: crea placas, asigna `plateRef` y mueve. En armado traslada la pose de impresión
 * (`restPose`), no la figura. Lógica pura en `core/scene/plateArrange.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isEngineCancelled, type EngineJob } from '../../core/operations/engineClient';
import type { ArrangeTaskArgs } from '../../core/operations/plateArrangeOperations';
import { projectBed } from '../../core/scene/activePlateBed';
import { ARRANGE_RANGES, IMPLICIT_PLATE_KEY, type ArrangeOptions, type ArrangePlan, type ArrangeReport } from '../../core/scene/plateArrangeTypes';
import { nextPlateName, reconcilePlates } from '../../core/scene/plates';
import { makeId } from '../../core/scene/sceneObjects';
import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { StoreOperationError } from '../commandErrors';
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
   * No cambia de modo: en armado mueve las poses de impresión.
   */
  arrangeOnPlatesApply: (options?: ArrangeOptions) => Promise<ArrangeReport | null>;
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
  const applyPlan = (scene: Snapshot, plan: ArrangePlan) => {
    const keyToId = new Map<string, string | null>(scene.plates.map((p) => [p.id, p.id]));
    let plates: ScenePlate[] = scene.plates;
    let objects: SceneObject[] = scene.objects;
    keyToId.set(IMPLICIT_PLATE_KEY, null);
    for (const c of plan.createdPlates) {
      const id = makeId('plate');
      const name = c.key === IMPLICIT_PLATE_KEY ? plateName(1) : nextPlateName(plates, plateName);
      plates = [...plates, { id, name, origin: [c.origin[0], c.origin[1]] }];
      keyToId.set(c.key, id);
      // La implícita se vuelve explícita y recibe los sólidos sin placa (como al crear la segunda placa a mano).
      if (c.key === IMPLICIT_PLATE_KEY) objects = objects.map((o) => (o.role === 'solid' && o.plateRef === undefined ? { ...o, plateRef: id } : o));
    }
    const byId = new Map(plan.placements.map((p) => [p.id, p]));
    objects = objects.map((o) => {
      const p = byId.get(o.id);
      if (!p) return o;
      const plateId = keyToId.get(p.plate) ?? null;
      const next: SceneObject = { ...o, ...(p.assignPlate && plateId ? { plateRef: plateId } : {}) };
      if (scene.layout === 'assembly') next.restPose = { position: [...p.position], rotation: [...p.rotation] };
      else {
        next.position = [...p.position];
        next.rotation = [...p.rotation];
      }
      return next;
    });
    return { scene: reconcilePlates({ objects, plates }, plateName), keyToId };
  };

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

    arrangeOnPlatesApply: async (options) => {
      const opts = normalizeArrangeOptions(options);
      const key = JSON.stringify(opts);
      return runExclusive<ArrangeReport | null>('arrangePlates', null, async () => {
        const scene = snapshot();
        const plan = last && last.key === key && sameScene(last.scene, scene) ? last.plan : await runEngine('arrangeOnPlates', argsOf(scene, opts));
        if (!sameScene(scene, snapshot())) throw new StoreOperationError('stale-input', tr('store.error.staleInput'));
        last = null;
        if (plan.placements.length === 0) {
          get().addToast(tr(plan.report.unplaced.length ? 'plates.arrange.toast.unplaced' : 'plates.arrange.toast.nothing', { count: plan.report.unplaced.length }), 'info');
          return plan.report;
        }
        const { scene: next, keyToId } = applyPlan(scene, plan);
        pushHistory();
        const firstUsed = plan.report.platesUsed.map((k) => keyToId.get(k)).find((id): id is string => typeof id === 'string');
        set({ objects: next.objects, plates: next.plates, ...(firstUsed ? { activePlateId: firstUsed } : {}) });
        if (plan.createdPlates.length) get().requestCameraPreset('plates');
        const mapKey = (k: string) => keyToId.get(k) ?? k;
        const report: ArrangeReport = {
          ...plan.report,
          platesUsed: plan.report.platesUsed.map(mapKey),
          splitGroups: plan.report.splitGroups.map((g) => ({ ...g, plates: g.plates.map(mapKey) })),
        };
        get().addToast(tr('plates.arrange.toast.done', { count: report.placed.length, plates: report.platesUsed.length }), 'success');
        if (report.unplaced.length) get().addToast(tr('plates.arrange.toast.unplaced', { count: report.unplaced.length }), 'info');
        return report;
      });
    },
  };
}
