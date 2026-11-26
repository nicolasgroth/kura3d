/**
 * @file src/components/split/splitLabelLayout.ts
 * @description Reparto en pantalla de los rótulos de pieza y de placa del visor de Dividir: oculta los de
 * piezas muy chicas en pantalla o detrás de la cámara, quita los que se solapan con otro más importante y
 * mantiene dentro del cuadro los que no deben faltar (rótulos de placa). Función pura, sin DOM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Rótulo ya proyectado a píxeles del lienzo (origen arriba a la izquierda). */
export interface ProjectedLabel {
  id: string;
  /** Punto de anclaje en pantalla: el rótulo se dibuja centrado en X y encima de este punto. */
  x: number;
  y: number;
  /** Radio aparente de la pieza en píxeles (decide si es demasiado chica para rotularse). */
  radiusPx: number;
  /** Medidas del rótulo en píxeles. */
  w: number;
  h: number;
  /** `true` para los que nunca se ocultan (placas): solo se acomodan dentro del cuadro. */
  pinned: boolean;
  behind: boolean;
  /** Prioridad entre los no fijados: los planos de corte (2) van antes que las piezas (1). */
  rank?: number;
}

export interface PlacedLabel {
  id: string;
  /** Esquina superior izquierda del rótulo. */
  left: number;
  top: number;
}

/** Radio aparente mínimo (px) para rotular una pieza. */
export const MIN_PIECE_RADIUS_PX = 18;
/** Margen entre rótulos y con el borde del cuadro (px). */
export const LABEL_GAP_PX = 4;
/** Holgura sobre la pieza (px) para no tapar su cara superior. */
const LIFT_BASE_PX = 6;
const LIFT_MAX_PX = 40;

const overlaps = (a: PlacedLabel & { w: number; h: number }, b: PlacedLabel & { w: number; h: number }): boolean =>
  a.left < b.left + b.w + LABEL_GAP_PX && b.left < a.left + a.w + LABEL_GAP_PX && a.top < b.top + b.h + LABEL_GAP_PX && b.top < a.top + a.h + LABEL_GAP_PX;

/**
 * Devuelve la posición de los rótulos visibles. Primero se colocan los fijados y luego las piezas de mayor a
 * menor tamaño aparente; una pieza cuyo rótulo choca con otro ya colocado se omite.
 */
export function layoutLabels(items: ProjectedLabel[], width: number, height: number): Map<string, PlacedLabel> {
  const placed: Array<PlacedLabel & { w: number; h: number }> = [];
  const out = new Map<string, PlacedLabel>();
  const order = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.rank ?? 1) - (a.rank ?? 1) || b.radiusPx - a.radiusPx || a.id.localeCompare(b.id));
  for (const item of order) {
    if (item.behind) continue;
    if (!item.pinned && (item.rank ?? 1) < 2 && item.radiusPx < MIN_PIECE_RADIUS_PX) continue;
    const lift = item.pinned ? LIFT_BASE_PX : Math.min(LIFT_MAX_PX, LIFT_BASE_PX + item.radiusPx * 0.35);
    let left = item.x - item.w / 2;
    let top = item.y - lift - item.h;
    if (item.pinned) {
      left = Math.min(Math.max(left, LABEL_GAP_PX), Math.max(LABEL_GAP_PX, width - item.w - LABEL_GAP_PX));
      top = Math.min(Math.max(top, LABEL_GAP_PX), Math.max(LABEL_GAP_PX, height - item.h - LABEL_GAP_PX));
    } else if (left < 0 || top < 0 || left + item.w > width || top + item.h > height) {
      // Pieza rotulada solo si su rótulo cabe entero en el cuadro.
      continue;
    }
    // Si choca con otro ya colocado, se prueba una fila más arriba o más abajo antes de omitirlo.
    const step = item.h + LABEL_GAP_PX;
    const tries = item.pinned ? [0] : [0, -step, step, -2 * step, 2 * step];
    let box: (PlacedLabel & { w: number; h: number }) | null = null;
    for (const dy of tries) {
      const cand = { id: item.id, left, top: top + dy, w: item.w, h: item.h };
      if (!item.pinned && (cand.top < 0 || cand.top + cand.h > height)) continue;
      if (item.pinned || !placed.some((p) => overlaps(cand, p))) {
        box = cand;
        break;
      }
    }
    if (!box) continue;
    placed.push(box);
    out.set(item.id, { id: item.id, left: box.left, top: box.top });
  }
  return out;
}
