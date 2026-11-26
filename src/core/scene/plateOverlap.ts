/**
 * @file src/core/scene/plateOverlap.ts
 * @description Placas cuyas camas se pisan en XZ. La app nunca las crea así (`nextPlateOrigin` busca un origen
 * libre), pero pueden venir de un archivo editado o dañado, o aparecer al agrandar la cama del proyecto. Al abrir
 * no se recolocan: mover una placa obliga a mover sus piezas (pose viva o `restPose` según el modo), sus
 * acompañantes y cada instantánea del historial para que deshacer no salte, y una cama agrandada a propósito
 * quedaría reordenada sin pedirlo. Se detectan y se avisa; el usuario decide.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ScenePlate } from '../../types/plates';
import { plateBed, type ProjectBed } from './plates';

/** Holgura bajo la cual dos camas que se tocan en el borde no cuentan como solapadas. */
const TOUCH_MM = 1e-6;

/** Pares [id, id] de placas cuyas camas se pisan (en el orden de la lista). */
export function overlappingPlates(plates: readonly ScenePlate[], projectBed: ProjectBed): Array<[string, string]> {
  const rects = plates.map((p) => {
    const b = plateBed(p, projectBed);
    return { id: p.id, x0: p.origin[0] - b.widthMm / 2, x1: p.origin[0] + b.widthMm / 2, z0: p.origin[1] - b.depthMm / 2, z1: p.origin[1] + b.depthMm / 2 };
  });
  const out: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x0 < b.x1 - TOUCH_MM && b.x0 < a.x1 - TOUCH_MM && a.z0 < b.z1 - TOUCH_MM && b.z0 < a.z1 - TOUCH_MM) out.push([a.id, b.id]);
    }
  }
  return out;
}
