/**
 * @file src/components/useTopModal.ts
 * @description Devuelve el `<dialog>` modal abierto más reciente (o null). Los avisos se pintan dentro de él
 * para quedar por encima del velo del diálogo, que vive en la capa superior del navegador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, useState } from 'react';

function isModal(dialog: HTMLDialogElement): boolean {
  try {
    // Sin soporte del selector (jsdom) se asume modal: la capa superior solo importa en navegadores reales.
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || !CSS.supports('selector(:modal)')) return true;
    return dialog.matches(':modal');
  } catch {
    return true;
  }
}

function findTopModal(): HTMLDialogElement | null {
  const open = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).filter(isModal);
  return open.length > 0 ? open[open.length - 1] : null;
}

export function useTopModal(): HTMLDialogElement | null {
  const [modal, setModal] = useState<HTMLDialogElement | null>(() => (typeof document === 'undefined' ? null : findTopModal()));

  useEffect(() => {
    const update = () => setModal((prev) => {
      const next = findTopModal();
      return next === prev ? prev : next;
    });
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);

  return modal;
}
