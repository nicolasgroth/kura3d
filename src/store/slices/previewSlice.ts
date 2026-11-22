/**
 * @file src/store/slices/previewSlice.ts
 * @description Estado de interfaz de la vista previa de operaciones (`operationPreview`): mallas
 * fantasma y guías que el visor dibuja translúcidas, sin pasar por el historial ni la escena. La
 * vista previa se calcula en el mismo Worker del motor, con debounce y descartando resultados
 * obsoletos; mientras calcula conserva el resultado anterior (el visor lo atenúa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneChange } from '../../core/operations';
import type { EngineTaskArgs, EngineTaskName } from '../../core/operations/engineTasks';
import { resolveBooleanInputs } from '../../core/scene/sceneRules';
import type { BooleanOpType, MeshData, SceneObject, Vec3 } from '../../types/kura';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/** Papel de una malla fantasma: resultado, o base/herramienta de una resta. */
export type PreviewRole = 'result' | 'base' | 'tool';

export interface PreviewGhost {
  id: string;
  mesh: MeshData;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  role: PreviewRole;
}

/** Marcador o rótulo en el visor (posición de mundo). `labelKey` es una clave i18n. */
export interface PreviewGuide {
  id: string;
  position: Vec3;
  role: PreviewRole;
  labelKey?: string;
}

export type PreviewStatus = 'idle' | 'pending' | 'ready' | 'error';

export interface OperationPreviewState {
  /** Dueño de la vista previa (p. ej. `boolean:subtract`, `project`); null si no hay. */
  key: string | null;
  status: PreviewStatus;
  ghosts: PreviewGhost[];
  guides: PreviewGuide[];
}

export interface PreviewRequest<N extends EngineTaskName = EngineTaskName> {
  key: string;
  task: N;
  args: EngineTaskArgs<N>;
  /** Papel de las mallas resultantes (por defecto `result`). */
  role?: PreviewRole;
  /** Guías que acompañan al resultado (se muestran al instante). */
  guides?: PreviewGuide[];
  /** Mallas fijas que acompañan al resultado (p. ej. la herramienta de una resta). */
  extras?: PreviewGhost[];
  /** Debounce en ms (por defecto `PREVIEW_DEBOUNCE_MS`). */
  delayMs?: number;
}

export interface PreviewSliceState {
  operationPreview: OperationPreviewState;
  /** Pide (o reemplaza) la vista previa: debounce, cálculo en el Worker y descarte de obsoletos. */
  requestOperationPreview: <N extends EngineTaskName>(request: PreviewRequest<N>) => void;
  /** Fija guías sin cálculo (p. ej. rótulos base/herramienta). */
  setOperationPreviewGuides: (key: string, guides: PreviewGuide[]) => void;
  /** Limpia la vista previa; con `key`, solo si le pertenece. */
  clearOperationPreview: (key?: string) => void;
  /** Vista previa de una booleana sobre la selección (base = 1.ª, herramienta = 2.ª). */
  previewBooleanOnSelection: (op: BooleanOpType) => void;
  /** Intercambia base y herramienta (las dos primeras de la selección) y rehace la vista previa. */
  swapBooleanRoles: () => void;
  /** Vista de sección temporal activada para mostrar el interior (p. ej. tras ahuecar). */
  temporarySectionView: { objectId: string; previous: { enabled: boolean; heightMm: number } } | null;
  /** Activa un corte de sección a media altura de la pieza (recuerda el estado anterior). */
  showInteriorSection: (objectId: string) => void;
  /** Sale de la vista de sección temporal y restaura el estado anterior. */
  exitInteriorSection: () => void;
}

export const PREVIEW_DEBOUNCE_MS = 250;

export const EMPTY_PREVIEW: OperationPreviewState = { key: null, status: 'idle', ghosts: [], guides: [] };

/** Extrae el `SceneChange` del resultado de una tarea (`{ change }` o el cambio directo). */
function changeOf(result: unknown): SceneChange | null {
  if (!result || typeof result !== 'object') return null;
  const rec = result as Record<string, unknown>;
  if (rec.change && typeof rec.change === 'object') return rec.change as SceneChange;
  if (Array.isArray(rec.added) && Array.isArray(rec.patches)) return rec as unknown as SceneChange;
  // Tareas que crean un objeto suelto (p. ej. rosca).
  if ('id' in rec && 'mesh' in rec) return { added: [rec as unknown as SceneObject], removedIds: [], patches: [], warnings: [] };
  return null;
}

/** Mallas fantasma de un cambio: objetos agregados y objetos existentes con malla parchada. */
export function ghostsFromChange(change: SceneChange, objects: SceneObject[], role: PreviewRole = 'result'): PreviewGhost[] {
  const ghost = (o: Pick<SceneObject, 'id' | 'mesh' | 'position' | 'rotation' | 'scale'>): PreviewGhost => ({
    id: o.id,
    mesh: o.mesh,
    position: o.position,
    rotation: o.rotation,
    scale: o.scale,
    role,
  });
  const patched = change.patches
    .filter((p) => p.patch.mesh)
    .map((p) => {
      const base = objects.find((o) => o.id === p.id);
      return base ? ghost({ ...base, ...p.patch }) : null;
    })
    .filter((g): g is PreviewGhost => g !== null);
  return [...patched, ...change.added.map(ghost)];
}

