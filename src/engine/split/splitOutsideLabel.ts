/**
 * @file src/engine/split/splitOutsideLabel.ts
 * @description Marca de pareja en la cara EXTERIOR de las dos piezas, junto al borde de la unión,
 * para cuando la cara de unión es demasiado estrecha (pared delgada). Se prueban los bordes más largos
 * del contorno exterior de la sección de contacto: en el punto medio del borde se arma un plano
 * tangente a la pared (normal = normal hacia afuera del borde) y el texto se graba ahí, derecho con
 * "arriba" = +eje de la unión, a un lado del plano en cada pieza (más allá del solape en la alta). Se
 * acepta si el texto queda casi todo dentro del material y el punto frente a él está fuera de la pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold, ManifoldToplevel, Mat4 } from 'manifold-3d';
import type { Vec3 } from '../../types/kura';
import { buildTextCrossSection } from '../text/textCrossSection';
import { planeUVToWorld } from './splitLabels';
import { orientForAxis } from './splitSections';
import type { SplitAxis } from './splitTypes';

const UP: Record<SplitAxis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const CANDIDATES = 8;

export interface OutsideLabelInput {
  text: string;
  axis: SplitAxis;
  coord: number;
  /** Sección de contacto orientada (u, v). No se libera. */
  contact: CrossSection;
  low: Manifold;
  high: Manifold;
  /** Separación del texto al plano en la pieza alta (alto del solape + 1 si lo hay). */
  highGapMm: number;
  depthMm: number;
  heightMm: number;
}

