/**
 * @file src/core/scene/layoutPoses.ts
 * @description Las dos poses de cada pieza (imprimir / armado, `docs/diseno/PLACAS_Y_ARMADO.md`, alternativa D):
 * `position/rotation` es la pose del modo activo y `restPose` la del otro. Este módulo es el ÚNICO que escribe
 * `restPose`: `switchLayoutPatches` intercambia las poses al cambiar de modo y `posedObjects` da copias en la pose
 * pedida sin tocar la escena (exportar usa siempre imprimir; comprobar encaje, siempre armado). Funciones puras.
 *
 * Invariante y reglas:
 * - Con `restPose`, cambiar de modo intercambia exactamente pose viva y `restPose` (ida y vuelta bit a bit igual).
 * - Sin `restPose` la pose del otro modo se deriva: pieza dividida → `metadata.split` (assembly / print con su placa
 *   virtual); agregado ligado (imán, torreta, ojal, paso de cable) → sigue a su pieza; negativo de grupo → sigue a
 *   la pieza del grupo si todas las piezas del grupo se mueven igual (si no, se queda: riesgo 3 del diseño);
 *   cualquier otra → la misma pose en ambos modos.
 * - Al entrar en armado, todo sólido (y todo seguidor que se movió) guarda su pose de impresión en `restPose`,
 *   así mover o girar en armado nunca altera la pose de impresión. Referencias y negativos que no se mueven
 *   quedan sin `restPose` (misma pose en ambos modos).
 * - Al volver a imprimir, la pose de armado se descarta si coincide con la derivada (la escena queda como antes
 *   de armar si nada se editó en armado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { addonHostId, followAddonPose } from '../addons/addonFollow';
import type { SceneObject, Vec3 } from '../../types/kura';
import type { RestPose, SceneLayout } from '../../types/plates';
import { isNegative } from './objectRole';
import { rigidFollowPatches } from './rigidFollow';
import { splitTransformFor } from './splitGroups';

/** Modo de una escena sin `layout` (todo proyecto anterior). */
export const DEFAULT_LAYOUT: SceneLayout = 'print';

/** Lo que la derivación necesita fuera de los objetos: la cama de las placas virtuales de Dividir. */
export interface LayoutContext {
  bed: { widthMm: number; depthMm: number };
}

/** Parche de un cambio de modo: pose viva nueva y `restPose` nueva (`null` = se quita). */
export interface LayoutPatch {
  id: string;
  position: Vec3;
  rotation: Vec3;
  restPose: RestPose | null;
}

type Pose = { position: Vec3; rotation: Vec3 };
type ById = ReadonlyMap<string, SceneObject>;

const copy = (p: { position: readonly number[]; rotation: readonly number[] }): Pose => ({
  position: [p.position[0], p.position[1], p.position[2]],
  rotation: [p.rotation[0], p.rotation[1], p.rotation[2]],
});
const live = (o: SceneObject): Pose => copy(o);
const EPS = 1e-9;
const nearVec = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) <= EPS * Math.max(1, Math.abs(v)));
const samePose = (a: Pose, b: Pose) => nearVec(a.position, b.position) && nearVec(a.rotation, b.rotation);
const exactPose = (a: Pose, b: Pose) => a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i]);

/** Negativo de grupo que no es un agregado con seguimiento propio (lo mismo que `plainGroupNegatives`). */
const plainNegative = (o: SceneObject) => isNegative(o) && !!o.groupRef && !o.metadata?.addon && !o.locked;

/** Pose del otro modo sin seguir a nadie: `restPose`, la de Dividir o la misma. */
function ownTarget(o: SceneObject, to: SceneLayout, ctx: LayoutContext): Pose {
  if (o.restPose) return copy(o.restPose);
  const split = o.metadata?.split;
  if (split) return copy(splitTransformFor(split, to, ctx.bed.widthMm, ctx.bed.depthMm));
  return live(o);
}

const matrixOf = (o: Pick<SceneObject, 'position' | 'rotation' | 'scale'>) => new THREE.Matrix4().compose(
  new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)), new THREE.Vector3(...o.scale),
);

