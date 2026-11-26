/**
 * @file src/engine/io/kuraSceneMeta.ts
 * @description Metadatos propios de Kurra Studio dentro de un 3MF (`Metadata/kura_scene.json`, espacio de
 * nombres `KURA_SCENE_NAMESPACE`): por cada objeto del modelo, su transformación exacta (posición,
 * rotación, escala), nombre, color, visibilidad, bloqueo, hueco y grupo; y el árbol de grupos (anidados,
 * plegado, visible, bloqueado). Con ellos, la ida y vuelta por 3MF de Kurra Studio restaura la escena tal cual,
 * sin reacomodo ni detección de conjuntos. Con placas, cada objeto guarda el origen de placa restado (`plateOffset`). Los laminadores ignoran el archivo. La lectura es defensiva:
 * tope de bytes, de entradas y de longitud de textos; cualquier incoherencia descarta los metadatos y el
 * archivo se lee como un 3MF cualquiera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneGroup, SceneObject, Vec3 } from '../../types/kura';
import { MAX_PART_NAME } from './importErrors';
import { isNegative } from '../../core/scene/objectRole';
import { TRANSFORM_LIMITS } from '../operationLimits';
import { MAX_PLATE_NAME, MAX_PLATES, validPlateBed } from '../../core/scene/plates';
import type { PlateBed } from '../../types/plates';

/** Ruta del archivo dentro del paquete. */
export const KURA_SCENE_PATH = 'Metadata/kura_scene.json';
/** Identificador del formato (versión 1). */
export const KURA_SCENE_NAMESPACE = 'urn:kura:3mf:scene:1';
/** Tope de bytes del JSON (una escena de 2 000 objetos con grupos ocupa mucho menos). */
export const KURA_SCENE_MAX_BYTES = 4 * 1024 * 1024;
/** Tope de grupos aceptados al leer. */
const MAX_META_GROUPS = 4_000;
const MAX_TEXT = 200;

/** Objeto de la escena tal como lo guarda Kurra Studio (`objectId` es el id del `<object>` del 3MF). */
export interface KuraSceneObjectMeta {
  objectId: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  visible: boolean;
  locked: boolean;
  isHole: boolean;
  materialPreset?: string;
  /** Índice en `groups` del grupo que lo contiene. */
  group?: number;
  /**
   * Origen [X, Z] de la placa que se restó al escribirlo (exportar por placa, lote P6): la posición guardada es
   * respecto de esa cama y al restaurar se le vuelve a sumar. Ausente = posición de mundo.
   */
  plateOffset?: [number, number];
  /** Índice en `plates` de su placa real (P7): al abrir el archivo en una escena vacía las placas vuelven como placas. */
  plate?: number;
  /** Huella de la malla escrita: si no calza al leer, el archivo fue editado por otro programa. */
  vertices: number;
  triangles: number;
}

/** Grupo de la escena; `parent` es un índice en `groups`. */
export interface KuraSceneGroupMeta {
  name: string;
  parent?: number;
  visible: boolean;
  locked: boolean;
  collapsed: boolean;
  /** Índices en `objects` de los miembros que ocultó / bloqueó el grupo. */
  hiddenByGroup?: number[];
  lockedByGroup?: number[];
}

/** Placa real de la escena (P7): nombre, centro de su cama [X, Z] en el mundo y cama propia si la tiene. */
export interface KuraScenePlateMeta {
  name: string;
  origin: [number, number];
  bed?: PlateBed;
}

export interface KuraSceneMeta {
  namespace: typeof KURA_SCENE_NAMESPACE;
  objects: KuraSceneObjectMeta[];
  groups: KuraSceneGroupMeta[];
  /** Placas reales (P7); ausente sin placas. */
  plates?: KuraScenePlateMeta[];
}

/** Placas de la escena para los metadatos: la lista y la placa (índice) de cada objeto por id. */
export interface KuraScenePlates {
  plates: readonly KuraScenePlateMeta[];
  plateOf: Readonly<Record<string, number>>;
}

/**
 * Metadatos de una escena: `objects[i]` se escribió como el `<object id=objectIds[i]>`. Los ids de
 * grupo y objeto de la escena se traducen a índices (los ids no viajan: al leer se crean nuevos).
 */
