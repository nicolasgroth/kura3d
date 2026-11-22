/**
 * @file src/components/useFunctionKeys.ts
 * @description Teclas de función del estudio: F2 renombra el objeto seleccionado en línea, F3 busca en la
 * escena (repetido pasa al siguiente), F4 repite la última acción y F5 recalcula el paramétrico. F5 solo se
 * intercepta en escritorio (en el navegador recarga la página); Mayús+F5 recalcula en ambos. No se disparan
 * al escribir en un campo, con un diálogo modal ni con la paleta abierta, ni con Ctrl/Alt/Meta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { t } from '../i18n';
import { repeatLabel } from '../store/repeatLabel';
import { useKuraStore } from '../store/useKuraStore';
import { isTauriRuntime } from '../utils/platformBridge';

export interface FunctionKeyDeps {
  /** Muestra el panel izquierdo (en pantallas estrechas es un cajón). */
  revealLeftPanel: () => void;
}

/** Recalcula los paramétricos seleccionados y avisa del resultado. */
export async function recomputeWithToast(): Promise<void> {
  const s = useKuraStore.getState();
  const count = await s.recomputeSelected();
  const language = useKuraStore.getState().language;
  s.addToast(
    count > 0 ? t(language, 'menu.recompute.done', { count }) : t(language, 'menu.recompute.none'),
    count > 0 ? 'success' : 'info',
  );
}

/** Repite la última acción y avisa si no hay o no aplica a la selección. */
export async function repeatWithToast(): Promise<void> {
  const s = useKuraStore.getState();
  const outcome = await s.repeatLastAction();
  const after = useKuraStore.getState();
  if (outcome === 'done' && s.lastRepeatable) {
    after.addToast(t(after.language, 'repeat.done', { name: repeatLabel(after.language, s.lastRepeatable) }), 'info');
  } else if (outcome === 'none') after.addToast(t(after.language, 'repeat.none'), 'info');
  else if (outcome === 'notApplicable' && s.lastRepeatable) {
    after.addToast(t(after.language, 'repeat.notApplicable', { name: repeatLabel(after.language, s.lastRepeatable) }), 'info');
  }
}

/** Resuelve una tecla de función; devuelve true si la consumió. Exportada para pruebas. */
export function handleFunctionKey(e: KeyboardEvent, deps: FunctionKeyDeps): boolean {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (!['F2', 'F3', 'F4', 'F5'].includes(e.key)) return false;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return false;
  const state = useKuraStore.getState();
  if (state.activeDialog !== null || state.commandPaletteOpen) return false;
  if (typeof document !== 'undefined' && document.querySelector('dialog[open], [aria-modal="true"]')) return false;

  switch (e.key) {
    case 'F2': {
      e.preventDefault();
      deps.revealLeftPanel();
      if (!state.requestRename()) state.addToast(t(state.language, 'menu.rename.none'), 'info');
      return true;
    }
    case 'F3': {
      e.preventDefault();
      deps.revealLeftPanel();
      if (state.sceneFilter.trim()) {
        const found = state.findSceneMatch(e.shiftKey ? 'prev' : 'next');
        if (!found) state.requestSceneSearchFocus();
      } else {
        state.requestSceneSearchFocus();
      }
      return true;
    }
    case 'F4': {
      e.preventDefault();
      if (!e.repeat) void repeatWithToast();
      return true;
    }
    default: {
      // F5 sin Mayús recarga la página en el navegador: solo se intercepta en escritorio.
      if (!e.shiftKey && !isTauriRuntime()) return false;
      e.preventDefault();
      if (!e.repeat) void recomputeWithToast();
      return true;
    }
  }
}

export function useFunctionKeys(deps: FunctionKeyDeps): void {
  const { revealLeftPanel } = deps;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      handleFunctionKey(e, { revealLeftPanel });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revealLeftPanel]);
}
