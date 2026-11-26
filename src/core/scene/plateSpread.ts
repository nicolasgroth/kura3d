/**
 * @file src/core/scene/plateSpread.ts
 * @description «Una placa por objeto» (función pura): deja cada pieza sólida en su propia placa y centrada sobre su
 * cama. Reutiliza las placas que ya no tienen a nadie más (la placa propia de la pieza primero) y crea las que
 * faltan. Las piezas bloqueadas, los negativos y las referencias no se tocan; los agregados ligados y los negativos
 * de grupo acompañan a su pieza (mismo traslado que «Mover a placa»). Una placa con una pieza que no participa
 * (p. ej. una bloqueada) no se reutiliza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import type { SceneLayout } from '../../types/plates';
import { footprintOf } from './freeSpot';
import type { LayoutContext } from './layoutPoses';
import { followersOf, movePiecesToPlate } from './plateMove';
import { assignable, createPlate, findPlate, nextPlateName, type PlateScene, type ProjectBed } from './plates';

export interface SpreadOptions {
  projectBed: ProjectBed;
  layout: SceneLayout;
  ctx: LayoutContext;
  /** Genera ids nuevos de placa. */
  makeId: () => string;
  /** Nombre por defecto «Placa N». */
  nameFor: (n: number) => string;
}

export interface SpreadResult {
  scene: PlateScene;
  /** Ids de las piezas que quedaron una por placa. */
  pieces: string[];
  /** Cuántas placas se crearon (la implícita que se vuelve explícita cuenta). */
  created: number;
}

/** Piezas que participan: sólidas, no bloqueadas y que no son agregados de otra pieza. */
export function spreadCandidates(objects: readonly SceneObject[], ids: readonly string[]): SceneObject[] {
  const wanted = ids.length ? new Set(ids) : null;
  return objects.filter((o) => assignable(o) && !o.metadata?.addon && (wanted === null || wanted.has(o.id)));
}

/** Traslada la pieza y sus acompañantes `(dx, dz)` en la pose de impresión (viva en imprimir, `restPose` en armado). */
function shift(objects: SceneObject[], ids: ReadonlySet<string>, dx: number, dz: number, layout: SceneLayout): SceneObject[] {
  const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
  return objects.map((o) => {
    if (!ids.has(o.id)) return o;
    if (layout === 'print') return { ...o, position: [clean(o.position[0] + dx), o.position[1], clean(o.position[2] + dz)] as SceneObject['position'] };
    if (!o.restPose) return o;
    const p = o.restPose.position;
    return { ...o, restPose: { ...o.restPose, position: [clean(p[0] + dx), p[1], clean(p[2] + dz)] as typeof p } };
  });
}

/** Centro [X, Z] de la huella de la pieza en su pose de impresión; null si no tiene malla medible. */
function printCenter(o: SceneObject, layout: SceneLayout): [number, number] | null {
  const pose = layout === 'print' ? { position: o.position, rotation: o.rotation } : o.restPose;
  if (!pose) return null;
  const fp = footprintOf(o.mesh, pose.position, pose.rotation, o.scale);
  return fp ? [(fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2] : null;
}

/** Deja cada pieza en su placa. null si hay menos de 2 piezas participantes o no se pueden crear las placas. */
export function spreadOnePlatePerObject(scene: PlateScene, ids: readonly string[], opts: SpreadOptions): SpreadResult | null {
  const pieces = spreadCandidates(scene.objects, ids);
  if (pieces.length < 2) return null;
  const pieceIds = new Set(pieces.map((o) => o.id));
  const mine = new Set([...pieceIds, ...followersOf(scene.objects, pieces).keys()]);

  let current = scene;
  let created = 0;
  const usableCount = (s: PlateScene) => s.plates.filter((p) => s.objects.every((o) => o.plateRef !== p.id || mine.has(o.id))).length;
  while (usableCount(current) < pieces.length) {
    const made = createPlate(current, {
      id: opts.makeId(), name: nextPlateName(current.plates, opts.nameFor), projectBed: opts.projectBed, implicit: { id: opts.makeId(), name: opts.nameFor(1) },
    });
    if (!made) return null;
    created += current.plates.length === 0 ? 2 : 1;
    current = made.scene;
  }

  // Reparto: cada pieza conserva su placa si es utilizable y nadie la tomó; el resto toma la primera libre.
  const usable = current.plates.filter((p) => current.objects.every((o) => o.plateRef !== p.id || mine.has(o.id)));
  const taken = new Set<string>();
  const dest = new Map<string, string>();
  for (const o of pieces) {
    const own = usable.find((p) => p.id === o.plateRef);
    if (own && !taken.has(own.id)) {
      taken.add(own.id);
      dest.set(o.id, own.id);
    }
  }
  for (const o of pieces) {
    if (dest.has(o.id)) continue;
    const free = usable.find((p) => !taken.has(p.id))!;
    taken.add(free.id);
    dest.set(o.id, free.id);
  }

  for (const o of pieces) {
    const plateId = dest.get(o.id)!;
    const moved = movePiecesToPlate(current, [o.id], plateId, opts.layout, opts.ctx, opts.projectBed);
    if (moved) current = moved.scene;
    const now = current.objects.find((x) => x.id === o.id)!;
    const plate = findPlate(current.plates, plateId)!;
    const centre = printCenter(now, opts.layout);
    if (!centre) continue;
    const group = new Set([o.id, ...followersOf(current.objects, [now]).keys()]);
    current = { objects: shift(current.objects, group, plate.origin[0] - centre[0], plate.origin[1] - centre[1], opts.layout), plates: current.plates };
  }
  return { scene: current, pieces: pieces.map((o) => o.id), created };
}
