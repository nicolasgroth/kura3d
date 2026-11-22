/**
 * @file src/components/viewport/cutPlaneDrag.ts
 * @description Canal de interfaz entre el plano de corte del visor y el panel de corte: el visor
 * publica el desplazamiento al arrastrar el plano y el panel lo aplica a su campo numérico. Incluye
 * la proyección del rayo del puntero sobre el eje del corte.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';

type Listener = (offset: number) => void;
const listeners = new Set<Listener>();

/** Suscribe al arrastre del plano de corte; devuelve la función para desuscribir. */
export function onCutPlaneDrag(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCutPlaneDrag(offset: number): void {
  for (const l of listeners) l(offset);
}

/**
 * Parámetro `t` del punto del eje (`origin + t·dir`) más cercano al rayo, o null si el rayo es
 * casi paralelo al eje (no hay un punto bien definido).
 */
export function closestAxisParam(ray: THREE.Ray, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  const w0 = new THREE.Vector3().subVectors(origin, ray.origin);
  const a = dir.dot(dir);
  const b = dir.dot(ray.direction);
  const c = ray.direction.dot(ray.direction);
  const d = dir.dot(w0);
  const e = ray.direction.dot(w0);
  const denom = a * c - b * b;
  if (Math.abs(denom) < 1e-6) return null;
  return (b * e - c * d) / denom;
}

/** true si el foco del teclado está en el visor (o en ningún control). */
export function keyboardFocusInViewport(target: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false;
  if (!(target instanceof Element) || target === document.body) return true;
  return Boolean(target.closest('.kura-viewport-wrap')) && !target.closest('input, textarea, select, button, [role="dialog"]');
}
