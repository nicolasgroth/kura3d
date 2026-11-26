/**
 * @file src/core/scene/plates.ts
 * @description Placas de impresión de la escena, funciones puras (diseño en `docs/diseno/PLACAS_Y_ARMADO.md`):
 * crear (la placa implícita del origen se vuelve «Placa 1» y recibe las piezas sólidas), origen libre que no se
 * solapa con las demás, borrar (las piezas pasan a la placa por defecto), renombrar, asignar piezas, consultas,
 * cama de cada placa, placa activa y saneo de datos externos. Sin React, Zustand ni i18n: los nombres por
 * defecto llegan ya traducidos.
 *
 * Reglas:
 * - Sin placas (`plates` vacío) hay una placa implícita en el origen y todo se comporta como antes.
 * - Una pieza, una placa (`plateRef`). Solo los sólidos no bloqueados se asignan; referencias y negativos
 *   quedan sin placa salvo que ya traigan una.
 * - Una pieza sin `plateRef` habiendo placas está «sin placa» (no cuenta para fuera de volumen ni para la
 *   exportación por placa). La placa por defecto es la primera de la lista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { TRANSFORM_LIMITS } from '../../engine/operationLimits';
import type { SceneObject } from '../../types/kura';
import type { PlateBed, ScenePlate } from '../../types/plates';
import { SPLIT_PLATE_COLUMNS, SPLIT_PLATE_GAP_MM } from './splitGroups';

/** Máximo de placas por escena (también lo valida el `.kura`). */
export const MAX_PLATES = 256;
export const MAX_PLATE_NAME = 80;
/** Separación entre camas vecinas y placas por fila: las mismas que las placas virtuales de Dividir. */
export const PLATE_GAP_MM = SPLIT_PLATE_GAP_MM;
export const PLATE_COLUMNS = SPLIT_PLATE_COLUMNS;
/** Lado máximo de una cama propia (mm): ninguna impresora real se le acerca. */
export const MAX_PLATE_BED_MM = 10_000;

/** Volumen de impresión de una placa (mismo formato que `SplitBed`, con margen opcional). */
export interface ProjectBed {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  marginMm?: number;
}

export interface PlateScene {
  objects: SceneObject[];
  plates: ScenePlate[];
}

type ObjLike = Pick<SceneObject, 'id' | 'plateRef'>;

const bedSide = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_PLATE_BED_MM;

/** true si la cama propia trae medidas utilizables. */
export function validPlateBed(bed: PlateBed): boolean {
  return bedSide(bed.widthMm) && bedSide(bed.depthMm) && bedSide(bed.heightMm)
    && (bed.marginMm === undefined || (Number.isFinite(bed.marginMm) && bed.marginMm >= 0 && bed.marginMm <= 50));
}

/** Cama de la placa: la propia o la del proyecto (sin placa = la del proyecto). */
export function plateBed(plate: ScenePlate | null | undefined, projectBed: ProjectBed): ProjectBed {
  const own = plate?.bed;
  if (!own) return projectBed;
  return { widthMm: own.widthMm, depthMm: own.depthMm, heightMm: own.heightMm, ...(own.marginMm !== undefined ? { marginMm: own.marginMm } : {}) };
}

/**
 * true si las placas no cambian dónde está la cama ni cuál es: ninguna, o una sola en el origen con la cama del
 * proyecto. Solo entonces vale el camino de siempre (todo se mide contra la cama del proyecto centrada en el origen).
 * Una única placa fuera del origen o con cama propia (p. ej. tras borrar la placa 1) NO es legado: hay que restar su
 * origen y usar su cama. Atajo único: no uses `plates.length < 2` para decidir algo que dependa de posiciones.
 */
export function isLegacyPlateSetup(plates: readonly ScenePlate[], projectBed?: ProjectBed): boolean {
  if (plates.length === 0) return true;
  if (plates.length > 1) return false;
  const only = plates[0];
  if (only.origin[0] !== 0 || only.origin[1] !== 0) return false;
  if (!only.bed) return true;
  return projectBed !== undefined
    && only.bed.widthMm === projectBed.widthMm && only.bed.depthMm === projectBed.depthMm && only.bed.heightMm === projectBed.heightMm
    && (only.bed.marginMm ?? 0) === (projectBed.marginMm ?? 0);
}

export function findPlate(plates: readonly ScenePlate[], plateId: string | null | undefined): ScenePlate | null {
  return plateId ? plates.find((p) => p.id === plateId) ?? null : null;
}

/** Placa activa: la pedida si existe, si no la primera; null sin placas (placa implícita). */
export function resolveActivePlate(plates: readonly ScenePlate[], activeId: string | null | undefined): ScenePlate | null {
  return findPlate(plates, activeId) ?? plates[0] ?? null;
}

/** Placa de la pieza (null = sin placa o referencia rota). */
export function plateOf(plates: readonly ScenePlate[], obj: ObjLike): ScenePlate | null {
  return findPlate(plates, obj.plateRef);
}

/** Ids de las piezas de la placa, en el orden de la escena. */
export function objectsOnPlate(objects: readonly ObjLike[], plateId: string): string[] {
  return objects.filter((o) => o.plateRef === plateId).map((o) => o.id);
}

