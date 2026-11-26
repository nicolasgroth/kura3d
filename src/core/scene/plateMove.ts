/**
 * @file src/core/scene/plateMove.ts
 * @description Mover piezas entre placas (funciones puras): reasigna `plateRef` y traslada la pieza al hueco
 * equivalente de la placa destino (misma posición relativa al origen de su placa; si así quedaría fuera de la cama
 * destino, se acerca hasta que su caja quede dentro). Con la escena en imprimir se
 * mueve la pose viva; en armado la figura no se toca y se traslada la pose de impresión (`restPose`). Los
 * agregados ligados (imanes, torretas) y los negativos de un grupo que se mueve entero acompañan a su pieza (y si
 * tenían placa, pasan a la destino).
 * También decide a qué placa pertenece una pieza según dónde se soltó (arrastre).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
  /** false si la pieza (o el bloque) es más grande que la cama destino: se movió, pero no cabe. */
  fits: boolean;
  /** true si la placa destino no tenía un hueco libre: la pieza queda dentro de su cama, encima de otras. */
  crowded: boolean;
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

  // La pieza debe quedar dentro de la cama destino: si conservar el lugar relativo la dejaría fuera, se acerca.
  const bedBox = plateBedBox(dest, projectBed);
  const inside = fitInsideBox(movers.map((o) => {
    const pose = printPoseOf(scene.objects, o, layout, ctx);
    const d = delta.get(o.id)!;
    return footprintOf(o.mesh, [pose.position[0] + d[0], pose.position[1], pose.position[2] + d[1]], pose.rotation, o.scale);
  }), bedBox);
  if (inside.dx !== 0 || inside.dz !== 0) for (const [id, d] of delta) delta.set(id, [d[0] + inside.dx, d[1] + inside.dz]);

  let crowded = false;
  if (layout === 'print') {
    const moverIds = new Set(movers.map((o) => o.id));
    const others = scene.objects.filter((o) => o.plateRef === destId && !moverIds.has(o.id) && !followers.has(o.id));
    const trial = movers.map((o) => ({ ...o, position: [o.position[0] + delta.get(o.id)![0], o.position[1], o.position[2] + delta.get(o.id)![1]] as Vec3 }));
    const bed = plateBed(dest, projectBed);
    const size: BedSize = { width: bed.widthMm, depth: bed.depthMm, origin: [dest.origin[0], dest.origin[1]] };
    const clear = keepClearOfOthers(others, trial, size);
    // Sin hueco libre, `keepClearOfOthers` deja el bloque junto a la cama (fuera): se prefiere quedar dentro, encima de otras.
    if (clear.moved && !clear.fits) crowded = inside.fits;
    else if (clear.moved) {
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
  return { scene: { objects, plates: scene.plates }, moved: movers.map((o) => o.id), fits: inside.fits, crowded };
}

/**
 * Tras soltar piezas que cambiaron de placa (`before` → `after`): las que quedaron con la huella fuera de la cama destino
 * se acercan lo justo para quedar dentro (las de una misma placa se trasladan juntas, conservando su lugar relativo). Si
 * ya caben donde se soltaron, o el conjunto es más grande que la cama, no se tocan. null si nada cambia.
 */
export function fitReassignedIntoBeds(
  before: readonly SceneObject[], after: readonly SceneObject[], plates: readonly ScenePlate[], projectBed: ProjectBed,
): SceneObject[] | null {
  const prev = new Map(before.map((o) => [o.id, o.plateRef]));
  const byPlate = new Map<string, SceneObject[]>();
  for (const o of after) {
    if (!prev.has(o.id) || o.plateRef === undefined || o.plateRef === prev.get(o.id) || o.metadata?.addon || !assignable(o)) continue;
    byPlate.set(o.plateRef, [...(byPlate.get(o.plateRef) ?? []), o]);
  }
  const shift = new Map<string, [number, number]>();
  for (const [plateId, group] of byPlate) {
    const plate = findPlate(plates, plateId);
    if (!plate) continue;
    const { dx, dz } = fitInsideBox(group.map((o) => footprintOf(o.mesh, o.position, o.rotation, o.scale)), plateBedBox(plate, projectBed));
    if (dx !== 0 || dz !== 0) for (const o of group) shift.set(o.id, [dx, dz]);
  }
  if (shift.size === 0) return null;
  return after.map((o) => {
    const d = shift.get(o.id);
    return d ? { ...o, position: [o.position[0] + d[0], o.position[1], o.position[2] + d[1]] as Vec3 } : o;
  });
}

/** Rectángulo de la cama de una placa en mundo. */
function plateBedBox(plate: ScenePlate, projectBed: ProjectBed): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const b = plateBed(plate, projectBed);
  return { minX: plate.origin[0] - b.widthMm / 2, maxX: plate.origin[0] + b.widthMm / 2, minZ: plate.origin[1] - b.depthMm / 2, maxZ: plate.origin[1] + b.depthMm / 2 };
}

/** Pose de impresión de la pieza: la viva en imprimir; en armado, la guardada (`restPose`) o la derivada. */
function printPoseOf(objects: readonly SceneObject[], o: SceneObject, layout: SceneLayout, ctx: LayoutContext): { position: Vec3; rotation: Vec3 } {
  if (layout === 'print') return { position: o.position, rotation: o.rotation };
  const rest = o.restPose ?? layoutPoseOf(objects, o, 'assembly', 'print', ctx);
  return { position: rest.position, rotation: rest.rotation };
}

const EPS_MM = 1e-6;

/**
 * Traslado (dx, dz) que lleva la caja del conjunto de huellas dentro de `box` con el menor desplazamiento; `fits` es
 * false si el conjunto es más grande que la cama en algún eje (entonces se deja como está: conserva su lugar relativo y sobresale por igual).
 */
function fitInsideBox(
  prints: ReadonlyArray<{ minX: number; maxX: number; minZ: number; maxZ: number } | null>, box: { minX: number; maxX: number; minZ: number; maxZ: number },
): { dx: number; dz: number; fits: boolean } {
  const fps = prints.filter((f): f is NonNullable<typeof f> => f !== null);
  if (fps.length === 0) return { dx: 0, dz: 0, fits: true };
  const lo = (key: 'minX' | 'minZ') => Math.min(...fps.map((f) => f[key]));
  const hi = (key: 'maxX' | 'maxZ') => Math.max(...fps.map((f) => f[key]));
  const axis = (min: number, max: number, bMin: number, bMax: number) => {
    if (max - min > bMax - bMin + EPS_MM) return { d: 0, fits: false };
    if (min < bMin - EPS_MM) return { d: bMin - min, fits: true };
    if (max > bMax + EPS_MM) return { d: bMax - max, fits: true };
    return { d: 0, fits: true };
  };
  const x = axis(lo('minX'), hi('maxX'), box.minX, box.maxX);
  const z = axis(lo('minZ'), hi('maxZ'), box.minZ, box.maxZ);
  return { dx: x.d, dz: z.d, fits: x.fits && z.fits };
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
