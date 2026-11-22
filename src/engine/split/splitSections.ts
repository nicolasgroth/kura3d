/**
 * @file src/engine/split/splitSections.ts
 * @description Muestreo de secciones transversales para elegir dónde cortar: orienta el sólido para
 * que el plano del eje quede en z' = coordenada (misma convención que `cutConnectorLayout.ts`),
 * mide área, islas e isla más chica con `slice` de manifold-3d y si alguna isla admite un conector
 * (zona segura no vacía tras contraer por la huella). También decide la rotación de 90° que hace
 * caber una caja en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { connectorFootprintRadius } from '../cutConnectorLayout';
import { CONNECTOR_MIN_WALL_MM } from '../cutConnectorChecks';
import type { SplitAxis, SplitConnectorOptions } from './splitTypes';

export const AXIS_INDEX: Record<SplitAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/** Sólido orientado para seccionar por el eje (el llamador libera si `owned`). */
export function orientForAxis(m: Manifold, axis: SplitAxis): { oriented: Manifold; owned: boolean } {
  if (axis === 'z') return { oriented: m, owned: false };
  return { oriented: axis === 'y' ? m.rotate([90, 0, 0]) : m.rotate([0, -90, 0]), owned: true };
}

/** Medidas de una sección. */
export interface SectionStats {
  areaMm2: number;
  islands: number;
  smallestIslandMm2: number;
  admitsConnectors: boolean;
}

/** Margen al borde que necesita un conector (huella + holgura + pared). */
export function connectorMargin(c: SplitConnectorOptions): number {
  return connectorFootprintRadius(c.type, c.size, c.tolerance + CONNECTOR_MIN_WALL_MM) + 0.02;
}

/** Mide la sección del sólido orientado en `coord`. */
export function measureSection(oriented: Manifold, coord: number, connector: SplitConnectorOptions | null): SectionStats {
  const section = oriented.slice(coord);
  try {
    const area = section.area();
    if (area <= 1e-9) return { areaMm2: 0, islands: 0, smallestIslandMm2: 0, admitsConnectors: false };
    const parts = section.decompose();
    let smallest = Infinity;
    let admits = false;
    const margin = connector ? connectorMargin(connector) : 0;
    for (const p of parts) {
      const a = p.area();
      smallest = Math.min(smallest, a);
      if (connector && !admits) {
        const safe = p.offset(-margin, 'Round');
        admits = !safe.isEmpty();
        safe.delete();
      }
      p.delete();
    }
    return { areaMm2: area, islands: parts.length, smallestIslandMm2: smallest, admitsConnectors: admits };
  } finally {
    section.delete();
  }
}

/** Rotaciones de prueba (Euler XYZ, radianes): sin giro y giros de 90° que acuestan la pieza. */
const H = Math.PI / 2;
const ROTATIONS: Vec3[] = [
  [0, 0, 0],
  [0, H, 0],
  [0, 0, H],
  [H, 0, 0],
  [H, 0, H],
  [0, H, H],
];

/** Medidas de una caja `size` tras rotar con Euler XYZ (giros de 90°, valores absolutos). */
export function rotatedSize(size: Vec3, rot: Vec3): Vec3 {
  const [a, b, c] = rot;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // Matriz de three.js para Euler 'XYZ'
  const m = [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ];
  return [0, 1, 2].map((r) => m[r].reduce((s, v, k) => s + Math.abs(v) * size[k], 0)) as Vec3;
}

/** Primera rotación con la que `size` cabe en `usable` (o `null`). */
export function fittingRotation(size: Vec3, usable: Vec3, allowRotation: boolean): Vec3 | null {
  const eps = 1e-6;
  for (const rot of allowRotation ? ROTATIONS : ROTATIONS.slice(0, 1)) {
    const s = rotatedSize(size, rot);
    if (s[0] <= usable[0] + eps && s[1] <= usable[1] + eps && s[2] <= usable[2] + eps) return rot;
  }
  return null;
}
