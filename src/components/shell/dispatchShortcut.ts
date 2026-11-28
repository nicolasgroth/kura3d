/**
 * @file src/components/shell/dispatchShortcut.ts
 * @description Ejecuta la acción que `resolveShortcut` (store/keyboardShortcuts) devolvió para una tecla: llama al
 * store o a las herramientas de la barra. Aquí no hay reglas de teclado ni lógica de dominio; solo el despacho.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { TransformMode } from '../../types/kura';
import type { ShortcutAction, ShortcutContext } from '../../store/keyboardShortcuts';
import { activateRailTool, toggleRailTool } from '../../store/toolActivation';
import { useKuraStore } from '../../store/useKuraStore';
import { cycleViewMode } from '../../store/viewModeRequest';
import { guardUnsavedChanges } from '../../utils/unsavedGuard';
import { confirmDeleteSelection } from '../scene/confirmDeleteSelection';

/** Lo que el despacho necesita de la interfaz (estado local de `App`). */
export interface ShortcutUi {
  /** Abre la hoja del inspector derecho en pantallas angostas. */
  revealRightSheet: () => void;
  /** Pide al inspector enfocar la edición numérica del modo de transformación. */
  requestPrecision: (mode: TransformMode) => void;
}

/** Contexto de teclado desde el store y el DOM (lo único que `App` calcula). */
export function readShortcutContext(target: EventTarget | null): ShortcutContext {
  const state = useKuraStore.getState();
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return {
    dialogOpen: state.activeDialog !== null,
    commandPaletteOpen: state.commandPaletteOpen,
    modalOpen: typeof document !== 'undefined' && document.querySelector('dialog[open]:modal') !== null,
    typingTarget: tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el?.isContentEditable),
    controlTarget: Boolean(el?.closest?.('button, a[href], summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"]')),
    zen: state.uiDensity === 'zen',
    inGroup: Boolean(state.groupContextId),
    hasGroups: state.groups.length > 0,
    selectedCount: state.selectedIds.length,
    objectCount: state.objects.length,
  };
}

const NUDGE_DIRECTION = {
  left: [-1, 0, 0],
  right: [1, 0, 0],
  up: [0, 0, -1],
  down: [0, 0, 1],
  pageUp: [0, 1, 0],
  pageDown: [0, -1, 0],
} as const;

const NUDGE_SCALE = { fine: 0.2, normal: 1, coarse: 10 } as const;

/**
 * Ejecuta `action`. Devuelve `true` si el navegador debe dejar de actuar aun cuando la resolución no lo pidió (solo
 * Enter al entrar a un grupo).
 */
export function dispatchShortcut(action: ShortcutAction, e: KeyboardEvent, ui: ShortcutUi): boolean {
  const state = useKuraStore.getState();
  switch (action.type) {
    case 'save': {
      const field = e.target;
      if (field instanceof HTMLInputElement && field.hasAttribute('data-commit-on-blur')) field.blur();
      void state.saveProject(action.saveAs);
      return false;
    }
    case 'open':
      void guardUnsavedChanges(() => state.openProject());
      return false;
    case 'new':
      void guardUnsavedChanges(() => state.newProject());
      return false;
    case 'togglePalette':
      state.setCommandPaletteOpen(!state.commandPaletteOpen);
      return false;
    case 'openSettings':
      state.openSettings('appearance');
      return false;
    case 'toggleZen':
      state.toggleZenMode();
      return false;
    case 'exitGroup':
      state.exitGroup();
      return false;
    case 'enterGroup':
      return state.enterGroup();
    case 'undo':
      state.undo();
      return false;
    case 'redo':
      state.redo();
      return false;
    case 'duplicate':
      state.duplicateObjects();
      return false;
    case 'group':
      state.groupObjects();
      return false;
    case 'ungroup':
      state.ungroupObjects();
      return false;
    case 'applyHolesOrUnion':
      void state.applyHolesOrUnion();
      return false;
    case 'selectAll':
      state.selectAll();
      return false;
    case 'nudge': {
      // Sin selección, la tecla toma el único objeto de la escena.
      if (state.selectedIds.length === 0 && state.objects.length === 1) state.selectObject(state.objects[0].id, false);
      const step = (state.snapGridMm > 0 ? state.snapGridMm : 1) * NUDGE_SCALE[action.scale];
      const [dx, dy, dz] = NUDGE_DIRECTION[action.key];
      state.nudgeSelectedObjects([dx * step, dy * step, dz * step]);
      return false;
    }
    case 'showShortcuts':
      state.setActiveDialog('shortcuts');
      return false;
    case 'transformTool': {
      // Misma regla que la barra: sin selección toma los objetos visibles sin candado; escena vacía: avisa.
      const applied = activateRailTool(action.mode === 'translate' ? 'move' : action.mode);
      if (!applied.enabled) return false;
      if (action.opensInspector && useKuraStore.getState().selectedIds.length === 1) {
        const narrow = window.matchMedia('(max-width: 900px)').matches;
        if (state.uiDensity === 'zen') state.toggleZenMode();
        if (state.aiDrawerOpen && window.matchMedia('(max-width: 1240px)').matches) state.setAiDrawerOpen(false);
        if (narrow) ui.revealRightSheet();
        else if (state.rightCollapsed) state.toggleRightInspector();
        ui.requestPrecision(action.mode);
      }
      return false;
    }
    case 'cameraPreset':
      state.requestCameraPreset(action.preset);
      return false;
    case 'selectTool':
      activateRailTool('select');
      return false;
    case 'toggleSelectionVisibility':
      // Oculta la selección o la vuelve a mostrar; sin selección, muestra todo lo oculto.
      state.toggleSelectionVisibility();
      return false;
    case 'toggleRole':
      state.toggleSelectionRole();
      return false;
    case 'openDialog':
      state.setActiveDialog(action.dialog);
      return false;
    case 'toggleBed':
      state.toggleShowBed();
      return false;
    case 'cycleViewMode':
      cycleViewMode();
      return false;
    case 'toggleSection':
      state.setSectionPlane({ enabled: !state.sectionPlane.enabled });
      return false;
    case 'togglePaint':
      toggleRailTool('paint');
      return false;
    case 'toggleMeasure':
      toggleRailTool('measure');
      return false;
    case 'dropToBed':
      state.dropObjectsToBed(state.selectedIds);
      return false;
    case 'deleteSelection':
      void confirmDeleteSelection();
      return false;
  }
}
