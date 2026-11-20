/**
 * @file src/utils/dialogMotion.ts
 * @description Helpers compartidos para elementos <dialog> nativos: animación de salida
 * en capa superior (animate-to-from-top-layer) y fallback de light-dismiss.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

let supportsDisplayTransitionCache: boolean | undefined;

/**
 * Detecta de forma fiable si el navegador soporta transiciones discretas en `display`
 * para animar la salida del elemento `<dialog>` sin que desaparezca al instante.
 */
function canTransitionDisplay(): boolean {
  if (supportsDisplayTransitionCache !== undefined) {
    return supportsDisplayTransitionCache;
  }
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransitionCache = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransitionCache;
}

/** Verifica si el navegador soporta cierre nativo animado en top-layer (`overlay` + `display`). */
function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

/**
 * Cierra un `<dialog>` nativo preservando su animación de salida en navegadores
 * sin soporte completo de `overlay` o transición discreta en `display`.
 */
export async function closeDialogWithMotion(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }

  if (dialog.open) {
    dialog.close();
  }
}

/**
 * Adjunta el comportamiento de cierre animado en `cancel` (Esc / back) y el fallback
 * de light-dismiss para navegadores sin `HTMLDialogElement.prototype.closedBy`.
 */
export function attachDialogDismissHandlers(dialog: HTMLDialogElement): () => void {
  const onCancel = (event: Event) => {
    event.preventDefault();
    void closeDialogWithMotion(dialog);
  };
  dialog.addEventListener('cancel', onCancel);

  let cleanupOutside: (() => void) | undefined;
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        void closeDialogWithMotion(dialog);
      }
      pressedOutside = false;
    };
    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    cleanupOutside = () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }

  return () => {
    dialog.removeEventListener('cancel', onCancel);
    cleanupOutside?.();
  };
}