export function createPreviewSlice(ctx: StoreContext): PreviewSliceState {
  const { set, get, runEngineDetached } = ctx;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const patch = (p: Partial<OperationPreviewState>) => set({ operationPreview: { ...get().operationPreview, ...p } });

  return {
    operationPreview: EMPTY_PREVIEW,

    requestOperationPreview: (request) => {
      stopTimer();
      const gen = ++generation;
      const current = get().operationPreview;
      // Conserva el resultado anterior del mismo dueño mientras calcula (el visor lo atenúa).
      set({
        operationPreview: {
          key: request.key,
          status: 'pending',
          ghosts: current.key === request.key ? current.ghosts : (request.extras ?? []),
          guides: request.guides ?? (current.key === request.key ? current.guides : []),
        },
      });
      const extras = request.extras ?? [];
      timer = setTimeout(() => {
        timer = null;
        if (gen !== generation) return;
        runEngineDetached(request.task, request.args).then(
          (result) => {
            if (gen !== generation) return; // obsoleto: llegó otra petición o se limpió
            const change = changeOf(result);
            const computed = change ? ghostsFromChange(change, get().objects, request.role) : [];
            patch({ status: 'ready', ghosts: [...extras, ...computed] });
          },
          () => {
            if (gen !== generation) return;
            patch({ status: 'error', ghosts: extras });
          },
        );
      }, request.delayMs ?? PREVIEW_DEBOUNCE_MS);
    },

    setOperationPreviewGuides: (key, guides) => {
      const current = get().operationPreview;
      set({ operationPreview: current.key === key ? { ...current, guides } : { ...EMPTY_PREVIEW, key, guides } });
    },

    clearOperationPreview: (key) => {
      if (key !== undefined && get().operationPreview.key !== key) return;
      stopTimer();
      generation++;
      if (get().operationPreview !== EMPTY_PREVIEW) set({ operationPreview: EMPTY_PREVIEW });
    },

    previewBooleanOnSelection: (op) => {
      const { objects, selectedIds } = get();
      const inputs = resolveBooleanInputs(objects, selectedIds);
      if (!inputs) return;
      const tools = [inputs.tool, ...inputs.extras];
      const subtract = op === 'subtract';
      get().requestOperationPreview({
        key: `boolean:${op}`,
        task: 'boolean',
        args: { target: inputs.target, tools, op, keepTools: true },
        extras: subtract ? tools.map((o) => ({ ...ghostOf(o), role: 'tool' as const })) : [],
        guides: subtract
          ? [
              { id: 'base', position: labelAnchor(inputs.target), role: 'base', labelKey: 'boolPreview.base' },
              ...tools.map((o) => ({ id: `tool:${o.id}`, position: labelAnchor(o), role: 'tool' as const, labelKey: 'boolPreview.tool' })),
            ]
          : [],
      });
    },

    swapBooleanRoles: () => {
      const { selectedIds, operationPreview } = get();
      if (selectedIds.length < 2) return;
      const key = operationPreview.key;
      set({ selectedIds: [selectedIds[1], selectedIds[0], ...selectedIds.slice(2)] });
      if (key?.startsWith('boolean:')) get().previewBooleanOnSelection(key.slice('boolean:'.length) as BooleanOpType);
    },

    temporarySectionView: null,

    showInteriorSection: (objectId) => {
      const obj = get().objects.find((o) => o.id === objectId);
      if (!obj) return;
      const previous = get().temporarySectionView?.previous ?? { ...get().sectionPlane };
      const h = (obj.stats?.dimensionsMm?.[1] ?? 0) * (obj.scale?.[1] ?? 1);
      get().setSectionPlane({ enabled: true, heightMm: Math.round((obj.position[1] + h / 2) * 10) / 10 });
      set({ temporarySectionView: { objectId, previous } });
    },

    exitInteriorSection: () => {
      const view = get().temporarySectionView;
      if (!view) return;
      get().setSectionPlane(view.previous);
      set({ temporarySectionView: null });
    },
  };
}

function ghostOf(o: SceneObject): PreviewGhost {
  return { id: o.id, mesh: o.mesh, position: o.position, rotation: o.rotation, scale: o.scale, role: 'result' };
}

/** Punto sobre la pieza donde va su rótulo (encima de su caja). */
function labelAnchor(o: SceneObject): Vec3 {
  const h = (o.stats?.dimensionsMm?.[1] ?? 10) * (o.scale?.[1] ?? 1);
  return [o.position[0], o.position[1] + h + 4, o.position[2]];
}

/** Limpia la vista previa cuando cambia la selección (se llama al componer el store). */
export function clearPreviewOnSelectionChange(store: {
  subscribe: (listener: (state: KuraStoreState, prev: KuraStoreState) => void) => () => void;
}): () => void {
  return store.subscribe((state, prev) => {
    if (state.selectedIds !== prev.selectedIds && state.operationPreview.key !== null) state.clearOperationPreview();
  });
}
