/**
 * @file src/components/viewport/floatingBarBridge.ts
 * @description Puente sin React entre la barra flotante (DOM, fuera del lienzo) y el seguidor que corre en el bucle del
 * visor: la barra registra su elemento y su tamaño, el seguidor le escribe la posición con `style.transform` sin
 * renderizar React por cuadro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export interface FloatingBarBridge {
  /** Elemento de la barra (null si no está montada). */
  el: HTMLElement | null;
  width: number;
  height: number;
  /** Cambia cada vez que se registra o se mide la barra, para forzar una colocación nueva. */
  version: number;
}

export const floatingBarBridge: FloatingBarBridge = { el: null, width: 0, height: 0, version: 0 };

export function registerFloatingBar(el: HTMLElement | null): void {
  floatingBarBridge.el = el;
  if (!el) {
    floatingBarBridge.width = 0;
    floatingBarBridge.height = 0;
  }
  floatingBarBridge.version += 1;
}

export function measureFloatingBar(width: number, height: number): void {
  if (width === floatingBarBridge.width && height === floatingBarBridge.height) return;
  floatingBarBridge.width = width;
  floatingBarBridge.height = height;
  floatingBarBridge.version += 1;
}
