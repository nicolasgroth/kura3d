/**
 * @file src/engine/split/splitMagnetBlock.ts
 * @description Imanes cuadrados y rectangulares como unión del corte: orientación del rectángulo en la sección (el
 * largo a lo largo del eje principal de inercia de la isla que lo recibe, para que quepan más), comprobación exacta de
 * la huella real con su pared (rectángulo + pared dentro de la sección, sin solaparse con los vecinos), material bajo
 * el fondo en las esquinas y alojamientos enfrentados con la misma orientación en las dos piezas. El cuadrado es el
 * caso largo = ancho. Coordenadas (u, v) del plano orientado (`worldToPlaneUV`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { pocketDims, type MagnetParams } from '../../core/addons/magnetPocket';
import type { AxisRayMesh } from '../jointRays';
import { orientedToWorld, planeUVToWorld, worldToPlaneUV } from './splitLabels';
import { AXIS_INDEX } from './splitSections';
import type { SplitAxis } from './splitTypes';

/** Cuánto cruza el negativo el plano del corte hacia la otra pieza (sin caras coplanares), mm. */
const MOUTH_CROSS_MM = 0.5;
/** Área (mm²) bajo la que un rectángulo se considera dentro de la sección o sin solaparse. */
const AREA_EPS_MM2 = 1e-3;

type Vec2 = [number, number];

/** Semilados del hueco (imán + holgura): `halfL` a lo largo del largo, `halfW` del ancho. */
export function blockHalves(m: MagnetParams): { halfL: number; halfW: number } {
  const d = pocketDims({ ...m, hidden: false });
  return { halfL: d.widthMm / 2, halfW: d.crossMm / 2 };
}

/**
 * Ángulo (radianes, en el plano u, v) del eje principal de mayor extensión de los contornos `polys` (con agujeros en
 * sentido contrario, como los da `toPolygons`). 0 si la sección no tiene dirección dominante (cuadrada, circular).
 * Vale igual con los contornos en sentido horario: los momentos se normalizan por el signo del área total.
 */
export function principalAngle(polys: ReadonlyArray<ReadonlyArray<Readonly<Vec2>>>): number {
  let a = 0, cx = 0, cy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      const cr = x0 * y1 - x1 * y0;
      a += cr / 2;
      cx += ((x0 + x1) * cr) / 6;
      cy += ((y0 + y1) * cr) / 6;
      sxx += ((x0 * x0 + x0 * x1 + x1 * x1) * cr) / 12;
      syy += ((y0 * y0 + y0 * y1 + y1 * y1) * cr) / 12;
      sxy += ((x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * cr) / 24;
    }
  }
  if (!(Math.abs(a) > 1e-9)) return 0;
  cx /= a;
  cy /= a;
  // Momentos centrales (∫x², ∫y², ∫xy respecto del centroide), con el signo del área: un contorno horario da área y
  // momentos negativos, y sin normalizar el ángulo saldría girado 90° (el eje menor).
  const sign = Math.sign(a);
  const mxx = sign * (sxx - a * cx * cx), myy = sign * (syy - a * cy * cy), mxy = sign * (sxy - a * cx * cy);
  const spread = Math.abs(mxx) + Math.abs(myy);
  if (!(spread > 0) || Math.hypot(mxx - myy, 2 * mxy) < 1e-6 * spread) return 0;
  return 0.5 * Math.atan2(2 * mxy, mxx - myy);
}

/** Punto dentro de los contornos (regla par-impar). */
function inside(polys: ReadonlyArray<ReadonlyArray<Readonly<Vec2>>>, [x, y]: Vec2): boolean {
  let c = false;
  for (const poly of polys) {
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [xi, yi] = poly[i];
      const [xk, yk] = poly[k];
      if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) c = !c;
    }
  }
  return c;
}

/** Ángulo del rectángulo en cada centro: el eje principal de la isla que lo contiene (0 si no cae en ninguna). */
export function blockAngles(islands: CrossSection[], axis: SplitAxis, centers: Vec3[]): number[] {
  const polys = islands.map((isl) => isl.toPolygons() as Vec2[][]);
  const angles = polys.map(principalAngle);
  return centers.map((c) => {
    const uv = worldToPlaneUV(axis, c);
    const k = polys.findIndex((p) => inside(p, uv));
    return k >= 0 ? angles[k] : 0;
  });
}

