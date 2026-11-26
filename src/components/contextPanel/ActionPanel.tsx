/**
 * @file src/components/contextPanel/ActionPanel.tsx
 * @description Contexto «acción» del panel derecho: solo las opciones de la acción activa sobre el objeto, con
 * título, el objeto sobre el que actúa y «Volver» (o Esc) para regresar al resumen. Al abrirse lleva el foco a
 * su primer campo y, al cerrarse, lo devuelve al control que la abrió. Esc en un campo numérico primero
 * revierte el valor (y suelta el foco); el siguiente Esc vuelve al resumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import type { ActionId } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { PanelHeader } from '../shell/PanelHeader';
import { panelContentOf } from './panelRegistry';

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/** Enfoca el encabezado del panel cuando el control que abrió la acción ya no existe. */
export function focusPanelHeading(): void {
  document.querySelector<HTMLElement>('#kura-inspector-panel .kura-ctx-heading')?.focus({ preventScroll: true });
}

/** `primary` es `null` en una acción de escena: su contenido (`renderScene`) dice sobre qué actúa. */
export const ActionPanel: React.FC<{ id: ActionId; primary: SceneObject | null; ui: InspectorLocalState }> = ({ id, primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const setActiveAction = useKuraStore((s) => s.setActiveAction);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const openedFor = useRef<ActionId | null>(null);
  const entry = panelContentOf(id);

  // De dónde vino el foco: se lee al pintar, antes de que una sección lo tome en su propio efecto.
  if (openedFor.current !== id && typeof document !== 'undefined') {
    openedFor.current = id;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && active !== document.body && !rootRef.current?.contains(active)) returnRef.current = active;
  }

  // Foco: entra al panel al abrir una acción (si la propia sección no lo tomó ya).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = document.activeElement;
    if (active && root.contains(active)) return;
    // Se busca dentro del cuerpo: con `.kura-ctx-body ${FOCUSABLE}` el prefijo solo afectaba a la primera
    // alternativa de la lista y `button` encontraba antes «Volver» (va primero en el DOM).
    const first = root.querySelector('.kura-ctx-body')?.querySelector<HTMLElement>(FOCUSABLE) ?? root.querySelector<HTMLElement>('.kura-ctx-heading');
    first?.focus({ preventScroll: true });
  }, [id]);

  const close = () => {
    const target = returnRef.current;
    setActiveAction(null);
    requestAnimationFrame(() => {
      if (target?.isConnected && target.getClientRects().length > 0) {
        target.focus({ preventScroll: true });
        return;
      }
      // El acceso del resumen que la abrió se volvió a montar: se enfoca su equivalente.
      const access = document.querySelector<HTMLElement>(`#kura-inspector-panel [data-panel-action="${id}"]`);
      if (access) access.focus({ preventScroll: true });
      else focusPanelHeading();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  // Esc con el foco fuera de un control (p. ej. tras revertir un campo numérico, que suelta el foco) también
  // vuelve al resumen, salvo con un diálogo o menú abierto.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement && document.activeElement !== document.body) return;
      if (useKuraStore.getState().activeDialog !== null || document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const menus = document.querySelectorAll<HTMLElement>('[role="menu"]');
      if (Array.from(menus).some((m) => m.getClientRects().length > 0)) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, []);

  if (!entry) return null;
  const title = t(language, entry.title);

  return (
    <div ref={rootRef} className="kura-ctx-action" data-action={id} onKeyDown={onKeyDown}>
      <PanelHeader onBack={close} title={title} className="kura-ctx-header" titleClassName="kura-ctx-heading" focusableTitle />
      {!entry.renderScene && primary && (
        <p className="kura-ctx-target" title={primary.name}>{t(language, 'panel.action.target', { name: primary.name })}</p>
      )}
      <div className="kura-scroll-area kura-ctx-body">
        <section className="kura-card">{entry.renderScene ? entry.renderScene() : primary && entry.render?.({ primary, ui })}</section>
      </div>
    </div>
  );
};