/** Pose del seguidor `o` al llevar a su pieza a su pose de `to`, o null si no sigue a nadie (o no es seguro). */
function followerTarget(o: SceneObject, objects: readonly SceneObject[], byId: ById, to: SceneLayout, ctx: LayoutContext): Pose | null {
  if (o.locked) return null;
  const hostId = addonHostId(o);
  if (hostId !== undefined) {
    const host = byId.get(hostId);
    if (!host || host === o) return null;
    const target = ownTarget(host, to, ctx);
    if (samePose(target, live(host))) return null;
    const pose = followAddonPose(o, host, { ...target, scale: host.scale });
    return pose ? copy(pose) : null;
  }
  if (!plainNegative(o)) return null;
  const hosts = objects.filter((h) => h.id !== o.id && h.groupRef === o.groupRef && !isNegative(h) && !h.metadata?.addon);
  if (hosts.length === 0) return null;
  // Todas las piezas del grupo deben moverse con el mismo delta rígido; si no, ¿a cuál seguiría el hueco?
  const deltas = hosts.map((h) => matrixOf({ ...ownTarget(h, to, ctx), scale: h.scale }).multiply(matrixOf(h).invert()));
  const first = deltas[0].elements;
  if (!deltas.every((d) => d.elements.every((v, i) => Math.abs(v - first[i]) <= 1e-9 * Math.max(1, Math.abs(v))))) return null;
  if (new THREE.Matrix4().identity().elements.every((v, i) => Math.abs(v - first[i]) <= 1e-12)) return null;
  const host = hosts[0];
  const [patch] = rigidFollowPatches([o], host, { ...ownTarget(host, to, ctx), scale: host.scale });
  return patch ? copy(patch.patch) : null;
}

/** Pose que tendrá `o` en `to`: la propia (`restPose`, Dividir), la de su pieza si la sigue, o la misma. */
function targetPose(o: SceneObject, objects: readonly SceneObject[], byId: ById, to: SceneLayout, ctx: LayoutContext): Pose {
  if (o.restPose || o.metadata?.split) return ownTarget(o, to, ctx);
  return followerTarget(o, objects, byId, to, ctx) ?? live(o);
}

/**
 * Parches para pasar de `from` a `to` (vacío si es el mismo modo o nada cambia). La pose de cada pieza en `to`
 * sale de la escena de partida; luego, al volver a imprimir, se descarta la `restPose` que coincide con la que se
 * derivaría de la escena nueva. Las piezas bloqueadas también cambian de pose: el modo es vista, no edición.
 */
export function switchLayoutPatches(objects: readonly SceneObject[], from: SceneLayout, to: SceneLayout, ctx: LayoutContext): LayoutPatch[] {
  if (from === to) return [];
  const byId: ById = new Map(objects.map((o) => [o.id, o]));
  const swapped = objects.map((o) => {
    const target = targetPose(o, objects, byId, to, ctx);
    const before = live(o);
    const moved = !exactPose(target, before);
    // Al armar, la pose de impresión de todo sólido queda guardada (editar en armado no la altera).
    const keepRest = o.restPose !== undefined || moved || (to === 'assembly' && o.role === 'solid');
    return { o, target, rest: keepRest ? before : null };
  });
  const next = swapped.map(({ o, target, rest }) => {
    const { restPose: _drop, ...base } = o;
    return { ...base, ...target, ...(rest ? { restPose: rest } : {}) } as SceneObject;
  });
  const nextById: ById = new Map(next.map((o) => [o.id, o]));
  const patches: LayoutPatch[] = [];
  swapped.forEach(({ o, target, rest }, i) => {
    let restPose: RestPose | null = rest;
    if (rest && to === 'print') {
      // La pose de armado se descarta si es la que se derivaría sin ella (misma pose, Dividir o seguir a su pieza).
      const { restPose: _r, ...bare } = next[i];
      if (samePose(rest, targetPose(bare as SceneObject, next, nextById, 'assembly', ctx))) restPose = null;
    }
    const unchanged = exactPose(target, live(o)) && (restPose === null ? o.restPose === undefined : !!o.restPose && exactPose(restPose, o.restPose));
    if (!unchanged) patches.push({ id: o.id, ...target, restPose });
  });
  return patches;
}

/** Aplica los parches de un cambio de modo (copias; los objetos sin parche conservan su referencia). */
export function applyLayoutPatches(objects: SceneObject[], patches: readonly LayoutPatch[]): SceneObject[] {
  if (patches.length === 0) return objects;
  const byId = new Map(patches.map((p) => [p.id, p]));
  return objects.map((o) => {
    const p = byId.get(o.id);
    if (!p) return o;
    const { restPose: _drop, ...base } = o;
    return { ...base, position: p.position, rotation: p.rotation, ...(p.restPose ? { restPose: p.restPose } : {}) };
  });
}

/**
 * Copias de la escena en la pose de `wanted` (la escena está en `current`); la misma lista si coinciden. No
 * toca la escena: lo usan exportar (siempre desde imprimir) y comprobar encaje (siempre desde armado).
 */
export function posedObjects(objects: SceneObject[], current: SceneLayout, wanted: SceneLayout, ctx: LayoutContext): SceneObject[] {
  return applyLayoutPatches(objects, switchLayoutPatches(objects, current, wanted, ctx));
}

/** Pose de una sola pieza en `wanted` (para lectores puntuales; para muchas, mejor `posedObjects`). */
export function layoutPoseOf(objects: readonly SceneObject[], o: SceneObject, current: SceneLayout, wanted: SceneLayout, ctx: LayoutContext): Pose {
  if (current === wanted) return live(o);
  return targetPose(o, objects, new Map(objects.map((x) => [x.id, x])), wanted, ctx);
}
