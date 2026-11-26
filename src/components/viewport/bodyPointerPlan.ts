/**
 * @file src/components/viewport/bodyPointerPlan.ts
 * @description Qué hace el pulsar el cuerpo de una pieza con la herramienta Seleccionar: `drag` (ya seleccionada:
 * un arrastre la mueve y el clic sin movimiento conserva su efecto, también con Mayús/Ctrl apretados de antes, para
 * que Mayús+arrastrar restrinja a un eje en vez de deseleccionarla), `clickOnly` (no seleccionada: solo un clic sin
 * movimiento selecciona; un arrastre orbita la cámara) o `pick` (se elige ya).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export type BodyPointerPlan = 'drag' | 'clickOnly' | 'pick';

export function bodyPointerPlan(o: {
  isSelected: boolean;
  /** Mayús, Ctrl o Cmd apretados al pulsar. */
  additive: boolean;
  activeTool: string;
  transformMode: string;
  /** El manipulador ya tomó el gesto. */
  gizmoStarted: boolean;
}): BodyPointerPlan {
  if (o.isSelected && o.activeTool === 'select' && o.transformMode === 'translate' && !o.gizmoStarted) return 'drag';
  if (!o.isSelected && !o.additive && o.activeTool === 'select') return 'clickOnly';
  return 'pick';
}
