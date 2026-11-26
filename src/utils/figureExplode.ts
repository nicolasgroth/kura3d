/**
 * @file src/utils/figureExplode.ts
 * @description Separación visual («explosión») de cualquier conjunto de piezas en la vista armada (lote P4): cada pieza
 * se aleja del centro del conjunto en la dirección de su propio centro. Función pura y solo de dibujo: no toca poses
 * ni historial. Vive en `utils` porque usa las cajas envolventes de `selectionBounds`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject, Vec3 } from '../types/kura';
import { computeSelectionBounds } from './selectionBounds';

/**
 * Posiciones de la separación visual (0 = armado exacto, 1 = separadas): cada pieza se aleja del centro del conjunto
 * en la dirección de su propio centro, en proporción a `factor`. Solo dibujo: no toca poses ni historial. Con menos
 * de dos piezas no hay nada que separar.
 */
export function explodedFigurePositions(objects: readonly SceneObject[], ids: ReadonlySet<string>, factor: number, spread = 0.8): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const picked = objects.filter((o) => ids.has(o.id));
  const f = Math.min(1, Math.max(0, factor));
  if (picked.length < 2 || f <= 0) return out;
  const all = computeSelectionBounds(picked);
  if (!all) return out;
  const cx = (all.min[0] + all.max[0]) / 2;
  const cy = (all.min[1] + all.max[1]) / 2;
  const cz = (all.min[2] + all.max[2]) / 2;
  const reach = Math.max(all.size[0], all.size[1], all.size[2], 1) * spread;
  for (const o of picked) {
    const b = computeSelectionBounds([o]);
    if (!b) continue;
    const d: Vec3 = [(b.min[0] + b.max[0]) / 2 - cx, (b.min[1] + b.max[1]) / 2 - cy, (b.min[2] + b.max[2]) / 2 - cz];
    const len = Math.hypot(d[0], d[1], d[2]);
    // Una pieza justo en el centro no tiene dirección: se queda donde está.
    if (len < 1e-6) continue;
    const k = (f * reach) / len;
    out.set(o.id, [o.position[0] + d[0] * k, o.position[1] + d[1] * k, o.position[2] + d[2] * k]);
  }
  return out;
}