/** Pieza que puede ir en una placa: sólida y no bloqueada. */
export function assignable(obj: Pick<SceneObject, 'role' | 'locked'>): boolean {
  return obj.role === 'solid' && !obj.locked;
}

/** Primer nombre libre «Placa N» (`nameFor(n)` devuelve el texto traducido). */
export function nextPlateName(plates: readonly ScenePlate[], nameFor: (n: number) => string): string {
  const names = new Set(plates.map((p) => p.name));
  for (let n = plates.length ? 1 : 2; n <= MAX_PLATES + 1; n++) if (!names.has(nameFor(n))) return nameFor(n);
  return nameFor(plates.length + 1);
}

/**
 * Nombre que no repite el de otra placa (sin distinguir mayúsculas): el propio si está libre; si no, su número final
 * sube hasta el primer libre («Placa 1» → «Placa 2») o, sin número, se le añade « 2», « 3»… Respeta MAX_PLATE_NAME.
 */
export function uniquePlateName(plates: readonly ScenePlate[], name: string): string {
  const taken = new Set(plates.map((p) => p.name.trim().toLowerCase()));
  const base = name.trim();
  if (!taken.has(base.toLowerCase())) return base;
  const m = /^(.*?)(\d+)\s*$/.exec(base);
  const stem = m ? m[1] : `${base} `;
  for (let n = m ? Number(m[2]) + 1 : 2; n < 1000; n++) {
    const cand = `${stem.slice(0, MAX_PLATE_NAME - String(n).length)}${n}`;
    if (!taken.has(cand.toLowerCase())) return cand;
  }
  return base;
}

/** true si las camas de dos placas quedan separadas por al menos `gap` en algún eje. */
export function bedsSeparated(ax: number, az: number, a: ProjectBed, bx: number, bz: number, b: ProjectBed, gap: number): boolean {
  const eps = 1e-6;
  return Math.abs(ax - bx) - (a.widthMm + b.widthMm) / 2 >= gap - eps || Math.abs(az - bz) - (a.depthMm + b.depthMm) / 2 >= gap - eps;
}

/**
 * Origen libre para una placa nueva: recorre una cuadrícula de `PLATE_COLUMNS` columnas hacia +X y filas hacia
 * −Z (como las placas virtuales de Dividir) con paso igual a la cama más grande más la separación, y toma la
 * primera celda que no se solapa con ninguna placa. Cada placa existente bloquea a lo sumo 4 celdas, así que
 * 4n + 1 celdas bastan. null si el origen saldría de los límites de coordenadas.
 */
export function nextPlateOrigin(plates: readonly ScenePlate[], projectBed: ProjectBed, bed?: PlateBed, gap = PLATE_GAP_MM): [number, number] | null {
  const fresh = plateBed(bed ? { id: '', name: '', origin: [0, 0], bed } : null, projectBed);
  const beds = plates.map((p) => plateBed(p, projectBed));
  const pitchX = Math.max(fresh.widthMm, ...beds.map((b) => b.widthMm)) + gap;
  const pitchZ = Math.max(fresh.depthMm, ...beds.map((b) => b.depthMm)) + gap;
  for (let k = 0; k <= plates.length * 4; k++) {
    const x = (k % PLATE_COLUMNS) * pitchX;
    const row = Math.floor(k / PLATE_COLUMNS);
    const z = row === 0 ? 0 : -row * pitchZ; // sin −0 (se guarda y compara)
    if (plates.every((p, i) => bedsSeparated(x, z, fresh, p.origin[0], p.origin[1], beds[i], gap))) {
      const reach = Math.max(Math.abs(x) + fresh.widthMm / 2, Math.abs(z) + fresh.depthMm / 2);
      return reach <= TRANSFORM_LIMITS.maxAbsCoordinate ? [x, z] : null;
    }
  }
  return null;
}

export interface CreatePlateOptions {
  id: string;
  name: string;
  projectBed: ProjectBed;
  /** Id y nombre de la placa implícita si la escena aún no tiene placas. */
  implicit: { id: string; name: string };
  bed?: PlateBed;
}

const cleanName = (name: string) => name.trim().slice(0, MAX_PLATE_NAME);

/**
 * Agrega una placa en un origen libre. Si la escena no tenía placas, primero vuelve explícita la implícita
 * (en el origen, con la cama del proyecto) y le asigna las piezas sólidas sin placa. null si la entrada no es
 * válida (id repetido, nombre vacío, cama inválida, tope de placas o sin espacio).
 */
export function createPlate(scene: PlateScene, options: CreatePlateOptions): { scene: PlateScene; plate: ScenePlate } | null {
  const name = cleanName(options.name);
  if (!options.id || !name || (options.bed && !validPlateBed(options.bed))) return null;
  let { objects, plates } = scene;
  if (plates.length === 0) {
    const implicitName = cleanName(options.implicit.name);
    if (!options.implicit.id || !implicitName || options.implicit.id === options.id) return null;
    plates = [{ id: options.implicit.id, name: implicitName, origin: [0, 0] }];
    const firstId = options.implicit.id;
    objects = objects.map((o) => (o.role === 'solid' && o.plateRef === undefined ? { ...o, plateRef: firstId } : o));
  }
  if (plates.length >= MAX_PLATES || plates.some((p) => p.id === options.id)) return null;
  const origin = nextPlateOrigin(plates, options.projectBed, options.bed);
  if (!origin) return null;
  const plate: ScenePlate = { id: options.id, name, origin, ...(options.bed ? { bed: { ...options.bed } } : {}) };
  return { scene: { objects, plates: [...plates, plate] }, plate };
}