export interface OutsideLabelSolids {
  forLow: Manifold;
  forHigh: Manifold;
  heightMm: number;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Bordes del contorno exterior (antihorario) de mayor a menor largo: punto medio y normal (u, v). */
function outerEdges(contact: CrossSection): Array<{ mid: [number, number]; n: [number, number]; len: number }> {
  const out: Array<{ mid: [number, number]; n: [number, number]; len: number }> = [];
  for (const poly of contact.toPolygons() as Array<Array<[number, number]>>) {
    let area2 = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area2 += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    if (area2 <= 0) continue; // agujero
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const dx = poly[i][0] - poly[j][0];
      const dy = poly[i][1] - poly[j][1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      out.push({ mid: [(poly[i][0] + poly[j][0]) / 2, (poly[i][1] + poly[j][1]) / 2], n: [dy / len, -dx / len], len });
    }
  }
  return out.sort((a, b) => b.len - a.len);
}

interface SurfaceFrame {
  o: Vec3;
  t: Vec3;
  u: Vec3;
  n: Vec3;
  /** Punto 1,2 mm frente a la cara (debe quedar fuera de la pieza). */
  front: Vec3;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Punto del contorno de la sección en `c` más cercano a `uv`, entre los bordes que miran hacia `n`. */
function nearestBoundary(oriented: Manifold, c: number, uv: [number, number], n: [number, number]): [number, number] | null {
  const cs = oriented.slice(c);
  const polys = cs.toPolygons() as Array<Array<[number, number]>>;
  cs.delete();
  let best: [number, number] | null = null;
  let bestD = 25;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const dx = poly[i][0] - ax;
      const dy = poly[i][1] - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-12) continue;
      const len = Math.sqrt(len2);
      if ((dy / len) * n[0] - (dx / len) * n[1] < 0.5) continue; // no mira hacia afuera por este lado
      const t = Math.max(0, Math.min(1, ((uv[0] - ax) * dx + (uv[1] - ay) * dy) / len2));
      const p: [number, number] = [ax + t * dx, ay + t * dy];
      const d = Math.hypot(p[0] - uv[0], p[1] - uv[1]);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

/**
 * Marco tangente a la pared entre las secciones `c0` y `c1` (abajo y arriba del texto): sigue la
 * inclinación real de la pared respecto del eje (un plano oblicuo a un tubo la tiene).
 */
function surfaceFrame(oriented: Manifold, axis: SplitAxis, e: { mid: [number, number]; n: [number, number] }, c0: number, c1: number, n2: Vec3, up: Vec3): SurfaceFrame | null {
  const p0 = nearestBoundary(oriented, c0, e.mid, e.n);
  const p1 = nearestBoundary(oriented, c1, e.mid, e.n);
  if (!p0 || !p1) return null;
  const w0 = planeUVToWorld(axis, p0[0], p0[1], c0);
  const w1 = planeUVToWorld(axis, p1[0], p1[1], c1);
  const u = unit(sub(w1, w0));
  if (dot(u, up) < 0.7) return null;
  const n = unit(sub(n2, u.map((x) => x * dot(n2, u)) as Vec3));
  const t = cross(u, n);
  const o: Vec3 = [(w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2, (w0[2] + w1[2]) / 2];
  return { o, t, u, n, front: [o[0] + n[0] * 1.2, o[1] + n[1] * 1.2, o[2] + n[2] * 1.2] };
}

/** Texto extruido en el marco (t, u, n) con origen `o`: ocupa n ∈ [−depth, +0,5]. */
function placeText(text: CrossSection, depth: number, f: SurfaceFrame): Manifold {
  const { t, u, n, o } = f;
  const ex = text.extrude(depth + 0.5);
  const shifted = ex.translate([0, 0, -depth]);
  ex.delete();
  const m: Mat4 = [t[0], t[1], t[2], 0, u[0], u[1], u[2], 0, n[0], n[1], n[2], 0, o[0], o[1], o[2], 1];
  const placed = shifted.transform(m);
  shifted.delete();
  return placed;
}

/** `true` si el texto queda casi todo en el material y frente a él no hay material. */
function engravesSurface(wasm: ManifoldToplevel, piece: Manifold, solid: Manifold, expected: number, front: Vec3): boolean {
  const inter = piece.intersect(solid);
  const v = inter.volume();
  inter.delete();
  if (v < 0.6 * expected) return false;
  const probe = wasm.Manifold.cube([0.4, 0.4, 0.4], true).translate(front);
  const hit = piece.intersect(probe);
  const blocked = hit.volume() > 1e-6;
  hit.delete();
  probe.delete();
  return !blocked;
}

/** Sólidos de grabado exterior para ambas piezas, o `null` si no cabe en ningún borde probado. */
export async function buildOutsideLabel(wasm: ManifoldToplevel, input: OutsideLabelInput): Promise<OutsideLabelSolids | null> {
  const unit = await buildTextCrossSection(wasm, input.text, { size: 1, align: 'center' });
  const ub = unit.bounds();
  const h = ub.max[1] - ub.min[1];
  const scale = input.heightMm / (h || 1);
  const text = unit.translate([-(ub.max[0] + ub.min[0]) / 2, -(ub.max[1] + ub.min[1]) / 2]).scale([scale, scale]);
  unit.delete();
  const tb = text.bounds();
  const halfW = (tb.max[0] - tb.min[0]) / 2;
  const expected = text.area() * input.depthMm;
  const u = UP[input.axis];
  const lowO = orientForAxis(input.low, input.axis);
  const highO = orientForAxis(input.high, input.axis);
  try {
    for (const e of outerEdges(input.contact).slice(0, CANDIDATES)) {
      if (halfW * 2 > e.len * 4) continue; // borde demasiado corto para el ancho del texto
      const n2: Vec3 = planeUVToWorld(input.axis, e.n[0], e.n[1], 0);
      const lowFrame = surfaceFrame(lowO.oriented, input.axis, e, input.coord - 1 - input.heightMm, input.coord - 1, n2, u);
      const highFrame = surfaceFrame(highO.oriented, input.axis, e, input.coord + input.highGapMm, input.coord + input.highGapMm + input.heightMm, n2, u);
      if (!lowFrame || !highFrame) continue;
      const lowSolid = placeText(text, input.depthMm, lowFrame);
      if (!engravesSurface(wasm, input.low, lowSolid, expected, lowFrame.front)) {
        lowSolid.delete();
        continue;
      }
      const highSolid = placeText(text, input.depthMm, highFrame);
      if (!engravesSurface(wasm, input.high, highSolid, expected, highFrame.front)) {
        lowSolid.delete();
        highSolid.delete();
        continue;
      }
      return { forLow: lowSolid, forHigh: highSolid, heightMm: input.heightMm };
    }
    return null;
  } finally {
    text.delete();
    if (lowO.owned) lowO.oriented.delete();
    if (highO.owned) highO.oriented.delete();
  }
}
