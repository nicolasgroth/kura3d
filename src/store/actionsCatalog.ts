/**
 * @file src/store/actionsCatalog.ts
 * @description Catálogo del menú «Acciones»: operaciones que no son herramientas de puntero (ahuecar, dividir,
 * reparar, separar, alinear…), agrupadas, con su atajo y la regla de disponibilidad sobre el estado (sin
 * selección, bloqueada, tipo no válido…) que da el motivo de un ítem deshabilitado. Es el inventario real del
 * menú contextual, la paleta y el inspector; elegir una acción hace lo mismo que su entrada actual
 * (`components/shell/actionRunners.ts`) y deja `activeAction` en el store para el panel contextual.
 * Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { selectedGroup } from '../core/scene/groups';
import { cachedMeshBodies } from '../core/scene/meshBodies';
import { isNegative, isSolid } from '../core/scene/objectRole';
import { plateToolBlockReason } from '../core/scene/viewMode';
import { fitCheckTargets } from './fitCheckTargets';
import type { TranslationKey } from '../i18n';
import type { KuraStoreState } from './storeTypes';

export const ACTION_GROUPS = [
  { id: 'prepare', items: ['hollow', 'splitForBed', 'fitToBed', 'orient', 'mold', 'project', 'modules'] },
  { id: 'mesh', items: ['repair', 'simplify', 'refine', 'smooth', 'texture', 'hull'] },
  { id: 'organize', items: ['splitColors', 'splitParts', 'group', 'ungroup', 'combine', 'union', 'applyHoles'] },
  { id: 'position', items: ['convert', 'dropToBed', 'centerOnBed', 'align'] },
  { id: 'analyze', items: ['validate', 'detect', 'fitCheck'] },
] as const;

export type ActionGroupId = (typeof ACTION_GROUPS)[number]['id'];
export type ActionId = (typeof ACTION_GROUPS)[number]['items'][number];

/** Atajo de cada acción (el mismo que ya existe en el menú contextual, la paleta o el teclado global). */
export const ACTION_SHORTCUTS: Partial<Record<ActionId, { label: string; keys: string }>> = {
  splitForBed: { label: 'Shift+C', keys: 'Shift+C' },
  mold: { label: 'Shift+M', keys: 'Shift+M' },
  group: { label: 'Ctrl+G', keys: 'Control+G' },
  ungroup: { label: 'Ctrl+Shift+G', keys: 'Control+Shift+G' },
  applyHoles: { label: 'Ctrl+Shift+U', keys: 'Control+Shift+U' },
  dropToBed: { label: 'L', keys: 'L' },
};

export interface ActionAvailability {
  enabled: boolean;
  /** Motivo cuando está deshabilitada. */
  reason?: TranslationKey;
}

type StateSlice = Pick<KuraStoreState, 'objects' | 'selectedIds' | 'groups' | 'busyOperation'> & { layout?: KuraStoreState['layout'] };

/** Acciones de cama: solo en la vista Imprimir (en Armado y Libre se deshabilitan con ese motivo). */
const PLATE_TOOL_ACTIONS = new Set<ActionId>(['fitToBed', 'dropToBed', 'centerOnBed']);

const ok: ActionAvailability = { enabled: true };
const no = (reason: TranslationKey): ActionAvailability => ({ enabled: false, reason });

/** Acciones asíncronas del motor: no se ofrecen mientras corre otra. */
const ENGINE_ACTIONS = new Set<ActionId>(['repair', 'simplify', 'refine', 'smooth', 'hull', 'splitColors', 'splitParts', 'combine', 'union', 'applyHoles', 'validate', 'detect']);

/** Si la acción se puede usar ahora y, si no, por qué. */
export function actionAvailability(state: StateSlice, id: ActionId): ActionAvailability {
  const { objects, selectedIds, groups, busyOperation } = state;
  const picked = objects.filter((o) => selectedIds.includes(o.id));
  const primary = picked[0];
  const anyLocked = picked.some((o) => o.locked);
  if (busyOperation && ENGINE_ACTIONS.has(id)) return no('rediseno.reason.busy');
  const printOnly = plateToolBlockReason(state.layout);
  if (printOnly && PLATE_TOOL_ACTIONS.has(id)) return no(printOnly);
  if (id === 'mold') return objects.length > 0 ? ok : no('rediseno.reason.empty');
  if (id === 'applyHoles') {
    const visible = objects.filter((o) => o.visible);
    return visible.some(isNegative) && visible.some(isSolid) ? ok : no('rediseno.reason.noSubtractions');
  }
  if (id === 'fitCheck') return fitCheckTargets(objects, selectedIds).ids.length >= 2 ? ok : no('fitCheck.ui.reason.needTwo');
  if (!primary) return no('rediseno.reason.noSelection');
  switch (id) {
    case 'group':
    case 'combine':
      if (picked.length < 2) return no('rediseno.reason.needTwo');
      return anyLocked ? no('rediseno.reason.locked') : ok;
    case 'union':
    case 'align':
      return picked.length < 2 ? no('rediseno.reason.needTwo') : ok;
    case 'ungroup': {
      const inGroup = Boolean(selectedGroup(objects, groups, selectedIds)) || picked.some((o) => o.groupRef);
      if (!inGroup) return no('rediseno.reason.notGrouped');
      return anyLocked ? no('rediseno.reason.locked') : ok;
    }
    case 'splitParts':
      if (primary.locked) return no('rediseno.reason.locked');
      return cachedMeshBodies(primary.mesh) === 1 ? no('rediseno.reason.singleBody') : ok;
    case 'orient':
      if (picked.length > 1) return no('orient.ui.reason.needOne');
      if (!isSolid(primary)) return no('orient.ui.reason.notSolid');
      return primary.locked ? no('rediseno.reason.locked') : ok;
    case 'validate':
    case 'detect':
    case 'splitForBed':
    case 'fitToBed':
      return ok;
    default:
      return primary.locked ? no('rediseno.reason.locked') : ok;
  }
}

/**
 * Acciones con opciones propias en el panel derecho contextual (el resto se ejecuta directo o abre su propio
 * panel de operación). Punto de extensión: una acción nueva que necesite opciones se agrega aquí y registra su
 * contenido en `components/contextPanel/panelRegistry.tsx`. Operan sobre un objeto seleccionado, salvo las de
 * `SCENE_PANEL_ACTIONS`.
 */
export const PANEL_ACTIONS: ReadonlySet<ActionId> = new Set<ActionId>(['hollow', 'simplify', 'refine', 'smooth', 'texture', 'modules', 'validate', 'detect', 'fitCheck', 'orient']);

/** Acciones del panel que trabajan sobre la escena (varios objetos o todo lo visible), no sobre uno solo. */
export const SCENE_PANEL_ACTIONS: ReadonlySet<ActionId> = new Set<ActionId>(['fitCheck']);

export function actionHasPanel(id: ActionId): boolean {
  return PANEL_ACTIONS.has(id);
}

/** Acción o herramienta activa: el único lugar que dice qué opciones debe mostrar el panel contextual. */
export type ActiveContext = { kind: 'action'; id: ActionId } | { kind: 'tool'; id: KuraStoreState['activeTool'] };

export function activeContextOf(state: Pick<KuraStoreState, 'activeAction' | 'activeTool'>): ActiveContext {
  return state.activeAction ? { kind: 'action', id: state.activeAction } : { kind: 'tool', id: state.activeTool };
}
