/**
 * @file src/core/scene/plateBedChange.ts
 * @description Cambiar la cama de una placa (lote P7, dos impresoras), funciones puras compartidas por el store y el
 * MCP sin interfaz. Una placa usa la cama del proyecto (`bed` ausente) o una propia, tomada de un perfil de impresora
 * (de fábrica o «Mis camas») o de medidas sueltas.
 *
 * Regla de vecinas (decisión): una cama más grande no puede pisar a otra placa. Se recorren las placas en orden; cada
 * una que quede a menos de `PLATE_GAP_MM` de una ya colocada, siendo una de las dos la cambiada o una ya recolocada, se
 * recoloca en el primer origen libre (`nextPlateOrigin`) con sus piezas y acompañantes (pose viva en imprimir,
 * `restPose` en armado), y la cadena sigue. Las demás no se tocan. Las piezas bloqueadas no se trasladan (como al
 * borrar una placa): conservan su lugar y su placa, y salen en `keptLocked` para avisar. Sin origen libre, null y
 * nada cambia. Todo en un solo resultado: el llamador lo aplica en un paso de deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { PrinterProfile, SceneObject } from '../../types/kura';
import type { PlateBed, SceneLayout, ScenePlate } from '../../types/plates';
import { layoutPoseOf, type LayoutContext } from './layoutPoses';
import { followersOf } from './plateMove';
import {
  bedsSeparated, findPlate, MAX_PLATE_NAME, nextPlateOrigin, PLATE_GAP_MM, plateBed, validPlateBed, type PlateScene, type ProjectBed,
} from './plates';

export interface PlateBedChangeOptions {
  projectBed: ProjectBed;
  layout: SceneLayout;
  ctx: LayoutContext;
}

export interface PlateBedChangeResult {
  scene: PlateScene;
  /** Placas que cambiaron de origen para no pisarse, en el orden de la lista. */
  relocated: string[];
  /** Piezas bloqueadas que quedaron en su lugar aunque su placa se recolocó. */
  keptLocked: string[];
}

/** Cama propia a partir de un perfil de impresora (de fábrica o del usuario). */
export function plateBedFromProfile(profile: PrinterProfile): PlateBed {
  return {
    profileId: profile.id,
    name: profile.name.trim().slice(0, MAX_PLATE_NAME),
    widthMm: profile.bedWidthMm,
    depthMm: profile.bedDepthMm,
    heightMm: profile.maxHeightMm,
    ...(profile.marginMm !== undefined ? { marginMm: profile.marginMm } : {}),
  };
}

/** Dos camas propias iguales (ausente = la del proyecto): mismo perfil, nombre y medidas. */
export function samePlateBed(a: PlateBed | undefined, b: PlateBed | undefined): boolean {
  if (!a || !b) return a === b;
  return a.profileId === b.profileId && a.name === b.name && a.widthMm === b.widthMm && a.depthMm === b.depthMm
    && a.heightMm === b.heightMm && a.marginMm === b.marginMm;
}

const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

function cleanBed(bed: PlateBed): PlateBed | null {
  const name = bed.name.trim().slice(0, MAX_PLATE_NAME);
  const out: PlateBed = {
    ...(bed.profileId ? { profileId: bed.profileId.slice(0, 64) } : {}),
    name, widthMm: bed.widthMm, depthMm: bed.depthMm, heightMm: bed.heightMm,
    ...(bed.marginMm !== undefined ? { marginMm: bed.marginMm } : {}),
  };
  return name && validPlateBed(out) ? out : null;
}

/** Traslada en XZ lo que vive en las placas recolocadas (pose viva en imprimir, pose de impresión en armado). */
function shiftContents(
  objects: SceneObject[], deltas: ReadonlyMap<string, [number, number]>, layout: SceneLayout, ctx: LayoutContext,
): { objects: SceneObject[]; keptLocked: string[] } {
  const movers = objects.filter((o) => o.plateRef !== undefined && deltas.has(o.plateRef) && !o.locked);
  const keptLocked = objects.filter((o) => o.plateRef !== undefined && deltas.has(o.plateRef) && o.locked).map((o) => o.id);
  const delta = new Map<string, [number, number]>();
  for (const o of movers) delta.set(o.id, deltas.get(o.plateRef!)!);
  // Acompañantes sin placa (imanes, negativos del grupo) heredan el desplazamiento de su pieza.
  for (const [id, host] of followersOf(objects, movers)) {
    const d = delta.get(host);
    const f = objects.find((o) => o.id === id);
    if (d && f && !delta.has(id) && (f.plateRef === undefined || deltas.has(f.plateRef))) delta.set(id, d);
  }
  if (delta.size === 0) return { objects, keptLocked };
  const next = objects.map((o) => {
    const d = delta.get(o.id);
    if (!d) return o;
    if (layout === 'print') return { ...o, position: [clean(o.position[0] + d[0]), o.position[1], clean(o.position[2] + d[1])] as SceneObject['position'] };
    const rest = o.restPose ?? layoutPoseOf(objects, o, 'assembly', 'print', ctx);
    return {
      ...o,
      restPose: {
        position: [clean(rest.position[0] + d[0]), rest.position[1], clean(rest.position[2] + d[1])] as [number, number, number],
        rotation: [rest.rotation[0], rest.rotation[1], rest.rotation[2]] as [number, number, number],
      },
    };
  });
  return { objects: next, keptLocked };
}

/**
 * Pone la cama `bed` (null = la del proyecto) a la placa `plateId` y recoloca las placas que chocarían. null si la
 * placa no existe, la cama no es válida, nada cambia o no hay origen libre para alguna placa que debía moverse.
 */
export function setPlateBed(scene: PlateScene, plateId: string, bed: PlateBed | null, opts: PlateBedChangeOptions): PlateBedChangeResult | null {
  const plate = findPlate(scene.plates, plateId);
  if (!plate) return null;
  const nextBed = bed ? cleanBed(bed) : null;
  if (bed && !nextBed) return null;
  if (samePlateBed(plate.bed, nextBed ?? undefined)) return null;
  const changed: ScenePlate = nextBed ? { ...plate, bed: nextBed } : (({ bed: _drop, ...rest }) => rest)(plate);

  const placed: ScenePlate[] = [];
  const dirty = new Set<string>([plateId]);
  const deltas = new Map<string, [number, number]>();
  for (const p of scene.plates) {
    const current = p.id === plateId ? changed : p;
    const own = plateBed(current, opts.projectBed);
    const clash = placed.some((q) => (dirty.has(q.id) || dirty.has(current.id))
      && !bedsSeparated(current.origin[0], current.origin[1], own, q.origin[0], q.origin[1], plateBed(q, opts.projectBed), PLATE_GAP_MM));
    if (!clash) {
      placed.push(current);
      continue;
    }
    const origin = nextPlateOrigin(placed, opts.projectBed, current.bed);
    if (!origin) return null;
    deltas.set(current.id, [origin[0] - current.origin[0], origin[1] - current.origin[1]]);
    dirty.add(current.id);
    placed.push({ ...current, origin });
  }

  const shifted = deltas.size ? shiftContents(scene.objects, deltas, opts.layout, opts.ctx) : { objects: scene.objects, keptLocked: [] };
  return { scene: { objects: shifted.objects, plates: placed }, relocated: [...deltas.keys()], keptLocked: shifted.keptLocked };
}
