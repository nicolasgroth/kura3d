/**
 * @file src/store/measureStore.ts
 * @description Estado de sesión de la herramienta Medir, aparte del documento: modo, puntos en curso,
 * mediciones a la vista (distancia, ángulo, área), punto de imán bajo el cursor y capacidad del
 * recipiente seleccionado. Vive en su propio store a propósito: medir no toca la escena, el
 * historial ni marca el proyecto como modificado, y todo se pierde al cerrar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { getEngineClient, isEngineCancelled, type EngineJob } from '../core/operations/engineClient';
import type { EngineTaskResult } from '../core/operations/engineTasks';
import { createKeyedNaming } from '../core/scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../core/scene/sceneObjects';
import {
  angleAtVertex,
  angleBetweenFaces,
  localTriangles,
  makeAnchor,
  measureDistance,
  measureRegionArea,
  snapOnFace,
  worldMeshOf,
  type AreaPart,
  type CapacityResult,
  type MeasureAnchor,
  type SnapKind,
} from '../engine/measure';
import { OPERATION_DEFAULTS } from '../engine/operationLimits';
import type { MeshData, SceneObject, Vec3 } from '../types/kura';

export type MeasureMode = 'distance' | 'angle' | 'area' | 'capacity';
export type AngleInput = 'points' | 'faces';

export interface MeasurePick {
  point: Vec3;
  /** Normal de la región tocada (para el ángulo entre caras). */
  normal: Vec3;
  objectId: string;
  /** Punto fijado al objeto en coordenadas locales: sigue al objeto cuando se transforma. */
  anchor: MeasureAnchor;
}

/**
 * Medición guardada. Los valores (`a`, `b`, `distanceMm`…) son los del momento de medir; las anclas
 * (puntos locales de cada objeto) permiten recalcularlos en vivo: ver `measureResolve.ts`.
 */
export type Measurement = { objectIds: string[] } & (
  | { id: string; kind: 'distance'; anchors: [MeasureAnchor, MeasureAnchor]; a: Vec3; b: Vec3; distanceMm: number; deltaUser: Vec3 }
  | { id: string; kind: 'angle'; anchors: [MeasureAnchor, MeasureAnchor, MeasureAnchor]; points: [Vec3, Vec3, Vec3]; deg: number }
  | { id: string; kind: 'faceAngle'; anchors: [MeasureAnchor, MeasureAnchor]; points: [Vec3, Vec3]; deg: number; betweenNormalsDeg: number }
  | { id: string; kind: 'area'; parts: AreaPart[]; objectName: string; areaMm2: number; regions: number; centroid: Vec3; highlight: Float32Array }
);

export interface CapacityState {
  objectId: string;
  /** Objeto medido (si cambia, el resultado queda obsoleto). */
  source: SceneObject;
  status: 'running' | 'done' | 'error';
  result: Omit<CapacityResult, 'liquid'> | null;
  liquid: MeshData | null;
  levelHeightMm?: number;
  basinIndex: number;
}

interface MeasureState {
  mode: MeasureMode;
  angleInput: AngleInput;
  pending: MeasurePick[];
  measurements: Measurement[];
  hover: { point: Vec3; kind: SnapKind } | null;
  capacity: CapacityState | null;
  setMode: (mode: MeasureMode) => void;
  setAngleInput: (input: AngleInput) => void;
  /** Clic sobre un objeto en el visor (punto de mundo y cara de la malla). */
  pick: (obj: SceneObject, worldPoint: Vec3, faceIndex: number | null, opts: { snapRadiusMm: number; noSnap: boolean; additive: boolean }) => void;
  setHover: (obj: SceneObject | null, worldPoint?: Vec3, faceIndex?: number | null, snapRadiusMm?: number, noSnap?: boolean) => void;
  cancelPending: () => boolean;
  remove: (id: string) => void;
  clearAll: () => void;
  computeCapacity: (obj: SceneObject, options?: { levelHeightMm?: number; basinIndex?: number }) => Promise<void>;
  cancelCapacity: () => void;
  clearCapacity: () => void;
  /** Reinicia todo (al salir de la herramienta o al cerrar el proyecto). */
  reset: () => void;
}

