/**
 * @file src/store/slices/orientSlice.ts
 * @description «Orientar para imprimir» en el store (sin componentes): analiza la pieza elegida en el Worker,
 * cancelable y sin tomar el bloqueo de escena (es de solo lectura); guarda el análisis con la referencia de lo
 * analizado, la orientación en vista previa (fantasma en `operationPreview` y triángulos en voladizo) y aplica
 * la elegida en un solo paso de deshacer, conservando o no la posición en la cama. El análisis se descarta si la
 * malla o la transformación de la pieza cambian por otra vía (`invalidateOrientOnSceneChange`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { isEngineCancelled, type EngineJob } from '../../core/operations/engineClient';
import type { EngineTaskResult } from '../../core/operations/engineTasks';
import { orientableObject } from '../../core/operations/orientOperations';
import { orientFollowPatches } from '../../core/scene/rigidFollow';
import { ORIENT_RANGES, planOrientTransform, type OrientAnalysis, type OrientOptions } from '../../engine/orient';
import type { SceneObject, Vec3 } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';
import { activeFitBed } from './fitToBedSlice';

/** Clave del dueño de la vista previa en `operationPreview`. */
export const ORIENT_PREVIEW_KEY = 'orient';

/** Rango del umbral de voladizo que ofrece la interfaz (grados). */
export const ORIENT_ANGLE_RANGE = ORIENT_RANGES.overhangAngleDeg;

type Pose = Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>;

export interface OrientState {
  objectId: string;
  analysis: OrientAnalysis;
  /** Lo que se analizó: si la pieza cambia, el análisis ya no vale. */
  source: Pose;
}

export interface OrientOverhangView {
  candidateId: string;
  triangles: Uint32Array;
  truncated: boolean;
}

export interface OrientSliceState {
  orient: OrientState | null;
  orientRunning: boolean;
  /** El análisis se descartó porque la pieza cambió (el panel ofrece volver a calcular). */
  orientStale: boolean;
  /** Orientación mostrada como fantasma en el visor. */
  orientPreviewId: string | null;
  orientOverhang: OrientOverhangView | null;
  /** Conserva la posición en la cama al aplicar (si no, centra). */
  orientKeepXY: boolean;
  /** Calcula las orientaciones de una pieza; `null` si se canceló o falló (el error ya se avisó). */
  analyzeOrient: (objectId: string, angleDeg?: number) => Promise<OrientAnalysis | null>;
  cancelOrient: () => void;
  setOrientKeepXY: (keep: boolean) => void;
  /** Muestra (o quita, con `null`) la vista previa de una orientación sin tocar la escena. */
  setOrientPreview: (candidateId: string | null) => void;
  /** Aplica la orientación elegida (un paso de deshacer) y vuelve a calcular. */
  applyOrient: (candidateId: string) => Promise<boolean>;
  /** Cierra todo: análisis, cálculo en curso y vista previa. */
  clearOrient: (reason?: 'stale') => void;
  /** Análisis en el Worker sin tocar el panel (Command Bus); `null` si la pieza no se puede orientar. */
  computeOrientAnalysis: (objectId: string, options: OrientOptions) => Promise<OrientAnalysis | null>;
  /**
   * Aplica un giro (cuaternión de un candidato) en un paso de deshacer, con los negativos del grupo; los imanes y
   * torretas siguen solos. false si la pieza no se puede orientar o el motor está ocupado.
   */
  /** `alignFootprint` (por defecto true): tras apoyar, gira alrededor de la vertical para la huella de menor caja. */
  applyOrientQuaternion: (objectId: string, quaternion: [number, number, number, number], keepXY: boolean, alignFootprint?: boolean) => Promise<boolean>;
}

const sameVec = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** La pieza sigue igual que cuando se analizó. */
export const orientSourceIsCurrent = (source: Pose, o: SceneObject | undefined): boolean =>
  Boolean(o) && o!.mesh === source.mesh && sameVec(o!.position, source.position) && sameVec(o!.rotation, source.rotation) && sameVec(o!.scale, source.scale);

export { orientableObject } from '../../core/operations/orientOperations';

