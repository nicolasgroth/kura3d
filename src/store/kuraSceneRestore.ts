/**
 * @file src/store/kuraSceneRestore.ts
 * @description Restauración de una escena exportada por Kurra Studio a 3MF (`ImportedModel.kuraScene`):
 * objetos con su transformación, nombre, color, visibilidad, bloqueo y hueco exactos, y el árbol de
 * grupos (anidados, plegado, visible, bloqueado) con ids nuevos. Sin reacomodo ni conjuntos; si la
 * escena actual ya tiene objetos, el bloque entero se desplaza a un hueco libre (opcional).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../engine';
import { MAX_GROUP_NAME } from '../core/scene/groups';
import { makeId } from '../core/scene/sceneObjects';
import type { MaterialPresetId, MeshData, ObjectRole, SceneGroup, SceneObject, Vec3 } from '../types/kura';
import { roleFromLegacy } from '../core/scene/objectRole';
import type { ScenePlate } from '../types/plates';

/** Constructor de objetos del store (calcula estadísticas). */
export type RestoreBuild = (params: {
  name: string;
  mesh: MeshData;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  role?: ObjectRole;
  stats?: SceneObject['stats'];
}) => SceneObject;

export interface RestoredScene {
  objects: SceneObject[];
  groups: SceneGroup[];
  /** Placas reales (P7), solo si se pidieron (`withPlates`) y el archivo las trae; ids nuevos. */
  plates: ScenePlate[];
}

/** true si el modelo es una escena de Kurra Studio que se restaura tal cual. */
export function isKuraScene(model: engine.ImportedModel): boolean {
  return model.kuraScene !== undefined && model.parts.every((p) => p.kura !== undefined);
}

/**
 * Posición de mundo de un objeto guardado: la escrita más el origen de placa que se le restó al exportar por placa
 * (cada pieza vuelve a su lugar de mundo; las placas reales se restauran aparte, ver `restoreKuraScene`).
 */
export function kuraWorldPosition(k: { position: Vec3; plateOffset?: [number, number] }): Vec3 {
  const off = k.plateOffset;
  return off ? [k.position[0] + off[0], k.position[1], k.position[2] + off[1]] : [k.position[0], k.position[1], k.position[2]];
}

/**
 * Objetos y grupos de la escena guardada, con ids nuevos y el desplazamiento `offset` aplicado. Con `withPlates` (abrir
 * en una escena vacía, sin desplazamiento) también sus placas reales con su cama, y cada sólido en la suya (P7).
 */
export function restoreKuraScene(
  model: engine.ImportedModel, build: RestoreBuild, offset: Vec3 = [0, 0, 0], asReference = false, withPlates = false,
): RestoredScene {
  const metaGroups = model.kuraScene?.groups ?? [];
  const groupIds = metaGroups.map(() => makeId('grp'));
  const metaPlates = withPlates && !asReference ? model.kuraScene?.plates ?? [] : [];
  const plates: ScenePlate[] = metaPlates.map((p) => ({ id: makeId('plate'), name: p.name, origin: [p.origin[0], p.origin[1]], ...(p.bed ? { bed: { ...p.bed } } : {}) }));
  const objects = model.parts.map((part) => {
    const k = part.kura!;
    const world = kuraWorldPosition(k);
    const built = build({
      name: k.name || part.name,
      mesh: part.mesh,
      position: [world[0] + offset[0], world[1] + offset[1], world[2] + offset[2]],
      rotation: [...k.rotation],
      scale: [...k.scale],
      color: k.color || part.color || '',
      role: asReference ? 'reference' : roleFromLegacy(k.isHole),
      stats: part.analysis?.stats,
    });
    return {
      ...built,
      visible: k.visible,
      locked: k.locked,
      ...(k.materialPreset ? { materialPreset: k.materialPreset as MaterialPresetId } : {}),
      ...(k.group !== undefined ? { groupRef: groupIds[k.group] } : {}),
      ...(k.plate !== undefined && plates[k.plate] ? { plateRef: plates[k.plate].id } : {}),
    };
  });
  const idsOf = (indices?: number[]) => {
    const ids = (indices ?? []).map((i) => objects[i]?.id).filter((id): id is string => id !== undefined);
    return ids.length > 0 ? ids : undefined;
  };
  const groups = metaGroups.map((g, i): SceneGroup => {
    const hiddenByGroup = idsOf(g.hiddenByGroup);
    const lockedByGroup = idsOf(g.lockedByGroup);
    return {
      id: groupIds[i],
      name: g.name.slice(0, MAX_GROUP_NAME),
      ...(g.parent !== undefined ? { parentId: groupIds[g.parent] } : {}),
      visible: g.visible,
      locked: g.locked,
      collapsed: g.collapsed,
      ...(hiddenByGroup ? { hiddenByGroup } : {}),
      ...(lockedByGroup ? { lockedByGroup } : {}),
    };
  });
  return { objects, groups, plates };
}
