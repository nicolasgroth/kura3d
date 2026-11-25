/**
 * @file src/components/viewport/floatingBarFocus.ts
 * @description Devuelve el foco a un botón de la barra flotante cuando esta vuelve a verse: al remontarse (tras cerrar
 * el menú «Más») la barra queda oculta hasta que el visor la coloca en el siguiente cuadro, y un elemento oculto no
 * recibe foco. Reintenta cuadro a cuadro durante un tiempo corto y devuelve la función que cancela.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Cuadros que se espera a que el visor muestre la barra antes de forzar el foco. */
export const FOCUS_WAIT_FRAMES = 20;

export function focusWhenShown(bar: () => HTMLElement | null, target: () => HTMLElement | null | undefined): () => void {
  let frame = 0;
  let left = FOCUS_WAIT_FRAMES;
  const tick = () => {
    const el = bar();
    const shown = el?.dataset.placed === 'true' && el.dataset.busy !== 'true' && el.dataset.offscreen !== 'true';
    if (shown || left <= 0) {
      target()?.focus();
      return;
    }
    left -= 1;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
