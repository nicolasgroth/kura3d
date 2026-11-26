/**
 * @file src/store/escapeChain.ts
 * @description Cadena de prioridad única de la tecla Esc: el orden en que los niveles de la interfaz la consumen y,
 * para un nivel dado, qué niveles superiores lo bloquean. Los paneles (`usePanelEscape`) consultan esta cadena
 * en vez de decidir cada uno por su cuenta; el tooltip, los diálogos y los gestos en curso ya consumen el Esc
 * antes (captura o `defaultPrevented`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useKuraStore } from './useKuraStore';

/**
 * Orden de prioridad de Esc (el primero que aplica lo consume; un Esc consume un solo nivel):
 *
 * 1. `tooltip`   — la ayuda abierta se cierra (capa de ayuda, captura). Dentro de un panel el mismo Esc sigue.
 * 2. `dialog`    — diálogo modal o paleta de comandos: su propio Esc (los atajos globales no actúan).
 * 3. `operation` — cálculo cancelable en curso (barra de progreso) o gesto en curso (arrastre, medición): se cancela.
 * 4. `menu`      — menú o submenú abierto: se cierra (cada menú maneja su Esc).
 * 5. `group`     — se está dentro de un grupo: sale del grupo (atajo `exitGroup` de `App`).
 * 6. `zen`       — modo sin distracciones: sale (atajo `toggleZen` de `App`).
 * 7. `panel`     — panel de acción o de operación abierto: «Volver».
 * 8. `tool`      — panel de una herramienta (Pintar, Medir…): vuelve a Seleccionar.
 * 9. `selection` — reservado: Esc aún no deselecciona.
 */
export const ESCAPE_ORDER = ['tooltip', 'dialog', 'operation', 'menu', 'group', 'zen', 'panel', 'tool', 'selection'] as const;
export type EscapeLevel = (typeof ESCAPE_ORDER)[number];

/** Qué hay abierto ahora (el tooltip no entra: su capa lo consume antes, en la fase de captura). */
export interface EscapeContext {
  dialog: boolean;
  operation: boolean;
  menu: boolean;
  group: boolean;
  zen: boolean;
  /** Hay un panel de acción o de operación abierto. */
  panel: boolean;
}

/** Primer nivel superior a `own` que está activo, o `null` si `own` es quien debe consumir el Esc. */
export function escapeBlockedBy(ctx: EscapeContext, own: EscapeLevel): EscapeLevel | null {
  for (const level of ESCAPE_ORDER) {
    if (level === own) return null;
    if (level in ctx && ctx[level as keyof EscapeContext]) return level;
  }
  return null;
}

/** Nivel que consume el Esc con este contexto (`null` si ninguno de los que describe `EscapeContext`). */
export function resolveEscapeLevel(ctx: EscapeContext): EscapeLevel | null {
  for (const level of ESCAPE_ORDER) {
    if (level in ctx && ctx[level as keyof EscapeContext]) return level;
  }
  return null;
}

/** Lee el contexto del store y del DOM (menús y diálogos nativos se detectan por su rol visible). */
export function readEscapeContext(): EscapeContext {
  const st = useKuraStore.getState();
  const has = typeof document !== 'undefined';
  // Corte, molde, rosca… viven en `activeDialog` pero se muestran como panel de operación (no modal, `.kura-op-panel`):
  // ese «diálogo» es el propio panel y su Esc es el de nivel `panel`, no un modal que lo bloquee.
  const opPanelOpen = has && document.querySelector('.kura-op-panel') !== null;
  const modalInDom = has && document.querySelector('dialog[open], [aria-modal="true"]') !== null;
  return {
    dialog: st.commandPaletteOpen || modalInDom || (st.activeDialog !== null && !opPanelOpen),
    operation: Boolean(st.busyProgress?.cancellable),
    menu: has && Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]')).some((m) => m.getClientRects().length > 0),
    group: Boolean(st.groupContextId),
    zen: st.uiDensity === 'zen',
    panel: has && document.querySelector('.kura-ctx-action, .kura-op-panel') !== null,
  };
}
