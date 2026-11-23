/**
 * @file src/engine/edgedSolids.ts
 * @description Sólidos con aristas redondeadas o achaflanadas, construidos de forma exacta:
 * - Planta poligonal convexa (Caja, Prisma): casco convexo (`Manifold.hull`) de anillos, cada uno la
 *   sección exacta del sólido a una altura (polígono desplazado hacia adentro, con esquinas en arco
 *   o cortadas). Las caras planas quedan donde estaban: las medidas exteriores no cambian.
 * - Revolución (Cilindro, Tubo): perfil (r, z) con esquinas en arco o cortadas, `revolve`.
 * Los arcos usan el criterio de segmentos de Manifold (`getCircularSegments`: 10° o 1 mm de cuerda,
 * el mismo de sus círculos por defecto) con al menos 2 tramos por cuarto de vuelta.
 * Coordenadas locales Z arriba; quien llama rota a Y arriba como el resto de primitivas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel, Vec2, Vec3 } from 'manifold-3d';
import type { ResolvedEdges } from './primitiveEdges';

/** Tramos de arco por cuarto de vuelta para un radio `e` (mm). */
export function edgeQuarterSegments(wasm: ManifoldToplevel, e: number): number {
  return Math.max(2, Math.ceil(wasm.getCircularSegments(e) / 4));
}

type Poly = Vec2[];

/** Contorno convexo desplazado `d` hacia adentro, con esquinas vivas (mismas direcciones de caras). */
export function insetPolygon(poly: Poly, d: number): Poly {
  if (d === 0) return poly.map(([x, y]) => [x, y] as Vec2);
  const n = poly.length;
  return poly.map((v, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const n1 = inwardNormal(prev, v);
    const n2 = inwardNormal(v, next);
    // Vértice nuevo = v + d·(n1 + n2)/(1 + n1·n2): intersección de las dos rectas desplazadas.
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [v[0] + k * (n1[0] + n2[0]), v[1] + k * (n1[1] + n2[1])] as Vec2;
  });
}

/** Normal hacia adentro de la arista a→b de un polígono antihorario. */
function inwardNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

/**
 * Contorno `core` (convexo, antihorario) agrandado `rho` con esquinas en arco: en cada vértice, arco
 * de la normal exterior de la arista entrante a la de la saliente, en pasos de `segPerTurn` por vuelta.
 */
function roundedPolygon(core: Poly, rho: number, segPerTurn: number): Poly {
  if (rho <= 0) return core;
  const n = core.length;
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const v = core[i];
    const a0 = Math.atan2(...outwardXY(core[(i - 1 + n) % n], v));
    let a1 = Math.atan2(...outwardXY(v, core[(i + 1) % n]));
    while (a1 < a0) a1 += 2 * Math.PI;
    const steps = Math.max(1, Math.ceil(((a1 - a0) / (2 * Math.PI)) * segPerTurn - 1e-9));
    for (let s = 0; s <= steps; s++) {
      const a = a0 + ((a1 - a0) * s) / steps;
      out.push([v[0] + rho * Math.cos(a), v[1] + rho * Math.sin(a)]);
    }
  }
  return out;
}

/** (y, x) de la normal exterior, en el orden de `Math.atan2`. */
function outwardXY(a: Vec2, b: Vec2): [number, number] {
  const nIn = inwardNormal(a, b);
  return [-nIn[1], -nIn[0]];
}

/** Esquinas cortadas a `s` mm de cada vértice a lo largo de sus dos aristas. */
function chamferedPolygon(poly: Poly, s: number): Poly {
  const n = poly.length;
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const v = poly[i];
    for (const other of [poly[(i - 1 + n) % n], poly[(i + 1) % n]]) {
      const dx = other[0] - v[0], dy = other[1] - v[1];
      const len = Math.hypot(dx, dy) || 1;
      out.push([v[0] + (dx / len) * s, v[1] + (dy / len) * s]);
    }
  }
  return out;
}

/** Ángulos de 0 a π/2 en `q` tramos. */
const quarterAngles = (q: number) => Array.from({ length: q + 1 }, (_, j) => (Math.PI / 2) * (j / q));

/**
 * Sólido de planta `footprint` (convexa, antihoraria, en XY) y altura `h` (Z ∈ [0, h]) con los
 * bordes `edges`. Devuelve un Manifold nuevo (el llamador lo libera).
 */