export function createOrientSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, runExclusive, runEngineDetached, startEngineJob, commitChange, assertCurrent, reportOperationError, tr } = ctx;
  let job: EngineJob<EngineTaskResult<'orientForPrint'>> | null = null;
  let previewGeneration = 0;

  /** Resaltado de voladizos de la vista previa en curso: uno a la vez (el anterior se descarta en suave). */
  let overhangJob: { cancel: (mode?: 'soft' | 'hard') => void } | null = null;
  const cancelOverhang = () => {
    overhangJob?.cancel('soft');
    overhangJob = null;
  };
  const dropPreview = () => {
    previewGeneration++;
    cancelOverhang();
    if (get().orientPreviewId !== null || get().orientOverhang !== null) set({ orientPreviewId: null, orientOverhang: null });
    get().clearOperationPreview(ORIENT_PREVIEW_KEY);
  };

  return {
    orient: null,
    orientRunning: false,
    orientStale: false,
    orientPreviewId: null,
    orientOverhang: null,
    orientKeepXY: true,

    analyzeOrient: async (objectId, angleDeg = ORIENT_ANGLE_RANGE.default) => {
      // Reemplazo: suave, para no recargar el Worker (el cliente escala a dura si bloquea al nuevo).
      job?.cancel('soft');
      const obj = get().objects.find((o) => o.id === objectId);
      if (!orientableObject(obj)) return null;
      dropPreview();
      const source: Pose = { mesh: obj.mesh, position: obj.position, rotation: obj.rotation, scale: obj.scale };
      const bed = activeFitBed(get(), [obj]);
      set({ orientRunning: true });
      const current = startEngineJob('orientForPrint', { obj, options: { overhangAngleDeg: angleDeg, bed } });
      job = current;
      try {
        const analysis = await current.promise;
        if (job !== current) return null;
        job = null;
        const valid = orientSourceIsCurrent(source, get().objects.find((o) => o.id === objectId));
        set(valid ? { orientRunning: false, orient: { objectId, analysis, source }, orientStale: false } : { orientRunning: false, orient: null, orientStale: true });
        return valid ? analysis : null;
      } catch (err) {
        if (job === current) {
          job = null;
          set({ orientRunning: false });
        }
        if (!isEngineCancelled(err)) reportOperationError(err);
        return null;
      }
    },

    cancelOrient: () => {
      if (!job) return;
      job.cancel('hard');
      job = null;
      set({ orientRunning: false });
    },

    setOrientKeepXY: (orientKeepXY) => {
      set({ orientKeepXY });
      // El fantasma muestra la posición que quedaría: se rehace con la opción nueva.
      const id = get().orientPreviewId;
      if (id) get().setOrientPreview(id);
    },

    setOrientPreview: (candidateId) => {
      const state = get();
      const { orient } = state;
      const candidate = candidateId && orient ? orient.analysis.candidates.find((c) => c.id === candidateId) : undefined;
      const obj = orient ? state.objects.find((o) => o.id === orient.objectId) : undefined;
      if (!orient || !candidate || !obj || !orientSourceIsCurrent(orient.source, obj)) {
        dropPreview();
        return;
      }
      const generation = ++previewGeneration;
      cancelOverhang();
      // La actual no se gira: su fantasma queda sobre la pieza y sirve para ver qué zonas necesitan soporte hoy.
      const plan = candidate.source === 'current'
        ? { position: obj.position, rotation: obj.rotation, scale: obj.scale }
        : planOrientTransform(obj, candidate.quaternion, { keepXY: state.orientKeepXY, alignFootprint: true });
      set({
        orientPreviewId: candidate.id,
        orientOverhang: state.orientOverhang?.candidateId === candidate.id ? state.orientOverhang : null,
        operationPreview: {
          key: ORIENT_PREVIEW_KEY,
          status: 'ready',
          ghosts: [{ id: obj.id, mesh: obj.mesh, position: plan.position, rotation: plan.rotation, scale: plan.scale, role: 'result' }],
          guides: [],
        },
      });
      if (state.orientOverhang?.candidateId === candidate.id) return;
      const overhang = startEngineJob('orientOverhangFaces', { obj, quaternion: candidate.quaternion, overhangAngleDeg: orient.analysis.overhangAngleDeg });
      overhangJob = overhang;
      overhang.promise.then(
        (res) => {
          if (overhangJob === overhang) overhangJob = null;
          if (generation !== previewGeneration) return;
          set({ orientOverhang: { candidateId: candidate.id, triangles: res.triangles, truncated: res.truncated } });
        },
        () => {
          // El resaltado es un extra: si falla (o se descartó por otra vista previa), el fantasma sigue sin él.
          if (overhangJob === overhang) overhangJob = null;
        },
      );
    },

    applyOrient: async (candidateId) => {
      const { orient, orientKeepXY } = get();
      const candidate = orient?.analysis.candidates.find((c) => c.id === candidateId);
      const obj = orient ? get().objects.find((o) => o.id === orient.objectId) : undefined;
      if (!orient || !candidate || !obj || !orientSourceIsCurrent(orient.source, obj)) return false;
      const applied = await get().applyOrientQuaternion(obj.id, candidate.quaternion, orientKeepXY);
      if (!applied) return false;
      dropPreview();
      // «Apoyada» solo si hay base real: con solo aristas en la cama se avisa en vez de felicitar.
      const noBase = candidate.reasons.some((r) => r.key === 'noBase');
      get().addToast(tr(noBase ? 'orient.ui.appliedNoBase' : 'orient.ui.applied', { name: obj.name }), noBase ? 'info' : 'success');
      // La pieza ya está en la orientación elegida: la lista se recalcula y la aplicada pasa a ser «Actual».
      await get().analyzeOrient(obj.id, orient.analysis.overhangAngleDeg);
      return true;
    },

    computeOrientAnalysis: async (objectId, options) => {
      const obj = get().objects.find((o) => o.id === objectId);
      if (!orientableObject(obj)) return null;
      return runEngineDetached('orientForPrint', { obj, options });
    },

    applyOrientQuaternion: async (objectId, quaternion, keepXY, alignFootprint = true) => {
      const obj = get().objects.find((o) => o.id === objectId);
      if (!orientableObject(obj)) return false;
      return runExclusive('orient', false, async () => {
        const change = await runEngineDetached('orientApply', { obj, quaternion, keepXY, alignFootprint });
        assertCurrent([obj]);
        // Los negativos pendientes del mismo grupo acompañan a la pieza (los imanes y torretas ya la siguen solos):
        // si quedaran donde estaban, la resta cortaría otra zona sin aviso.
        change.patches.push(...orientFollowPatches(get().objects, obj, change));
        commitChange(change);
        return true;
      });
    },

    clearOrient: (reason) => {
      // Desmontaje del panel (StrictMode lo hace en cada apertura en desarrollo): suave.
      job?.cancel('soft');
      job = null;
      dropPreview();
      set({ orient: null, orientRunning: false, orientStale: reason === 'stale' });
    },
  };
}

/** Descarta el análisis cuando la pieza analizada cambia por otra vía (editar, mover, deshacer…). */
export function invalidateOrientOnSceneChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    if (state.objects === prev.objects || !state.orient) return;
    if (!orientSourceIsCurrent(state.orient.source, state.objects.find((o) => o.id === state.orient!.objectId))) state.clearOrient('stale');
  });
}