export function buildKuraSceneMeta(
  objects: readonly SceneObject[],
  objectIds: readonly string[],
  groups: readonly SceneGroup[],
  plateOffsets?: Readonly<Record<string, readonly [number, number]>>,
  scenePlates?: KuraScenePlates,
): KuraSceneMeta {
  const plateCount = scenePlates?.plates.length ?? 0;
  const plateIndex = (id: string) => {
    const i = scenePlates?.plateOf[id];
    return i !== undefined && Number.isInteger(i) && i >= 0 && i < plateCount ? i : undefined;
  };
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  const objectIndex = new Map(objects.map((o, i) => [o.id, i]));
  const indices = (ids?: string[]) => {
    const list = (ids ?? []).map((id) => objectIndex.get(id)).filter((i): i is number => i !== undefined);
    return list.length > 0 ? list : undefined;
  };
  return {
    namespace: KURA_SCENE_NAMESPACE,
    objects: objects.map((o, i) => ({
      objectId: objectIds[i],
      name: o.name,
      position: [...o.position],
      rotation: [...o.rotation],
      scale: [...o.scale],
      color: o.color,
      visible: o.visible,
      locked: o.locked,
      isHole: isNegative(o),
      ...(o.materialPreset ? { materialPreset: o.materialPreset } : {}),
      ...(o.groupRef !== undefined && groupIndex.has(o.groupRef) ? { group: groupIndex.get(o.groupRef) } : {}),
      ...(plateOffsets?.[o.id] ? { plateOffset: [plateOffsets[o.id][0], plateOffsets[o.id][1]] as [number, number] } : {}),
      ...(plateIndex(o.id) !== undefined ? { plate: plateIndex(o.id) } : {}),
      vertices: Math.floor(o.mesh.positions.length / 3),
      triangles: Math.floor(o.mesh.indices.length / 3),
    })),
    groups: groups.map((g) => ({
      name: g.name,
      ...(g.parentId !== undefined && groupIndex.has(g.parentId) ? { parent: groupIndex.get(g.parentId) } : {}),
      visible: g.visible,
      locked: g.locked,
      collapsed: g.collapsed,
      ...(indices(g.hiddenByGroup) ? { hiddenByGroup: indices(g.hiddenByGroup) } : {}),
      ...(indices(g.lockedByGroup) ? { lockedByGroup: indices(g.lockedByGroup) } : {}),
    })),
    ...(plateCount ? {
      plates: scenePlates!.plates.map((p) => ({ name: p.name, origin: [p.origin[0], p.origin[1]] as [number, number], ...(p.bed ? { bed: { ...p.bed } } : {}) })),
    } : {}),
  };
}

/** Placa leída: nombre acotado, origen finito dentro del límite de coordenadas y cama válida; null = inválida. */
function plateMetaOf(v: unknown): KuraScenePlateMeta | null {
  if (!isRecord(v)) return null;
  const name = typeof v.name === 'string' ? v.name.trim().slice(0, MAX_PLATE_NAME) : '';
  const o = v.origin;
  const originOk = Array.isArray(o) && o.length === 2 && o.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= TRANSFORM_LIMITS.maxAbsCoordinate);
  if (!name || !originOk) return null;
  let bed: PlateBed | undefined;
  if (v.bed !== undefined) {
    if (!isRecord(v.bed)) return null;
    const b = v.bed;
    const bedName = typeof b.name === 'string' ? b.name.trim().slice(0, MAX_PLATE_NAME) : '';
    const profileId = typeof b.profileId === 'string' && b.profileId.length > 0 && b.profileId.length <= 64 ? b.profileId : undefined;
    if (b.profileId !== undefined && !profileId) return null;
    const candidate: PlateBed = {
      ...(profileId ? { profileId } : {}), name: bedName,
      widthMm: b.widthMm as number, depthMm: b.depthMm as number, heightMm: b.heightMm as number,
      ...(b.marginMm !== undefined ? { marginMm: b.marginMm as number } : {}),
    };
    if (!bedName || !validPlateBed(candidate)) return null;
    bed = candidate;
  }
  return { name, origin: [o[0] as number, o[1] as number], ...(bed ? { bed } : {}) };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : null);
const finiteVec3 = (v: unknown): Vec3 | null =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [v[0], v[1], v[2]] : null;
/** Desplazamiento de placa: dos números finitos dentro del límite de coordenadas; cualquier otra cosa invalida. */
const plateOffsetOf = (v: unknown): [number, number] | null | undefined => {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length !== 2) return null;
  const ok = v.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= TRANSFORM_LIMITS.maxAbsCoordinate);
  return ok ? [v[0], v[1]] : null;
};
const count = (v: unknown): number | null => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
const indexIn = (v: unknown, size: number): number | undefined =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < size ? (v as number) : undefined;
const indexList = (v: unknown, size: number): number[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const list = v.slice(0, size).map((i) => indexIn(i, size)).filter((i): i is number => i !== undefined);
  return list.length > 0 ? list : undefined;
};