const worldCache = new WeakMap<SceneObject, MeshData>();
/** Malla de mundo del objeto, reutilizada mientras el objeto no cambie. */
export function worldMeshCached(obj: SceneObject): MeshData {
  let m = worldCache.get(obj);
  if (!m) {
    m = worldMeshOf(obj);
    worldCache.set(obj, m);
  }
  return m;
}

const REGION_DEG = OPERATION_DEFAULTS.paint.regionAngleDeg;
let nextId = 1;
const newId = () => `m${nextId++}`;

let capacityJob: EngineJob<EngineTaskResult<'capacity'>> | null = null;
const taskCtx = () => ({
  policy: APP_BUILD_POLICY,
  newId: () => makeId('mesh'),
  naming: createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id }),
});

/** Triángulos de la región en mundo, para resaltarla. */
function regionHighlight(world: MeshData, faces: Uint32Array): Float32Array {
  const out = new Float32Array(faces.length * 9);
  const P = world.positions, I = world.indices;
  faces.forEach((f, n) => {
    for (let k = 0; k < 3; k++) {
      const v = I[f * 3 + k] * 3;
      out.set([P[v], P[v + 1], P[v + 2]], n * 9 + k * 3);
    }
  });
  return out;
}

const INITIAL = { mode: 'distance' as MeasureMode, angleInput: 'points' as AngleInput, pending: [], measurements: [], hover: null, capacity: null };

