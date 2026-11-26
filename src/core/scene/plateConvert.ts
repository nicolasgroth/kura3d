/**
 * @file src/core/scene/plateConvert.ts
 * @description «Convertir grupos en placas» (lote P7, pregunta 7 del diseño), función pura compartida por la oferta al
 * importar un 3MF con placas de un laminador (Bambu Studio / OrcaSlicer, que llegan como grupos «Placa N») y por la
 * acción explícita sobre proyectos ya importados.
 *
 * Reglas:
 * - Cada grupo raíz pedido se vuelve una placa con su nombre, en el primer origen libre (`nextPlateOrigin`). Sus piezas
 *   (con subgrupos, negativos y agregados) se trasladan juntas: conservan sus posiciones relativas y la huella del
 *   conjunto queda centrada en la cama. Los sólidos pasan a la placa nueva; lo demás solo cambia de placa si ya tenía.
 * - Los grupos se conservan (siguen organizando la escena); solo cambia la placa de sus piezas.
 * - Un grupo con alguna pieza bloqueada, o sin sólidos, no se convierte (`skipped`): mover lo bloqueado no corresponde.
 * - Sin placas, si quedan sólidos fuera de los grupos convertidos, primero se vuelve explícita la placa implícita del
 *   origen con esos sólidos (como al crear la segunda placa); si no queda ninguno, la primera placa nueva va al origen.
 * - Solo en la pose de impresión (el store lo rechaza en Armado). Tope `MAX_PLATES`; sin origen libre se detiene y lo
 *   que falta sale en `skipped`. null si no se convirtió ningún grupo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneGroup, SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { footprintOf } from './freeSpot';
import { descendantObjectIds, effectiveLocked, groupMap } from './groups';
import { isNegative } from './objectRole';
import { assignable, MAX_PLATE_NAME, MAX_PLATES, nextPlateOrigin, uniquePlateName, type PlateScene, type ProjectBed } from './plates';

export interface ConvertGroupsScene extends PlateScene {
  groups: SceneGroup[];
}

export interface ConvertGroupsOptions {
  projectBed: ProjectBed;
  makeId: () => string;
  /** Nombre «Placa N» ya traducido (para la placa implícita y grupos sin nombre). */
  nameFor: (n: number) => string;
}

export interface ConvertGroupsResult {
  scene: PlateScene;
  /** Ids de las placas creadas a partir de grupos, en orden. */
  created: string[];
  /** Grupos pedidos que no se convirtieron. */
  skipped: string[];
}

const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

/** Grupos raíz (sin padre, existentes y sin repetir) en el orden de `groups`. */
export function rootGroupIds(groups: readonly SceneGroup[], ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return groups.filter((g) => wanted.has(g.id) && g.parentId === undefined).map((g) => g.id);
}

/** Grupos raíz cuyo nombre parece de placa («Placa 3», «Plate 12»…), según `isPlateName`. */
export function plateNamedGroups(groups: readonly SceneGroup[], isPlateName: (name: string) => boolean): string[] {
  return groups.filter((g) => g.parentId === undefined && isPlateName(g.name.trim())).map((g) => g.id);
}

export function convertGroupsToPlates(scene: ConvertGroupsScene, groupIds: readonly string[], opts: ConvertGroupsOptions): ConvertGroupsResult | null {
  const roots = rootGroupIds(scene.groups, groupIds);
  const byGroup = groupMap(scene.groups);
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  const skipped = groupIds.filter((id) => !roots.includes(id));
  const jobs: Array<{ group: SceneGroup; members: SceneObject[] }> = [];
  for (const gid of roots) {
    const group = byGroup.get(gid)!;
    const members = descendantObjectIds(scene.objects, scene.groups, gid).map((id) => byId.get(id)!).filter(Boolean);
    const solids = members.filter((o) => o.role === 'solid');
    if (solids.length === 0 || members.some((o) => o.locked || effectiveLocked(byGroup, o))) skipped.push(gid);
    else jobs.push({ group, members });
  }
  if (jobs.length === 0) return null;

  const converting = new Set(jobs.flatMap((j) => j.members.map((o) => o.id)));
  let plates: ScenePlate[] = [...scene.plates];
  let objects = scene.objects;
  if (plates.length === 0) {
    const rest = objects.filter((o) => !converting.has(o.id) && o.role === 'solid' && o.plateRef === undefined);
    if (rest.length > 0) {
      const implicit: ScenePlate = { id: opts.makeId(), name: opts.nameFor(1), origin: [0, 0] };
      plates = [implicit];
      const restIds = new Set(rest.map((o) => o.id));
      objects = objects.map((o) => (restIds.has(o.id) ? { ...o, plateRef: implicit.id } : o));
    }
  }

  const created: string[] = [];
  const delta = new Map<string, { d: [number, number]; plate: string }>();
  for (const [k, job] of jobs.entries()) {
    const origin = plates.length < MAX_PLATES ? nextPlateOrigin(plates, opts.projectBed) : null;
    if (!origin) {
      skipped.push(...jobs.slice(k).map((j) => j.group.id));
      break;
    }
    const name = uniquePlateName(plates, job.group.name.trim().slice(0, MAX_PLATE_NAME) || opts.nameFor(plates.length + 1));
    const plate: ScenePlate = { id: opts.makeId(), name, origin };
    plates = [...plates, plate];
    created.push(plate.id);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const o of job.members) {
      if (o.role !== 'solid' || isNegative(o)) continue;
      const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale);
      if (!fp) continue;
      minX = Math.min(minX, fp.minX); maxX = Math.max(maxX, fp.maxX);
      minZ = Math.min(minZ, fp.minZ); maxZ = Math.max(maxZ, fp.maxZ);
    }
    const cx = Number.isFinite(minX) ? (minX + maxX) / 2 : job.members[0].position[0];
    const cz = Number.isFinite(minZ) ? (minZ + maxZ) / 2 : job.members[0].position[2];
    const d: [number, number] = [origin[0] - cx, origin[1] - cz];
    for (const o of job.members) delta.set(o.id, { d, plate: plate.id });
  }
  if (created.length === 0) return null;

  objects = objects.map((o) => {
    const move = delta.get(o.id);
    if (!move) return o;
    const next: SceneObject = { ...o, position: [clean(o.position[0] + move.d[0]), o.position[1], clean(o.position[2] + move.d[1])] };
    if (assignable(o) || o.plateRef !== undefined) next.plateRef = move.plate;
    return next;
  });
  return { scene: { objects, plates }, created, skipped };
}
