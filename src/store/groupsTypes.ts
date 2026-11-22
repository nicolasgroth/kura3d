/**
 * @file src/store/groupsTypes.ts
 * @description Tipos del slice de organización: grupos (agrupar, desagrupar, entrar y salir, ojo y
 * candado, árbol), transformación del conjunto como cuerpo rígido y combinar/separar cuerpos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { RigidDelta } from '../core/scene/groupTransform';
import type { TreeKey } from '../core/scene/groups';
import type { SceneGroup, SceneObject, Vec3 } from '../types/kura';

export interface GroupsSliceState {
  /** Grupos de organización de la escena (ver `core/scene/groups.ts`). */
  groups: SceneGroup[];
  /** Grupo en el que se "entró" (doble clic o Enter): un clic elige a sus hijos. null = raíz. */
  groupContextId: string | null;
  /** Último objeto elegido con clic (para entrar a su grupo con doble clic o Enter). */
  lastPickedId: string | null;
  /** Agrupa la selección (o `ids`); devuelve el grupo nuevo o null. Un paso de deshacer. */
  groupObjects: (ids?: string[], name?: string) => SceneGroup | null;
  /** Desagrupa `groupId` (o el grupo seleccionado / los grupos inmediatos de la selección). */
  ungroupObjects: (groupId?: string) => number;
  /** Combina la selección (o `ids`) en un objeto con varios cuerpos, sin booleanas. */
  combineObjects: (ids?: string[], name?: string) => SceneObject | null;
  /** Separa los cuerpos de un objeto en objetos (reutiliza la separación de piezas sueltas). */
  separateBodies: (id?: string) => Promise<SceneObject[]>;
  renameGroup: (groupId: string, name: string) => void;
  /** Ojo o candado de un grupo: se aplica a todos sus miembros. Un paso de deshacer. */
  setGroupFlag: (groupId: string, flag: 'visible' | 'locked', value: boolean) => void;
  /** Plegar/desplegar en el árbol (solo presentación, sin paso de deshacer). */
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  /** Árbol: mover un nodo dentro de un grupo (null = raíz), antes de `beforeKey`. */
  moveSceneNode: (key: TreeKey, parentId: string | null, beforeKey?: TreeKey | null) => boolean;
  reorderSceneNode: (key: TreeKey, direction: -1 | 1) => boolean;
  indentSceneNode: (key: TreeKey) => boolean;
  outdentSceneNode: (key: TreeKey) => boolean;
  /** Entra un nivel hacia `objectId` (o hacia el último objeto elegido). */
  enterGroup: (objectId?: string) => boolean;
  /** Sale un nivel; devuelve false si ya estaba en la raíz. */
  exitGroup: () => boolean;
  /** Selecciona todos los objetos de un grupo. */
  selectGroup: (groupId: string) => void;
  /**
   * Transforma la selección como cuerpo rígido respecto del centro de su caja (o `pivot`). Con
   * `baseline` (arrastre del manipulador) parte de esas transformaciones y no del estado actual.
   */
  transformSelectionRigid: (
    delta: RigidDelta,
    options?: { recordHistory?: boolean; pivot?: Vec3; baseline?: Array<Pick<SceneObject, 'id' | 'position' | 'rotation' | 'scale'>> },
  ) => boolean;
}
