/**
 * @file src/utils/focusById.ts
 * @description Lleva la vista y el foco a un elemento de la interfaz por su id (acción "Ver detalles" de los avisos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Desplaza hasta el elemento y le da el foco; devuelve false si no está en pantalla. */
export function focusById(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
  return true;
}
