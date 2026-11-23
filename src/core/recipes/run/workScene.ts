/**
 * @file src/core/recipes/run/workScene.ts
 * @description Escena de trabajo aislada de una ejecución: resultados por paso (listas de objetos inmutables),
 * cajas envolventes en ejes del usuario para `s.<paso>`, y los topes duros (triángulos, objetos, memoria, tiempo y
 * cancelación) revisados cada vez que entra un objeto o empieza una operación. Nunca toca la escena del usuario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../../types/kura';
import { toUserBox, type AxisBox } from '../../scene/displayAxes';
import { RecipeError } from '../errors';
import type { RunLimits } from './limits';

const MIB = 1024 * 1024;

/** Caja de mundo de un objeto en ejes del usuario (mm). `null` si la malla está vacía. */
export function userWorldBox(obj: Pick<SceneObject, 'mesh' | 'position' | 'rotation' | 'scale'>): AxisBox | null {
  const pos = obj.mesh.positions;
  if (pos.length < 3) return null;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
    new THREE.Vector3(...obj.scale),
  ).elements;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const w = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    for (let k = 0; k < 3; k++) {
      if (w[k] < min[k]) min[k] = w[k];
      if (w[k] > max[k]) max[k] = w[k];
    }
  }
  return toUserBox({ min, max });
}

/** Unión de cajas; `null` si no hay ninguna. */
export function unionBox(boxes: readonly (AxisBox | null)[]): AxisBox | null {
  let out: AxisBox | null = null;
  for (const b of boxes) {
    if (!b) continue;
    out = out
      ? { min: [0, 1, 2].map((k) => Math.min(out!.min[k], b.min[k])) as Vec3, max: [0, 1, 2].map((k) => Math.max(out!.max[k], b.max[k])) as Vec3 }
      : { min: [...b.min] as Vec3, max: [...b.max] as Vec3 };
  }
  return out;
}

const meshBytes = (o: SceneObject) => o.mesh.positions.byteLength + o.mesh.indices.byteLength + (o.mesh.normals?.byteLength ?? 0);
const triangleCount = (o: SceneObject) => Math.floor(o.mesh.indices.length / 3);

export class WorkScene {
  private readonly results = new Map<string, readonly SceneObject[]>();
  private readonly boxes = new Map<string, AxisBox | null>();
  private readonly charged = new Set<string>();
  private readonly started: number;
  triangles = 0;
  objects = 0;
  bytes = 0;

  constructor(
    readonly limits: RunLimits,
    private readonly now: () => number,
    private readonly signal?: AbortSignal,
  ) {
    this.started = now();
  }

  elapsed(): number {
    return this.now() - this.started;
  }

  /** Corte cooperativo: cancelación pedida o tiempo de pared agotado. */
  checkTime(at: string): void {
    if (this.signal?.aborted) throw new RecipeError('run.aborted', at);
    const ms = this.elapsed();
    if (ms > this.limits.maxWallMs) throw new RecipeError('run.timeout', at, { max: this.limits.maxWallMs, count: Math.round(ms) });
  }

  /** Cuenta un objeto nuevo contra los topes (lanza antes de guardarlo si se pasa). */
  charge(obj: SceneObject, at: string): void {
    // Un objeto que pasa tal cual de un paso a otro (booleana sin herramientas) se cuenta una vez.
    if (this.charged.has(obj.id)) return;
    this.charged.add(obj.id);
    this.objects += 1;
    this.triangles += triangleCount(obj);
    this.bytes += meshBytes(obj);
    const l = this.limits;
    if (this.objects > l.maxObjects) throw new RecipeError('run.objects', at, { max: l.maxObjects, count: this.objects });
    if (this.triangles > l.maxTriangles) throw new RecipeError('run.triangles', at, { max: l.maxTriangles, count: this.triangles });
    if (this.bytes > l.maxMemoryBytes) {
      throw new RecipeError('run.memory', at, { max: Math.round(l.maxMemoryBytes / MIB), count: Math.round(this.bytes / MIB) });
    }
  }

  record(stepId: string, objects: readonly SceneObject[]): void {
    this.results.set(stepId, Object.freeze([...objects]));
  }

  has(stepId: string): boolean {
    return this.results.has(stepId);
  }

  get(stepId: string, at: string): readonly SceneObject[] {
    const objects = this.results.get(stepId);
    if (!objects) throw new RecipeError('run.refMissing', at, { detail: stepId });
    return objects;
  }

  /** Caja de un paso ya ejecutado (memoizada). Un paso sin objetos no tiene caja: leerla es error. */
  box(stepId: string, at: string): AxisBox {
    if (!this.boxes.has(stepId)) this.boxes.set(stepId, unionBox(this.get(stepId, at).map(userWorldBox)));
    const box = this.boxes.get(stepId);
    if (!box) throw new RecipeError('run.emptyOutput', at, { detail: stepId });
    return box;
  }
}
