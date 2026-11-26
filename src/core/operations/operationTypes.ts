/**
 * @file src/core/operations/operationTypes.ts
 * @description Contrato de las operaciones de escena puras: reciben objetos y opciones, llaman al
 * motor y devuelven un `SceneChange` (agregar, quitar, parchar + avisos). No tocan estado, toasts
 * ni i18n: los nombres llegan por `ResultNaming` y la construcción por `ObjectBuildPolicy`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { computeMeshStats, computeWorldStats, EngineError, type EngineWarning } from '../../engine';
import type { SimplifyReport } from '../../engine/simplify';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import type { ResultNaming } from '../scene/resultNames';
import { buildSceneObject, type BuildObjectParams, type ObjectBuildPolicy } from '../scene/sceneObjects';

/** Cambios que una operación pide aplicar a la escena. */
export interface SceneChange {
  /** Objetos nuevos, que se agregan al final de la escena. */
  added: SceneObject[];
  /** IDs que salen de la escena (se quitan antes de agregar `added`). */
  removedIds: string[];
  /** Campos a fusionar sobre objetos existentes (por ID). */
  patches: Array<{ id: string; patch: Partial<SceneObject> }>;
  warnings: EngineWarning[];
  /** Resultado de simplificar: triángulos y volumen (local, mm³) antes y después, para mostrarlo siempre. */
  simplify?: SimplifyOutcome;
}

/** Medidas de una simplificación (volumen en coordenadas locales: la escala no cambia el porcentaje). */
export interface SimplifyOutcome {
  trianglesBefore: number;
  trianglesAfter: number;
  volumeBeforeMm3: number;
  volumeAfterMm3: number;
  /** Cambio de volumen en % (positivo = creció). */
  volumeChangePct: number;
  /** Informe completo (modo, género, desviación muestreada, avisos tipados). */
  report: SimplifyReport;
  /**
   * Malla de lo pedido cuando se aplicaría la versión segura en su lugar (para verla en la vista previa sin
   * recalcular). Opcional: el motor aún no la guarda y entonces la interfaz no ofrece el conmutador.
   */
  requestedMesh?: MeshData;
}

/** Dependencias de una operación: política de construcción, IDs y nombres. */
export interface OperationContext {
  policy: ObjectBuildPolicy;
  newId: () => string;
  naming: ResultNaming;
  /** Avance de operaciones largas (fase legible por máquina, p. ej. `cut:3/8`). Opcional. */
  onProgress?: (phase: string) => void;
}

export function emptyChange(): SceneChange {
  return { added: [], removedIds: [], patches: [], warnings: [] };
}

export function change(partial: Partial<SceneChange>): SceneChange {
  return { ...emptyChange(), ...partial };
}

/** Construye un objeto nuevo con la política e IDs del adaptador. */
export function buildWith(ctx: OperationContext, params: Omit<BuildObjectParams, 'id'>): SceneObject {
  return buildSceneObject({ ...params, id: ctx.newId() }, ctx.policy);
}

/** Estadísticas según la política (locales en la app, de mundo en headless). */
export function statsFor(ctx: OperationContext, obj: Pick<SceneObject, 'mesh' | 'rotation' | 'scale'>): SceneObject['stats'] {
  return ctx.policy.stats === 'world' ? computeWorldStats(obj.mesh, obj.rotation, obj.scale) : computeMeshStats(obj.mesh);
}

/** Parche de malla (y posición/transformación) con estadísticas recalculadas. */
export function meshPatch(
  ctx: OperationContext,
  obj: SceneObject,
  mesh: MeshData,
  extra: Partial<Pick<SceneObject, 'position' | 'rotation' | 'scale'>> = {},
): Partial<SceneObject> {
  if (ctx.policy.rejectEmpty && mesh.indices.length === 0) {
    throw new EngineError('MESH_EMPTY', { operation: obj.name });
  }
  const rotation = extra.rotation ?? obj.rotation;
  const scale = extra.scale ?? obj.scale;
  return { ...extra, mesh, stats: statsFor(ctx, { mesh, rotation, scale }) };
}

/** Aplica un `SceneChange` a una lista de objetos (orden: parches, quitar, agregar al final). */
export function applySceneChange(objects: SceneObject[], c: SceneChange): SceneObject[] {
  const removed = new Set(c.removedIds);
  const patches = new Map<string, Partial<SceneObject>>();
  for (const { id, patch } of c.patches) patches.set(id, { ...patches.get(id), ...patch });
  const kept = objects
    .filter((o) => !removed.has(o.id))
    .map((o) => (patches.has(o.id) ? { ...o, ...patches.get(o.id) } : o));
  return [...kept, ...c.added];
}

export type { Vec3 };
