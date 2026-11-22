/**
 * @file src/components/viewport/livePaintStroke.ts
 * @description Trazo de pincel en vivo del visor (sin React): las muestras del puntero se encolan y se
 * procesan una vez por frame (`requestAnimationFrame`); cada frame pinta sobre la sesión pura y sube
 * a la GPU solo las caras que cambiaron. El store no se toca hasta soltar el puntero, cuando se
 * guarda la malla final con UN paso de historial (delta). Hay a lo sumo un trazo activo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as THREE from 'three';
import type { BrushQuery } from '../../engine/paint/brushSelect';
import { PaintStrokeSession } from '../../engine/paint/strokeSession';
import { updateGeometryFaceColorsAt } from '../../engine/paintColorAttribute';
import { useKuraStore } from '../../store/useKuraStore';

interface LiveStroke {
  objectId: string;
  baseHex: string;
  color: string;
  session: PaintStrokeSession;
  queue: BrushQuery[];
  /** Caras pintadas que aún no llegan a la GPU (la geometría puede estar reconstruyéndose). */
  pending: number[];
  getGeometry: () => THREE.BufferGeometry | null;
  frame: number;
}

let active: LiveStroke | null = null;

const raf = (cb: () => void): number =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
const cancelRaf = (id: number) => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
};

function flush(stroke: LiveStroke): void {
  stroke.frame = 0;
  for (const query of stroke.queue) stroke.session.paint(query, stroke.color);
  stroke.queue.length = 0;
  const dirty = stroke.session.takeDirty();
  if (dirty.length > 0) for (const t of dirty) stroke.pending.push(t);
  if (stroke.pending.length === 0) return;
  const geometry = stroke.getGeometry();
  if (geometry && updateGeometryFaceColorsAt(geometry, stroke.pending, stroke.session.colors, stroke.baseHex)) {
    stroke.pending = [];
  } else if (!stroke.frame) {
    // La geometría con colores aún no está lista: se reintenta en el próximo frame.
    stroke.frame = raf(() => flush(stroke));
  }
}

/**
 * Empieza un trazo sobre el objeto (lo deja listo para pintar en el store). `false` si no se puede
 * pintar ahora (bloqueado, operación en curso).
 */
export function startLiveStroke(objectId: string, getGeometry: () => THREE.BufferGeometry | null): boolean {
  finishLiveStroke();
  const store = useKuraStore.getState();
  const mesh = store.preparePaintStroke(objectId);
  const obj = store.objects.find((o) => o.id === objectId);
  if (!mesh || !obj) return false;
  const baseHex = obj.isHole ? '#f97316' : obj.color;
  active = {
    objectId,
    baseHex,
    color: store.paintColor,
    session: new PaintStrokeSession(mesh, obj.color),
    queue: [],
    pending: [],
    getGeometry,
    frame: 0,
  };
  return true;
}

/** Encola una muestra del trazo activo; se procesa en el próximo frame junto con las demás. */
export function queueLiveSample(objectId: string, query: BrushQuery): void {
  const stroke = active;
  if (!stroke || stroke.objectId !== objectId) return;
  stroke.queue.push(query);
  if (!stroke.frame) stroke.frame = raf(() => flush(stroke));
}

export function hasLiveStroke(objectId?: string): boolean {
  return active !== null && (objectId === undefined || active.objectId === objectId);
}

/** Cierra el trazo activo: procesa lo encolado y lo guarda en el store (un paso de historial). */
export function finishLiveStroke(): void {
  const stroke = active;
  if (!stroke) return;
  active = null;
  if (stroke.frame) cancelRaf(stroke.frame);
  stroke.frame = 0;
  for (const query of stroke.queue) stroke.session.paint(query, stroke.color);
  stroke.queue.length = 0;
  useKuraStore.getState().commitPaintStroke(stroke.objectId, stroke.session.finish());
}
