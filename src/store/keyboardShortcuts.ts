/**
 * @file src/store/keyboardShortcuts.ts
 * @description Tabla de atajos de teclado globales del estudio y función pura `resolveShortcut(evento, contexto)`:
 * devuelve qué acción pide la tecla y si se debe anular el carácter (preventDefault). No toca el store ni el DOM:
 * `App.tsx` solo calcula el contexto y despacha la acción (ver `components/shell/dispatchShortcut.ts`). El orden de
 * las reglas es el del manejador original: guardar/abrir/nuevo, campo de texto, diálogo modal, paleta, ajustes,
 * Zen, grupos, deshacer, grupos, selección, flechas y por último las teclas sueltas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { TransformMode } from '../types/kura';
import { SINGLE_KEY_SHORTCUTS } from './singleKeyShortcuts';

/** Lo mínimo que el resolvedor lee de un KeyboardEvent. */
export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
}

/** Estado de la aplicación que cambia la lectura de una tecla. */
export interface ShortcutContext {
  /** Hay un diálogo de la aplicación abierto (`activeDialog !== null`). */
  dialogOpen: boolean;
  commandPaletteOpen: boolean;
  /** Hay un `<dialog>` modal nativo abierto. */
  modalOpen: boolean;
  /** El foco está en un campo de texto (input, textarea, select o contenteditable). */
  typingTarget: boolean;
  zen: boolean;
  /** Se entró a un grupo (Escape sale). */
  inGroup: boolean;
  hasGroups: boolean;
  selectedCount: number;
  objectCount: number;
}

export type NudgeKey = 'left' | 'right' | 'up' | 'down' | 'pageUp' | 'pageDown';
export type CameraPresetKey = 'front' | 'right' | 'iso' | 'top' | 'fit';

export type ShortcutAction =
  | { type: 'save'; saveAs: boolean }
  | { type: 'open' }
  | { type: 'new' }
  | { type: 'togglePalette' }
  | { type: 'openSettings' }
  | { type: 'toggleZen' }
  | { type: 'exitGroup' }
  /** Enter entra al grupo elegido; solo anula el carácter si de verdad entró (lo decide el store). */
  | { type: 'enterGroup' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'duplicate' }
  | { type: 'group' }
  | { type: 'ungroup' }
  | { type: 'applyHolesOrUnion' }
  | { type: 'selectAll' }
  | { type: 'nudge'; key: NudgeKey; scale: 'fine' | 'normal' | 'coarse' }
  | { type: 'showShortcuts' }
  | { type: 'transformTool'; mode: TransformMode; opensInspector: boolean }
  | { type: 'cameraPreset'; preset: CameraPresetKey }
  | { type: 'selectTool' }
  | { type: 'toggleSelectionVisibility' }
  | { type: 'toggleRole' }
  | { type: 'openDialog'; dialog: 'mold' | 'splitForBed' | 'cut' }
  | { type: 'toggleBed' }
  | { type: 'cycleViewMode' }
  | { type: 'toggleSection' }
  | { type: 'togglePaint' }
  | { type: 'toggleMeasure' }
  | { type: 'dropToBed' }
  | { type: 'deleteSelection' };

export interface ShortcutResolution {
  action: ShortcutAction | null;
  /** Anular el carácter / la acción del navegador. */
  preventDefault: boolean;
}

const NONE: ShortcutResolution = { action: null, preventDefault: false };
const act = (action: ShortcutAction): ShortcutResolution => ({ action, preventDefault: true });
/** El navegador no debe actuar, pero no hay nada que hacer (por ejemplo una repetición de tecla). */
const SWALLOW: ShortcutResolution = { action: null, preventDefault: true };

/** Teclas de transformación: la tecla → modo. */
export const TRANSFORM_SHORTCUTS: ReadonlyMap<string, TransformMode> = new Map<string, TransformMode>([
  ['m', 'translate'],
  ['g', 'translate'],
  ['w', 'translate'],
  ['r', 'rotate'],
  ['s', 'scale'],
]);

/** Teclas de una letra o número → vista de cámara. */
const CAMERA_KEYS: Readonly<Record<string, CameraPresetKey>> = { '1': 'front', '2': 'right', '3': 'iso', '7': 'top', f: 'fit' };

const NUDGE_KEYS: Readonly<Record<string, NudgeKey>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  PageUp: 'pageUp',
  PageDown: 'pageDown',
};

/**
 * Traduce una pulsación en la acción que pide. Pura: mismo evento y contexto, misma respuesta. `action: null` con
 * `preventDefault: false` significa «no es un atajo nuestro».
 */