/** Rectángulo de semilados (hl, hw) girado `angle` y centrado en `uv`. El llamador libera. */
function rect(wasm: ManifoldToplevel, uv: Vec2, hl: number, hw: number, angle: number): CrossSection {
  const sq = wasm.CrossSection.square([2 * hl, 2 * hw], true);
  const turned = sq.rotate((angle * 180) / Math.PI);
  const moved = turned.translate(uv);
  sq.delete();
  turned.delete();
  return moved;
}

/**
 * Si cada hueco rectangular con `wall` de pared cabe entero en la sección (`islands`) y los huecos no se acercan entre
 * sí a menos de `wall` (exacto con polígonos, no por un radio).
 */
export function blocksFit(
  wasm: ManifoldToplevel, islands: CrossSection[], axis: SplitAxis, centers: Vec3[], angles: number[], m: MagnetParams, wall: number,
): boolean {
  const { halfL, halfW } = blockHalves(m);
  const section = wasm.CrossSection.union(islands);
  const own: CrossSection[] = [section];
  try {
    const uvs = centers.map((c) => worldToPlaneUV(axis, c));
    for (let i = 0; i < uvs.length; i++) {
      const outer = rect(wasm, uvs[i], halfL + wall, halfW + wall, angles[i]);
      const out = outer.subtract(section);
      own.push(outer, out);
      if (out.area() > AREA_EPS_MM2) return false;
    }
    const spaced = uvs.map((uv, i) => rect(wasm, uv, halfL + wall / 2, halfW + wall / 2, angles[i]));
    own.push(...spaced);
    for (let i = 0; i < spaced.length; i++) {
      for (let k = i + 1; k < spaced.length; k++) {
        const both = spaced[i].intersect(spaced[k]);
        own.push(both);
        if (both.area() > AREA_EPS_MM2) return false;
      }
    }
    return true;
  } finally {
    for (const h of own) h.delete();
  }
}

/**
 * Material bajo el fondo de cada hueco en las dos piezas: rayos paralelos al eje desde el centro, las cuatro esquinas
 * y los cuatro lados del rectángulo agrandado por la pared (la huella real, no un círculo).
 */
export function blockDepthFits(
  rays: { lo: AxisRayMesh; hi: AxisRayMesh }, axis: SplitAxis, centers: Vec3[], angles: number[], m: MagnetParams, depth: number, wall: number,
): boolean {
  const { halfL, halfW } = blockHalves(m);
  const a = AXIS_INDEX[axis];
  const need = depth + wall;
  const hl = halfL + wall, hw = halfW + wall;
  const offsets: Vec2[] = [[0, 0], [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]];
  return centers.every((p, i) => {
    const cos = Math.cos(angles[i]), sin = Math.sin(angles[i]);
    return offsets.every(([x, y]) => {
      const d = planeUVToWorld(axis, x * cos - y * sin, x * sin + y * cos, 0);
      d[a] = 0;
      const q: Vec3 = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
      return rays.hi.exit(q, a, 1) >= need && rays.lo.exit(q, a, -1) >= need;
    });
  });
}

/**
 * Los dos alojamientos de un imán cuadrado o rectangular en el plano `center[eje]`, con la misma orientación
 * (`angle` en el plano u, v): `low` de plano − profundidad a plano + 0,5 y `high` de plano − 0,5 a plano + profundidad.
 */
export function buildBlockPockets(
  wasm: ManifoldToplevel, axis: SplitAxis, center: Vec3, m: MagnetParams, depth: number, angle: number,
): { low: Manifold; high: Manifold } {
  const { halfL, halfW } = blockHalves(m);
  const box = (from: number, len: number) => {
    const raw = wasm.Manifold.cube([2 * halfL, 2 * halfW, len], true);
    const turned = raw.rotate([0, 0, (angle * 180) / Math.PI]);
    const moved = turned.translate([0, 0, from + len / 2]);
    const world = orientedToWorld(moved, axis);
    const out = world.translate(center);
    [raw, turned, moved, world].forEach((h) => h.delete());
    return out;
  };
  return { low: box(-depth, depth + MOUTH_CROSS_MM), high: box(-MOUTH_CROSS_MM, depth + MOUTH_CROSS_MM) };
}
