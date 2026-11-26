/**
 * @file src/test/setupComponents.ts
 * @description Preparación del entorno jsdom para pruebas de componentes: limpieza entre pruebas,
 * estado inicial del store y polyfills de <dialog>, Popover API y matchMedia que jsdom no trae.
 * Desde jsdom 27+ la hoja del agente oculta `[popover]` cerrado y `<dialog>` sin `open`, y un elemento
 * no renderizado no recibe foco: el popover del polyfill (`data-popover-open`) se muestra con una regla
 * de autor, y `:modal` responde según `showModal()` (jsdom entiende el selector pero no abre modales).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { useKuraStore } from '../store/useKuraStore';
import { useDecisionStore } from '../utils/confirmDialog';

const initialStore = useKuraStore.getState();

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* sin almacenamiento */
  }
  useKuraStore.setState(initialStore, true);
  useKuraStore.setState({ language: 'es', engineReady: true });
  useDecisionStore.setState({ request: null });
});

afterEach(() => cleanup());

const dialogProto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
if (typeof dialogProto.showModal !== 'function') {
  const modalDialogs = new WeakSet<Element>();
  const nativeMatches = Element.prototype.matches;
  Element.prototype.matches = function matches(this: Element, selectors: string): boolean {
    if (selectors.trim() === ':modal') return modalDialogs.has(this) && this.hasAttribute('open');
    return nativeMatches.call(this, selectors);
  } as typeof Element.prototype.matches;
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    modalDialogs.add(this);
    this.setAttribute('open', '');
  };
  dialogProto.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialogProto.close = function close(this: HTMLDialogElement) {
    modalDialogs.delete(this);
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

const elementProto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
if (typeof elementProto.showPopover !== 'function') {
  const toggle = (el: HTMLElement, open: boolean) => {
    if (el.hasAttribute('data-popover-open') === open) return;
    if (open) el.setAttribute('data-popover-open', '');
    else el.removeAttribute('data-popover-open');
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState: open ? 'open' : 'closed' }));
  };
  elementProto.showPopover = function showPopover(this: HTMLElement) {
    toggle(this, true);
  };
  elementProto.hidePopover = function hidePopover(this: HTMLElement) {
    toggle(this, false);
  };
  elementProto.togglePopover = function togglePopover(this: HTMLElement): boolean {
    toggle(this, !this.hasAttribute('data-popover-open'));
    return this.hasAttribute('data-popover-open');
  };
  // La hoja del agente de jsdom oculta `[popover]` sin `:popover-open`; el abierto por el polyfill se ve.
  const shown = document.createElement('style');
  shown.textContent = '[popover][data-popover-open] { display: block; }';
  document.head.appendChild(shown);
}

if (typeof elementProto.scrollIntoView !== 'function') {
  elementProto.scrollIntoView = () => undefined;
}
if (typeof (Element.prototype as Element & Record<string, unknown>).getAnimations !== 'function') {
  (Element.prototype as Element & Record<string, unknown>).getAnimations = () => [];
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