/**
 * Borra una placa. Sus piezas pasan a `reassignTo` (por defecto la primera placa que queda; `null` = sin
 * placa) y conservan su posición. No borra la última placa: una escena con placas siempre tiene al menos una.
 */
export function deletePlate(scene: PlateScene, plateId: string, reassignTo?: string | null): PlateScene | null {
  if (!scene.plates.some((p) => p.id === plateId) || scene.plates.length < 2) return null;
  const plates = scene.plates.filter((p) => p.id !== plateId);
  const target = reassignTo === undefined ? plates[0].id : reassignTo === null ? null : findPlate(plates, reassignTo)?.id ?? plates[0].id;
  const objects = scene.objects.map((o) => {
    if (o.plateRef !== plateId) return o;
    if (target) return { ...o, plateRef: target };
    const { plateRef: _drop, ...rest } = o;
    return rest;
  });
  return { objects, plates };
}

/** ¿Otra placa (no `plateId`) ya usa este nombre, sin distinguir mayúsculas? */
export function otherPlateNameTaken(plates: readonly ScenePlate[], plateId: string, name: string): boolean {
  const wanted = cleanName(name).toLowerCase();
  return wanted !== '' && plates.some((p) => p.id !== plateId && p.name.trim().toLowerCase() === wanted);
}

/**
 * Renombra (recortado a `MAX_PLATE_NAME`); null si la placa no existe, el nombre queda vacío o no cambia. Si otra
 * placa ya usa el nombre, el resultado se ajusta con `uniquePlateName` (la interfaz lo rechaza antes con un aviso).
 */
export function renamePlate(scene: PlateScene, plateId: string, name: string): PlateScene | null {
  const cleaned = cleanName(name);
  const plate = findPlate(scene.plates, plateId);
  if (!plate || !cleaned) return null;
  const clean = uniquePlateName(scene.plates.filter((p) => p.id !== plateId), cleaned);
  if (clean === plate.name) return null;
  return { objects: scene.objects, plates: scene.plates.map((p) => (p.id === plateId ? { ...p, name: clean } : p)) };
}

/** Asigna las piezas a la placa (solo sólidos no bloqueados); null si la placa no existe o nada cambia. */
export function assignToPlate(scene: PlateScene, ids: readonly string[], plateId: string): PlateScene | null {
  if (!findPlate(scene.plates, plateId)) return null;
  const wanted = new Set(ids);
  let changed = false;
  const objects = scene.objects.map((o) => {
    if (!wanted.has(o.id) || o.plateRef === plateId || !assignable(o)) return o;
    changed = true;
    return { ...o, plateRef: plateId };
  });
  return changed ? { objects, plates: scene.plates } : null;
}

/**
 * Escena con placas coherentes (al abrir un archivo, tras deshacer o tras cualquier cambio): sin ids repetidos,
 * nombres recortados, a lo sumo `MAX_PLATES`, y cada `plateRef` apunta a una placa existente. Una referencia
 * rota pasa a la placa por defecto (la pieza nunca se pierde); sin placas, se quita. Devuelve la misma escena
 * (mismas referencias) si no había nada que corregir. `nameFor(n)` da el nombre de una placa sin nombre (por
 * defecto, neutro e independiente del idioma: el códec no lo conoce).
 */
export function reconcilePlates(scene: PlateScene, nameFor: (n: number) => string = (n) => `#${n}`): PlateScene {
  const seen = new Set<string>();
  let platesChanged = scene.plates.length > MAX_PLATES;
  const plates: ScenePlate[] = [];
  for (const p of scene.plates.slice(0, MAX_PLATES)) {
    if (seen.has(p.id)) {
      platesChanged = true;
      continue;
    }
    seen.add(p.id);
    // Un nombre vacío (que `createPlate` rechazaría) se repara con uno por defecto: la placa no se pierde.
    const name = p.name.trim() ? p.name.slice(0, MAX_PLATE_NAME) : nameFor(plates.length + 1);
    if (name !== p.name) platesChanged = true;
    plates.push(name === p.name ? p : { ...p, name });
  }
  const fallback = plates[0]?.id;
  let objectsChanged = false;
  const objects = scene.objects.map((o) => {
    if (o.plateRef === undefined || seen.has(o.plateRef)) return o;
    objectsChanged = true;
    if (fallback) return { ...o, plateRef: fallback };
    const { plateRef: _drop, ...rest } = o;
    return rest;
  });
  if (!platesChanged && !objectsChanged) return scene;
  return { objects: objectsChanged ? objects : scene.objects, plates: platesChanged ? plates : scene.plates };
}
