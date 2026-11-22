/**
 * @file src/engine/split/assemblyConnectors.ts
 * @description Reglas de los conectores en la validación de armado:
 * - Dirección de entrada: espiga, pasador y solape solo entran a lo largo de la normal del plano
 *   (hacia la vecina); la cola de milano desliza por su eje propio (el espesor del trapecio, ver
 *   `cutConnectorSolid.ts`: corte en X o Z → desliza en Y; corte en Y → desliza en Z).
 * - Choques: cada conector es un cilindro (radio de huella con holgura) del anclaje al fondo del
 *   alojamiento; dos conectores chocan si la distancia entre ejes menos sus radios es menor que la
 *   pared mínima. La pared hasta la superficie se mide contra los triángulos de las dos piezas que no
 *   son del propio conector ni de la cara de unión.
 * - Firmeza (regla geométrica, no simulación): radio recomendado =
 *   max(mínimo absoluto, √(fracción·área/(π·n)), factor·medida mayor de la pieza más chica), acotado
 *   al máximo; ver `ASSEMBLY_LIMITS` en `operationLimits.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { connectorFootprintRadius } from '../cutConnectorLayout';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import type { AssemblyDirection, AssemblyJointInput, ConnectorClash } from './assemblyTypes';
import { holeDepth } from './splitJoints';
import { layoutType, looseDowelHoleDepth } from './splitLooseDowel';
import type { SplitAxis, SplitConnectorOptions, SplitConnectorType } from './splitTypes';

const AXIS_INDEX: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };
const DOVETAIL_SLIDE: Record<SplitAxis, SplitAxis> = { x: 'y', y: 'z', z: 'y' };

/** Si la unión restringe la dirección de entrada (tiene conector o solape). */
export const restricts = (j: AssemblyJointInput) => (j.kind === 'connector' || j.kind === 'lap') && j.connector !== null;

/** Direcciones con que `part` puede entrar hacia su vecina de la unión `j` (ya puesta). */
export function jointDirections(j: AssemblyJointInput, part: number): AssemblyDirection[] {
  if (j.connector?.type === 'dovetail' && j.kind === 'connector') {
    const s = DOVETAIL_SLIDE[j.axis];
    return [`+${s}`, `-${s}`] as AssemblyDirection[];
  }
  // a (lado −) entra moviéndose a +eje; b (lado +) a −eje
  return [`${part === j.a.part ? '+' : '-'}${j.axis}` as AssemblyDirection];
}

/**
 * Tipo de conector alternativo con el que `part` puede entrar con la dirección `d` en la unión `j`, o
 * `null`: la cola de milano desliza por su eje propio; espiga y tarugo, por la normal del plano.
 * Pasar a cola de milano exige una ranura pasante que abre la superficie exterior: solo con
 * `allowSurface` (decisión del usuario). Pasar de cola de milano a espiga no la altera.
 */
export function alternativeType(j: AssemblyJointInput, part: number, d: AssemblyDirection, allowSurface = true): SplitConnectorType | null {
  if (j.kind !== 'connector' || !j.connector || j.connector.type === 'lap') return null;
  if (j.connector.type === 'dovetail') {
    const normal = `${part === j.a.part ? '+' : '-'}${j.axis}`;
    return d === normal ? 'dowel' : null;
  }
  return allowSurface && d[1] === DOVETAIL_SLIDE[j.axis] ? 'dovetail' : null;
}

/** Radio de huella con holgura del conector de una unión. */
export function connectorRadius(c: SplitConnectorOptions): number {
  if (c.type === 'lap') return 0;
  return connectorFootprintRadius(layoutType(c.type), c.size, c.tolerance);
}

/** Conector como cápsula: eje del anclaje al fondo del alojamiento y radio de huella con holgura. */
export interface Capsule {
  joint: string;
  index: number;
  p: Vec3;
  q: Vec3;
  r: number;
  axis: SplitAxis;
  plane: number;
  parts: [number, number];
  /**
   * Cola de milano: eje (índice) por el que desliza. Su ranura se abre a lo largo de ese eje (pasante si
   * el usuario aceptó el cambio de superficie), así que esas caras son del propio conector, no pared.
   */
  slide?: number;
}

/** Cápsulas de los conectores de las uniones (las de pegar y solape no tienen). */
export function capsules(joints: AssemblyJointInput[]): Capsule[] {
  const out: Capsule[] = [];
  for (const j of joints) {
    if (j.kind !== 'connector' || !j.connector || j.connector.type === 'lap') continue;
    const a = AXIS_INDEX[j.axis];
    const r = connectorRadius(j.connector);
    const reach = holeDepth(j.connector);
    j.connectorCenters.forEach((c, index) => {
      const p = [...c] as Vec3;
      const q = [...c] as Vec3;
      // Tarugo suelto: agujero a ambos lados del plano
      p[a] -= j.connector!.type === 'loose-dowel' ? looseDowelHoleDepth(j.connector!) : 0.5;
      q[a] += reach;
      const slide = j.connector!.type === 'dovetail' ? AXIS_INDEX[DOVETAIL_SLIDE[j.axis]] : undefined;
      out.push({ joint: j.label, index, p, q, r, axis: j.axis, plane: j.position, parts: [j.a.part, j.b.part], slide });
    });
  }
  return out;
}