export const useMeasureStore = create<MeasureState>((set, get) => ({
  ...INITIAL,

  setMode: (mode) => set({ mode, pending: [], hover: null }),
  setAngleInput: (angleInput) => set({ angleInput, pending: [] }),

  pick: (obj, worldPoint, faceIndex, { snapRadiusMm, noSnap, additive }) => {
    const { mode, angleInput, pending, measurements } = get();
    if (mode === 'capacity') return;
    const world = worldMeshCached(obj);
    const face = faceIndex ?? -1;
    if (mode === 'area') {
      if (face < 0) return;
      const region = measureRegionArea(world, face, REGION_DEG);
      const last = measurements[measurements.length - 1];
      const highlight = regionHighlight(world, region.faces);
      // Los triángulos se guardan en coordenadas locales: así la región sigue al objeto.
      const part: AreaPart = { objectId: obj.id, mesh: obj.mesh, tris: localTriangles(obj.mesh, region.faces) };
      if (additive && last?.kind === 'area') {
        const merged = new Float32Array(last.highlight.length + highlight.length);
        merged.set(last.highlight);
        merged.set(highlight, last.highlight.length);
        set({
          measurements: [
            ...measurements.slice(0, -1),
            { ...last, areaMm2: last.areaMm2 + region.areaMm2, regions: last.regions + 1, highlight: merged, parts: [...last.parts, part], objectIds: [...new Set([...last.objectIds, obj.id])] },
          ],
        });
        return;
      }
      set({ measurements: [...measurements, { id: newId(), kind: 'area', objectIds: [obj.id], parts: [part], objectName: obj.name, areaMm2: region.areaMm2, regions: 1, centroid: region.centroid, highlight }] });
      return;
    }
    const point = noSnap || face < 0 ? worldPoint : snapOnFace(world, face, worldPoint, snapRadiusMm).point;
    const normal = face >= 0 ? measureRegionArea(world, face, 1).normal : ([0, 1, 0] as Vec3);
    const picks = [...pending, { point, normal, objectId: obj.id, anchor: makeAnchor(obj, point, normal) }];
    const objectIds = [...new Set(picks.map((p) => p.objectId))];
    if (mode === 'distance' && picks.length === 2) {
      const d = measureDistance(picks[0].point, picks[1].point);
      set({ pending: [], measurements: [...measurements, { id: newId(), kind: 'distance', objectIds, anchors: [picks[0].anchor, picks[1].anchor], a: picks[0].point, b: picks[1].point, ...d }] });
      return;
    }
    if (mode === 'angle' && angleInput === 'faces' && picks.length === 2) {
      const r = angleBetweenFaces(picks[0].normal, picks[1].normal);
      set({ pending: [], measurements: [...measurements, { id: newId(), kind: 'faceAngle', objectIds, anchors: [picks[0].anchor, picks[1].anchor], points: [picks[0].point, picks[1].point], deg: r.dihedralDeg, betweenNormalsDeg: r.betweenNormalsDeg }] });
      return;
    }
    if (mode === 'angle' && angleInput === 'points' && picks.length === 3) {
      const pts: [Vec3, Vec3, Vec3] = [picks[0].point, picks[1].point, picks[2].point];
      set({ pending: [], measurements: [...measurements, { id: newId(), kind: 'angle', objectIds, anchors: [picks[0].anchor, picks[1].anchor, picks[2].anchor], points: pts, deg: angleAtVertex(...pts) }] });
      return;
    }
    set({ pending: picks });
  },

  setHover: (obj, worldPoint, faceIndex, snapRadiusMm = 0, noSnap = false) => {
    if (!obj || !worldPoint) {
      if (get().hover) set({ hover: null });
      return;
    }
    const face = faceIndex ?? -1;
    const hover = noSnap || face < 0 ? { point: worldPoint, kind: 'surface' as const } : snapOnFace(worldMeshCached(obj), face, worldPoint, snapRadiusMm);
    set({ hover });
  },

  cancelPending: () => {
    if (get().pending.length === 0) return false;
    set({ pending: [] });
    return true;
  },
  remove: (id) => set({ measurements: get().measurements.filter((m) => m.id !== id) }),
  clearAll: () => set({ measurements: [], pending: [] }),

  computeCapacity: async (obj, options = {}) => {
    // No cancela la anterior (cancelar reinicia el Worker): su resultado se descarta por obsoleto.
    const prev = get().capacity;
    const basinIndex = options.basinIndex ?? (prev?.objectId === obj.id ? prev.basinIndex : 0);
    set({
      capacity: {
        objectId: obj.id,
        source: obj,
        status: 'running',
        result: prev?.objectId === obj.id && prev.source === obj ? prev.result : null,
        liquid: prev?.objectId === obj.id && prev.source === obj ? prev.liquid : null,
        levelHeightMm: options.levelHeightMm,
        basinIndex,
      },
    });
    const job = getEngineClient().run(taskCtx(), 'capacity', {
      obj: { mesh: obj.mesh, position: obj.position, rotation: obj.rotation, scale: obj.scale },
      options: { levelHeightMm: options.levelHeightMm, basinIndex, includeLiquidMesh: true },
    });
    capacityJob = job;
    try {
      const { liquid, ...result } = await job.promise;
      if (capacityJob !== job) return;
      capacityJob = null;
      set({ capacity: { objectId: obj.id, source: obj, status: 'done', result, liquid, levelHeightMm: options.levelHeightMm, basinIndex: result.basinIndex } });
    } catch (err) {
      if (isEngineCancelled(err) || capacityJob !== job) return;
      capacityJob = null;
      const cur = get().capacity;
      if (cur) set({ capacity: { ...cur, status: 'error' } });
    }
  },
  cancelCapacity: () => {
    if (!capacityJob) return;
    capacityJob.cancel();
    capacityJob = null;
    const cur = get().capacity;
    set({ capacity: cur?.result ? { ...cur, status: 'done' } : null });
  },
  clearCapacity: () => {
    capacityJob?.cancel();
    capacityJob = null;
    set({ capacity: null });
  },
  reset: () => {
    capacityJob?.cancel();
    capacityJob = null;
    set({ ...INITIAL });
  },
}));