/**
 * Lee y valida los metadatos. Devuelve null si el texto excede el tope, no es del espacio de nombres
 * de Kurra Studio o trae datos inválidos (el archivo se importa entonces como 3MF normal).
 */
export function parseKuraSceneMeta(raw: string, maxObjects: number): KuraSceneMeta | null {
  if (raw.length > KURA_SCENE_MAX_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(json) || json.namespace !== KURA_SCENE_NAMESPACE) return null;
  if (!Array.isArray(json.objects) || !Array.isArray(json.groups)) return null;
  if (json.objects.length === 0 || json.objects.length > maxObjects || json.groups.length > MAX_META_GROUPS) return null;
  const groupCount = json.groups.length;
  const objectCount = json.objects.length;
  // Placas reales (P7): número acotado y cada una válida; cualquier fallo descarta los metadatos (como el resto).
  let plates: KuraScenePlateMeta[] | undefined;
  if (json.plates !== undefined) {
    if (!Array.isArray(json.plates) || json.plates.length > MAX_PLATES) return null;
    plates = [];
    for (const entry of json.plates) {
      const plate = plateMetaOf(entry);
      if (!plate) return null;
      plates.push(plate);
    }
  }
  const plateCount = plates?.length ?? 0;
  const objects: KuraSceneObjectMeta[] = [];
  const seenIds = new Set<string>();
  for (const entry of json.objects) {
    if (!isRecord(entry)) return null;
    const objectId = text(entry.objectId);
    const position = finiteVec3(entry.position);
    const rotation = finiteVec3(entry.rotation);
    const scale = finiteVec3(entry.scale);
    const vertices = count(entry.vertices);
    const triangles = count(entry.triangles);
    const plateOffset = plateOffsetOf(entry.plateOffset);
    if (!objectId || seenIds.has(objectId) || !position || !rotation || !scale || vertices === null || triangles === null) return null;
    if (plateOffset === null) return null;
    // Índice de placa: entero dentro de la lista; uno fuera de rango es un archivo manipulado.
    if (entry.plate !== undefined && indexIn(entry.plate, plateCount) === undefined) return null;
    const plate = indexIn(entry.plate, plateCount);
    if (scale.some((s) => s === 0)) return null;
    seenIds.add(objectId);
    const group = indexIn(entry.group, groupCount);
    const materialPreset = text(entry.materialPreset);
    objects.push({
      objectId,
      name: (text(entry.name) ?? '').slice(0, MAX_PART_NAME),
      position,
      rotation,
      scale,
      color: text(entry.color) ?? '',
      visible: entry.visible !== false,
      locked: entry.locked === true,
      isHole: entry.isHole === true,
      ...(materialPreset ? { materialPreset } : {}),
      ...(group !== undefined ? { group } : {}),
      ...(plateOffset ? { plateOffset } : {}),
      ...(plate !== undefined ? { plate } : {}),
      vertices,
      triangles,
    });
  }
  const groups: KuraSceneGroupMeta[] = [];
  for (const entry of json.groups) {
    if (!isRecord(entry)) return null;
    const parent = indexIn(entry.parent, groupCount);
    groups.push({
      name: text(entry.name) ?? '',
      ...(parent !== undefined ? { parent } : {}),
      visible: entry.visible !== false,
      locked: entry.locked === true,
      collapsed: entry.collapsed === true,
      ...(indexList(entry.hiddenByGroup, objectCount) ? { hiddenByGroup: indexList(entry.hiddenByGroup, objectCount) } : {}),
      ...(indexList(entry.lockedByGroup, objectCount) ? { lockedByGroup: indexList(entry.lockedByGroup, objectCount) } : {}),
    });
  }
  // Un ciclo de padres (archivo manipulado) invalida el árbol: se descarta el parentesco en el ciclo.
  for (let i = 0; i < groups.length; i++) {
    let cursor = groups[i].parent;
    let steps = 0;
    while (cursor !== undefined && steps <= groups.length) {
      if (cursor === i) {
        delete groups[i].parent;
        break;
      }
      cursor = groups[cursor].parent;
      steps++;
    }
  }
  return { namespace: KURA_SCENE_NAMESPACE, objects, groups, ...(plates?.length ? { plates } : {}) };
}