const sub = (u: Vec3, v: Vec3): Vec3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Distancia entre los segmentos p1q1 y p2q2 (Ericson, Real-Time Collision Detection §5.1.9). */
export function segmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a < 1e-12 && e < 1e-12) return Math.sqrt(dot(r, r));
  if (a < 1e-12) t = clamp01(f / e);
  else {
    const c = dot(d1, r);
    if (e < 1e-12) s = clamp01(-c / a);
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const c1: Vec3 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2: Vec3 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  const w = sub(c1, c2);
  return Math.sqrt(dot(w, w));
}

/** Distancia de un punto a un triángulo (punto más cercano, Ericson §5.1.5). */
function pointTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  const near = (q: Vec3) => Math.sqrt(dot(sub(p, q), sub(p, q)));
  if (d1 <= 0 && d2 <= 0) return near(a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return near(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return near([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return near(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return near([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return near([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]);
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return near([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** Pared libre de un conector hasta la superficie de sus dos piezas (mm), sin contar sus propias caras. */
export function exteriorWall(cap: Capsule, world: Float64Array[], meshes: MeshData[], wall: number): number {
  const a = AXIS_INDEX[cap.axis];
  const reach = cap.r + wall + 1;
  const lo = [0, 1, 2].map((i) => Math.min(cap.p[i], cap.q[i]) - reach);
  const hi = [0, 1, 2].map((i) => Math.max(cap.p[i], cap.q[i]) + reach);
  const samples: Vec3[] = [0.15, 0.5, 0.85].map((t) => [0, 1, 2].map((i) => cap.p[i] + (cap.q[i] - cap.p[i]) * t) as Vec3);
  let best = Infinity;
  for (const part of cap.parts) {
    const w = world[part];
    const idx = meshes[part].indices;
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
      const v = [A, B, C].map((o) => [w[o], w[o + 1], w[o + 2]] as Vec3);
      if ([0, 1, 2].some((i) => Math.max(v[0][i], v[1][i], v[2][i]) < lo[i] || Math.min(v[0][i], v[1][i], v[2][i]) > hi[i])) continue;
      // Cara de unión (coplanar al plano) y caras del propio conector (dentro de su cilindro y tramo)
      if (v.every((p) => Math.abs(p[a] - cap.plane) < 0.05)) continue;
      const own = v.every((p) => {
        const along = p[a];
        const radial = Math.hypot(...[0, 1, 2].filter((i) => i !== a && i !== cap.slide).map((i) => p[i] - cap.p[i]));
        return radial <= cap.r + 0.35 && along >= Math.min(cap.p[a], cap.q[a]) - 0.35 && along <= Math.max(cap.p[a], cap.q[a]) + 0.35;
      });
      if (own) continue;
      for (const s of samples) best = Math.min(best, pointTriangle(s, v[0], v[1], v[2]) - cap.r);
    }
  }
  return best;
}

/** Conectores que chocan entre sí o quedan con menos pared que `wall` hasta la superficie. */
export function connectorClashes(
  joints: AssemblyJointInput[],
  world: Float64Array[] | null,
  meshes: MeshData[],
  wall: number,
): ConnectorClash[] {
  const caps = capsules(joints);
  const out: ConnectorClash[] = [];
  for (let i = 0; i < caps.length; i++) {
    for (let k = i + 1; k < caps.length; k++) {
      const u = caps[i], v = caps[k];
      const d = segmentDistance(u.p, u.q, v.p, v.q) - u.r - v.r;
      if (d < wall) out.push({ joint: u.joint, index: u.index, other: { joint: v.joint, index: v.index }, distanceMm: d, requiredMm: wall });
    }
  }
  if (world) {
    for (const c of caps) {
      const d = exteriorWall(c, world, meshes, wall);
      if (d < wall - 1e-3) out.push({ joint: c.joint, index: c.index, other: null, distanceMm: d, requiredMm: wall });
    }
  }
  return out;
}

/**
 * Radio máximo al que la firmeza activa puede llevar un conector pedido de radio `requestedMm` y
 * profundidad `depthMm` en una cara cuya isla más ancha mide `widthMm` (2·área/perímetro):
 * max(pedido, min(máximo recomendado, `maxReinforceWidthFraction`·ancho, `maxReinforceGrowth`·pedido,
 * profundidad)). Así un tubo de pared 12 no pasa de 3 mm, un tarugo de 3 mm no pasa de 6 y ninguno
 * queda más ancho que largo. Lo pedido por el usuario nunca se recorta aquí (si no cabe, lo reduce la
 * ubicación de conectores, que exige la pared mínima).
 */
export function reinforcementCap(requestedMm: number, widthMm: number, depthMm = Infinity): number {
  const L = ASSEMBLY_LIMITS;
  const cap = Math.min(L.maxRecommendedRadiusMm, L.maxReinforceWidthFraction * widthMm, L.maxReinforceGrowth * requestedMm, depthMm);
  return Math.max(requestedMm, cap);
}

/** Radio recomendado del conector de una unión según su área de contacto y la pieza que sostiene. */
export function recommendedConnectorRadius(contactAreaMm2: number, count: number, pieceMaxDimMm: number): number {
  const L = ASSEMBLY_LIMITS;
  const byArea = Math.sqrt((L.minConnectorAreaFraction * contactAreaMm2) / (Math.PI * Math.max(1, count)));
  const bySize = L.connectorRadiusPerPieceMm * pieceMaxDimMm;
  return Math.min(L.maxRecommendedRadiusMm, Math.max(L.minConnectorRadiusMm, byArea, bySize));
}