export function resolveShortcut(e: ShortcutEvent, ctx: ShortcutContext): ShortcutResolution {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && !e.altKey && (key === 's' || (!e.shiftKey && (key === 'n' || key === 'o')))) {
    if (ctx.dialogOpen || ctx.commandPaletteOpen) return NONE;
    if (e.repeat) return SWALLOW;
    if (key === 's') return act({ type: 'save', saveAs: e.shiftKey });
    return act({ type: key === 'o' ? 'open' : 'new' });
  }

  // Dentro de un campo de texto no se dispara nada más (Ctrl+Z deshace la edición del propio campo).
  if (ctx.typingTarget) return NONE;
  // Con un diálogo modal abierto los atajos globales no tocan la escena.
  if (ctx.modalOpen) return NONE;

  if (mod && key === 'k') return ctx.dialogOpen ? SWALLOW : act({ type: 'togglePalette' });
  if (mod && e.key === ',') return act({ type: 'openSettings' });
  if (ctx.dialogOpen || ctx.commandPaletteOpen) return NONE;

  if (mod && e.shiftKey && !e.altKey && key === 'enter') return e.repeat ? SWALLOW : act({ type: 'toggleZen' });

  if (e.key === 'Escape' && !mod && !e.shiftKey && ctx.inGroup) return act({ type: 'exitGroup' });
  if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey && ctx.hasGroups && ctx.selectedCount > 1) {
    return { action: { type: 'enterGroup' }, preventDefault: false };
  }
  if (e.key === 'Escape' && !mod && ctx.zen) return act({ type: 'toggleZen' });

  if (mod && key === 'z') return act({ type: e.shiftKey ? 'redo' : 'undo' });
  if (mod && key === 'y') return act({ type: 'redo' });
  if (mod && key === 'd') return act({ type: 'duplicate' });
  if (mod && !e.altKey && key === 'g') return e.repeat ? SWALLOW : act({ type: e.shiftKey ? 'ungroup' : 'group' });
  if (mod && e.shiftKey && !e.altKey && key === 'u') return e.repeat ? SWALLOW : act({ type: 'applyHolesOrUnion' });
  if (mod && key === 'a') return act({ type: 'selectAll' });

  const nudge = NUDGE_KEYS[e.key];
  if (nudge) {
    // Sin selección empuja el único objeto de la escena; con otra cantidad no hace nada y no anula la tecla.
    if (ctx.selectedCount === 0 && ctx.objectCount !== 1) return NONE;
    return act({ type: 'nudge', key: nudge, scale: e.shiftKey ? 'coarse' : mod || e.altKey ? 'fine' : 'normal' });
  }

  if (mod || e.altKey) return NONE;

  if (e.key === '?' || e.key === 'F1') return act({ type: 'showShortcuts' });
  if (e.shiftKey && key === 'd') return act({ type: 'duplicate' });

  const transformMode = TRANSFORM_SHORTCUTS.get(key);
  if (transformMode && !(key === 'm' && e.shiftKey)) {
    return act({ type: 'transformTool', mode: transformMode, opensInspector: !e.shiftKey && !e.repeat && (key === 'm' || key === 'r' || key === 's') });
  }

  // Atajos de una letra que abren paneles o diálogos con un campo enfocado: se anula el carácter aunque la
  // acción no aplique (por ejemplo, Mayús+B).
  const prevent = SINGLE_KEY_SHORTCUTS.has(key);
  const single = (action: ShortcutAction | null): ShortcutResolution => ({ action, preventDefault: prevent });

  const camera = CAMERA_KEYS[key];
  if (camera) return single({ type: 'cameraPreset', preset: camera });
  if (key === 'v') return single({ type: 'selectTool' });
  if (key === 'h') return single({ type: e.shiftKey ? 'toggleSelectionVisibility' : 'toggleRole' });
  if (key === 'm' && e.shiftKey) return single(ctx.objectCount > 0 ? { type: 'openDialog', dialog: 'mold' } : null);
  if (key === 'b' && !e.shiftKey) return single({ type: 'toggleBed' });
  if (key === 'a' && !e.shiftKey) return single({ type: 'cycleViewMode' });
  if (key === 'x') return single({ type: 'toggleSection' });
  if (key === 'p') return single({ type: 'togglePaint' });
  if (key === 'd' && !e.shiftKey) return single({ type: 'toggleMeasure' });
  if (key === 'c' && e.shiftKey) return single(ctx.selectedCount > 0 ? { type: 'openDialog', dialog: 'splitForBed' } : null);
  if (key === 'c') return single(ctx.objectCount > 0 ? { type: 'openDialog', dialog: 'cut' } : null);
  if (key === 'l') return single({ type: 'dropToBed' });
  if ((e.key === 'Delete' || e.key === 'Backspace') && ctx.selectedCount > 0) return act({ type: 'deleteSelection' });
  return single(null);
}
