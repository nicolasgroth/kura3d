/**
 * @file src/core/scene/plateMove.ts
 * @description Mover piezas entre placas (funciones puras): reasigna `plateRef` y traslada la pieza al hueco
 * equivalente de la placa destino (misma posición relativa al origen de su placa). Con la escena en imprimir se
 * mueve la pose viva; en armado la figura no se toca y se traslada la pose de impresión (`restPose`). Los
 * agregados ligados (imanes, torretas) y los negativos de un grupo que se mueve entero acompañan a su pieza (y si
 * tenían placa, pasan a la destino).
 * También decide a qué placa pertenece una pieza según dónde se soltó (arrastre).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { dependentAddonIds } from '../addons/addonFollow';
import type { SceneObject, Vec3 } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';
import { footprintOf, keepClearOfOthers, type BedSize } from './freeSpot';
import { layoutPoseOf, type LayoutContext } from './layoutPoses';
import { isNegative } from './objectRole';
import { assignable, findPlate, plateBed, type PlateScene, type ProjectBed } from './plates';

export interface MoveToPlateResult {
  scene: PlateScene;
  /** Ids de las piezas que cambiaron de placa (sin los acompañantes). */
  moved: string[];
}

const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

/** Origen [X, Z] de la placa de una pieza (sin placa o referencia rota = el origen del mundo). */
function originOf(plates: readonly ScenePlate[], obj: Pick<SceneObject, 'plateRef'>): [number, number] {
  return findPlate(plates, obj.plateRef)?.origin ?? [0, 0];
}

/** Acompañantes de las piezas movidas: id → id de la pieza cuyo desplazamiento heredan. */
export function followersOf(objects: readonly SceneObject[], movers: readonly SceneObject[]): Map<string, string> {
  const out = new Map<string, string>();
  const moverIds = new Set(movers.map((o) => o.id));
  for (const id of dependentAddonIds(objects, moverIds, { includeLocked: true })) {
    const host = objects.find((o) => o.id === id)?.metadata?.addon?.hostId;
    if (host) out.set(id, host);
  }
  // Negativos de un grupo cuyas piezas sólidas se mueven todas: el hueco acompaña a la figura.
  const groups = new Set(movers.map((o) => o.groupRef).filter((g): g is string => g !== undefined));
  for (const g of groups) {
    const members = objects.filter((o) => o.groupRef === g && !isNegative(o) && !o.metadata?.addon);
    if (members.length === 0 || !members.every((m) => moverIds.has(m.id))) continue;
    const lead = members[0].id;
    for (const o of objects) if (o.groupRef === g && isNegative(o) && !o.metadata?.addon && !o.locked && !moverIds.has(o.id)) out.set(o.id, lead);
  }
  return out;
}

/**
 * Mueve `ids` a la placa `destId`. null si la placa no existe o nada cambia (nada asignable, ya están en ella).
 * `projectBed` es la cama de las placas sin cama propia. En imprimir, si el hueco equivalente pisa a otra pieza
 * de la placa destino, el bloque se lleva al primer hueco libre de esa placa.
 */
export function movePiecesToPlate(
  scene: PlateScene, ids: readonly string[], destId: string, layout: SceneLayout, ctx: LayoutContext, projectBed: ProjectBed,
): MoveToPlateResult | null {
  const dest = findPlate(scene.plates, destId);
  if (!dest) return null;
  const wanted = new Set(ids);
  const movers = scene.objects.filter((o) => wanted.has(o.id) && assignable(o) && o.plateRef !== destId);
  if (movers.length === 0) return null;
  const followers = followersOf(scene.objects, movers);
  const delta = new Map<string, [number, number]>();
  for (const o of movers) {
    const from = originOf(scene.plates, o);
    delta.set(o.id, [dest.origin[0] - from[0], dest.origin[1] - from[1]]);
  }
  for (const [id, host] of followers) {
    const d = delta.get(host);
    if (d) delta.set(id, d);
  }

  if (layout === 'print') {
    const moverIds = new Set(movers.map((o) => o.id));
    const others = scene.objects.filter((o) => o.plateRef === destId && !moverIds.has(o.id) && !followers.has(o.id));
    const trial = movers.map((o) => ({ ...o, position: [o.position[0] + delta.get(o.id)![0], o.position[1], o.position[2] + delta.get(o.id)![1]] as Vec3 }));
    const bed = plateBed(dest, projectBed);
    const size: BedSize = { width: bed.widthMm, depth: bed.depthMm, origin: [dest.origin[0], dest.origin[1]] };
    const clear = keepClearOfOthers(others, trial, size);
    if (clear.moved) {
      const dx = clear.parts[0].position[0] - trial[0].position[0];
      const dz = clear.parts[0].position[2] - trial[0].position[2];
      for (const [id, d] of delta) delta.set(id, [d[0] + dx, d[1] + dz]);
    }
  }

  const moverSet = new Set(movers.map((o) => o.id));
  const objects = scene.objects.map((o) => {
    const d = delta.get(o.id);
    if (!d) return o;
    // Un acompañante con placa propia también pasa a la destino: queda físicamente ahí. Sin placa, sigue sin ella.
    const next: SceneObject = moverSet.has(o.id) || o.plateRef !== undefined ? { ...o, plateRef: destId } : { ...o };
    if (layout === 'print') {
      next.position = [clean(o.position[0] + d[0]), o.position[1], clean(o.position[2] + d[1])];
      return next;
    }
    // Armado: la figura no se toca; se traslada la pose de impresión (la guardada, o la derivada si no hay).
    const rest = o.restPose ?? layoutPoseOf(scene.objects, o, 'assembly', 'print', ctx);
    next.restPose = {
      position: [clean(rest.position[0] + d[0]), rest.position[1], clean(rest.position[2] + d[1])],
      rotation: [rest.rotation[0], rest.rotation[1], rest.rotation[2]],
    };
    return next;
  });
  return { scene: { objects, plates: scene.plates }, moved: movers.map((o) => o.id) };
}

/**
 * Placa donde cae el punto (X, Z): la primera cuyo rectángulo de cama lo contiene (con una holgura de `slack` mm
 * por lado). null si cae fuera de todas.
 */
export function plateAtPoint(plates: readonly ScenePlate[], projectBed: ProjectBed, x: number, z: number, slack = 0): ScenePlate | null {
  for (const p of plates) {
    const b = plateBed(p, projectBed);
    if (Math.abs(x - p.origin[0]) <= b.widthMm / 2 + slack && Math.abs(z - p.origin[1]) <= b.depthMm / 2 + slack) return p;
  }
  return null;
}

/**
 * Tras soltar piezas arrastradas: cada pieza asignable pasa a la placa sobre la que quedó el centro de su huella
 * (sin trasladarla). Las que quedan fuera de toda placa conservan la suya. null si nada cambia.
 */
export function reassignByPosition(scene: PlateScene, ids: readonly string[], projectBed: ProjectBed): PlateScene | null {
  const wanted = new Set(ids);
  let changed = false;
  const objects = scene.objects.map((o) => {
    if (!wanted.has(o.id) || !assignable(o)) return o;
    const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale);
    if (!fp) return o;
    const plate = plateAtPoint(scene.plates, projectBed, (fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2);
    if (!plate || plate.id === o.plateRef) return o;
    changed = true;
    return { ...o, plateRef: plate.id };
  });
  return changed ? { objects, plates: scene.plates } : null;
}
