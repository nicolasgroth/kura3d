/**
 * @file src/store/plateArrangeGhost.ts
 * @description Contornos de la vista previa de «Repartir en placas…» para el visor: la huella (caja XZ ajustada) de
 * cada pieza en la pose que el plan le da, y las camas de las placas que el plan crearía. Función pura sobre el plan
 * y la escena; con más piezas que `GHOST_MAX_PIECES` no se dibuja nada (el resumen sigue valiendo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { poseBounds } from '../core/scene/plateArrange';
import { IMPLICIT_PLATE_KEY, type ArrangePlan } from '../core/scene/plateArrangeTypes';
import type { SceneObject } from '../types/kura';

/** Tope de piezas dibujadas: cada huella recorre los vértices de la pieza en el hilo principal. */
export const GHOST_MAX_PIECES = 300;

export interface GhostRect { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
export interface GhostBed { key: string; origin: [number, number]; widthMm: number; depthMm: number }
export interface ArrangeGhost { rects: GhostRect[]; newBeds: GhostBed[] }

/** null si hay demasiadas piezas para dibujarlas. La cama de la placa implícita ya está dibujada: no se repite. */
export function arrangeGhost(plan: ArrangePlan, objects: readonly SceneObject[], bed: { widthMm: number; depthMm: number }): ArrangeGhost | null {
  const pieces = plan.placements.filter((p) => p.assignPlate);
  if (pieces.length > GHOST_MAX_PIECES) return null;
  const byId = new Map(objects.map((o) => [o.id, o]));
  const rects: GhostRect[] = [];
  for (const p of pieces) {
    const o = byId.get(p.id);
    const b = o ? poseBounds(o.mesh, p.position, p.rotation, o.scale) : null;
    if (b) rects.push({ id: p.id, minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ });
  }
  const newBeds = plan.createdPlates
    .filter((c) => c.key !== IMPLICIT_PLATE_KEY)
    .map((c) => ({ key: c.key, origin: [c.origin[0], c.origin[1]] as [number, number], widthMm: bed.widthMm, depthMm: bed.depthMm }));
  return { rects, newBeds };
}