export function buildEdgedPrism(wasm: ManifoldToplevel, footprint: Poly, h: number, edges: ResolvedEdges): Manifold {
  const e = edges.size;
  const segPerTurn = 4 * edgeQuarterSegments(wasm, e);
  const q = segPerTurn / 4;
  const rings: Array<{ z: number; poly: Poly }> = [];
  const ring = (z: number, poly: Poly) => rings.push({ z, poly });
  const core = insetPolygon(footprint, e);

  if (edges.scope === 'vertical') {
    const plan = edges.style === 'round' ? roundedPolygon(core, e, segPerTurn) : chamferedPolygon(footprint, e);
    ring(0, plan);
    ring(h, plan);
  } else if (edges.scope === 'top') {
    ring(0, footprint);
    if (edges.style === 'round') {
      // Sección a la altura h − e + e·sen ψ: contorno desplazado e·(1 − cos ψ) hacia adentro.
      for (const psi of quarterAngles(q)) ring(h - e + e * Math.sin(psi), insetPolygon(footprint, e * (1 - Math.cos(psi))));
    } else {
      ring(h - e, footprint);
      ring(h, core);
    }
  } else if (edges.style === 'round') {
    // Minkowski del núcleo con una esfera de radio e: anillos de radio e·cos ψ arriba y abajo.
    for (const psi of quarterAngles(q)) {
      const plan = roundedPolygon(core, e * Math.cos(psi), segPerTurn);
      ring(h - e + e * Math.sin(psi), plan);
      ring(e - e * Math.sin(psi), plan);
    }
  } else {
    const mid = chamferedPolygon(footprint, e);
    ring(0, core);
    ring(e, mid);
    ring(h - e, mid);
    ring(h, core);
  }

  const points: Vec3[] = [];
  for (const { z, poly } of rings) for (const [x, y] of poly) points.push([x, y, z]);
  return wasm.Manifold.hull(points);
}

/**
 * Perfil (r, z) de un cilindro (`innerR` = 0) o tubo con esquinas redondeadas o achaflanadas:
 * exteriores siempre; interiores solo en el tubo; las de abajo solo con alcance `all`.
 */
export function edgedRevolveProfile(innerR: number, outerR: number, h: number, edges: ResolvedEdges, q: number): Poly {
  const e = edges.size;
  const bottom = edges.scope === 'all';
  const tube = innerR > 0;
  const pts: Poly = [];
  const corner = (cx: number, cy: number, round: boolean, center: Vec2, a0: number, chamferPts: [Vec2, Vec2]) => {
    if (!round) {
      pts.push([cx, cy]);
      return;
    }
    if (edges.style === 'chamfer') {
      pts.push(chamferPts[0], chamferPts[1]);
      return;
    }
    for (let s = 0; s <= q; s++) {
      const a = a0 + (Math.PI / 2) * (s / q);
      pts.push([center[0] + e * Math.cos(a), center[1] + e * Math.sin(a)]);
    }
  };
  // Antihorario en (r, z): abajo-adentro → abajo-afuera → arriba-afuera → arriba-adentro.
  corner(innerR, 0, tube && bottom, [innerR + e, e], Math.PI, [[innerR, e], [innerR + e, 0]]);
  corner(outerR, 0, bottom, [outerR - e, e], -Math.PI / 2, [[outerR - e, 0], [outerR, e]]);
  corner(outerR, h, true, [outerR - e, h - e], 0, [[outerR, h - e], [outerR - e, h]]);
  corner(innerR, h, tube, [innerR + e, h - e], Math.PI / 2, [[innerR + e, h], [innerR, h - e]]);
  return pts;
}

/** Cilindro o tubo con bordes por revolución del perfil (eje Z, base en z = 0). */
export function buildEdgedRevolution(
  wasm: ManifoldToplevel, innerR: number, outerR: number, h: number, segments: number, edges: ResolvedEdges,
): Manifold {
  const profile = edgedRevolveProfile(innerR, outerR, h, edges, edgeQuarterSegments(wasm, edges.size));
  const cs = new wasm.CrossSection([profile], 'Positive');
  try {
    return cs.revolve(segments, 360);
  } finally {
    cs.delete();
  }
}

/** Planta de una caja centrada (antihoraria). */
export function rectangleFootprint(w: number, d: number): Poly {
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
}

/** Planta del prisma regular igual a `Manifold.cylinder(h, r, r, sides)`: vértice inicial en ángulo 0. */
export function regularFootprint(r: number, sides: number): Poly {
  return Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides;
    return [r * Math.cos(a), r * Math.sin(a)] as Vec2;
  });
}
