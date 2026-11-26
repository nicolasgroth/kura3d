/**
 * @file src/engine/moldChannels.ts
 * @description Canales de vertido y verificación de llenado para moldes: un embudo por cada
 * cuerpo del maestro, ubicado sobre la cara superior real de ese cuerpo (no en el centro de la
 * caja envolvente, que en toros o piezas con agujeros cae fuera de la pieza), y detección de
 * vacíos sellados: cualquier componente del aire interior que no conecte con el exterior
 * es una cavidad imposible de llenar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { highestPoint } from './solidOffset';
import { withWasmScope } from './wasmScope';

/** Caja alineada a ejes. */
export interface AxisBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** Punto de la cara superior de `body` donde cabe un canal de radio `radius`. */
export function pourPointOnTop(body: Manifold, radius: number): [number, number, number] | null {
  const top = highestPoint(body, 1);
  if (!top) return null;
  const bb = body.boundingBox();
  const height = bb.max[1] - bb.min[1];
  const sliceY = top[1] - Math.min(0.5, height * 0.1);
  return withWasmScope((scope) => {
    // Rotación +90° en X: (x, y, z) → (x, −z, y); el corte a altura sliceY es la planta en Y
    const rotated = scope.track(body.rotate([90, 0, 0]));
    const section = scope.track(rotated.slice(sliceY));
    const eroded = scope.track(section.offset(-radius * 0.9, 'Round'));
    if (eroded.isEmpty()) return top;
    // Un vértice del contorno erosionado queda a 0.9·r del borde: el canal cae sobre la pieza
    // (el centroide de un anillo, como en un toro, caería en el hueco).
    let best: [number, number] | null = null;
    let bestArea = 0;
    for (const poly of eroded.toPolygons()) {
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i];
        const [x2, y2] = poly[(i + 1) % poly.length];
        area += x1 * y2 - x2 * y1;
      }
      if (Math.abs(area) > bestArea && poly.length > 0) {
        bestArea = Math.abs(area);
        best = [poly[0][0], poly[0][1]];
      }
    }
    return best ? [best[0], sliceY, -best[1]] : top;
  });
}

/**
 * Construye un embudo cónico por cada cuerpo del maestro: arranca dentro del cuerpo (bajo su
 * punto más alto) y sale por la tapa del molde en `topY`.
 */
export function buildPourChannels(
  wasm: ManifoldToplevel,
  master: Manifold,
  topY: number,
  radius: number
): Manifold | null {
  return withWasmScope((scope) => {
    const bodies = scope.trackAll(master.decompose());
    const channels: Manifold[] = [];
    for (const body of bodies) {
      const point = pourPointOnTop(body, radius);
      if (!point) continue;
      const into = Math.min(0.8, (body.boundingBox().max[1] - body.boundingBox().min[1]) * 0.25);
      const y0 = point[1] - into;
      const height = topY + 1 - y0;
      const cone = scope.track(wasm.Manifold.cylinder(height, radius, radius * 1.45, 32, false));
      const up = scope.track(cone.rotate([-90, 0, 0]));
      channels.push(scope.track(up.translate([point[0], y0, point[2]])));
    }
    if (channels.length === 0) return null;
    return channels.length === 1 ? scope.keep(channels[0]) : wasm.Manifold.union(channels);
  });
}

/**
 * Cuenta los vacíos sellados del molde: componentes del espacio vacío dentro de `box`
 * (ampliada 1 mm) que no tocan su borde, es decir, cavidades sin salida al exterior.
 */
export function countSealedVoids(
  wasm: ManifoldToplevel,
  mold: Manifold,
  box: AxisBox
): { count: number; volumeMm3: number } {
  const pad = 1;
  return withWasmScope((scope) => {
    const outer = scope.track(wasm.Manifold.cube(
      [box.maxX - box.minX + 2 * pad, box.maxY - box.minY + 2 * pad, box.maxZ - box.minZ + 2 * pad],
      false
    ));
    const placed = scope.track(outer.translate([box.minX - pad, box.minY - pad, box.minZ - pad]));
    const air = scope.track(placed.subtract(mold));
    const parts = scope.trackAll(air.decompose());
    let count = 0;
    let volumeMm3 = 0;
    const eps = 1e-3;
    for (const part of parts) {
      const b = part.boundingBox();
      const touches =
        b.min[0] <= box.minX - pad + eps ||
        b.min[1] <= box.minY - pad + eps ||
        b.min[2] <= box.minZ - pad + eps ||
        b.max[0] >= box.maxX + pad - eps ||
        b.max[1] >= box.maxY + pad - eps ||
        b.max[2] >= box.maxZ + pad - eps;
      const v = part.volume();
      if (!touches && v > 1e-6) {
        count++;
        volumeMm3 += v;
      }
    }
    return { count, volumeMm3 };
  });
}
