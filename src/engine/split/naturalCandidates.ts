/**
 * @file src/engine/split/naturalCandidates.ts
 * @description Candidatos a plano de corte en los estrechamientos naturales de una figura (cuello,
 * cintura, muñeca, tobillo): mínimos locales marcados del perfil de área de la sección
 * (`naturalProfile.ts`) en cada eje. El perfil se suaviza, cada mínimo se mide contra el mayor
 * valor a cada lado dentro de una ventana (como la prominencia topográfica) y se queda solo si la
 * sección es claramente más chica que ambos lados. Función pura: no corta ni construye secciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { samplePosition, sectionProfile, type SectionProfile } from './naturalProfile';
import type { SplitAxis } from './splitTypes';

/** Plano candidato en un estrechamiento. */
export interface NaturalCutCandidate {
  axis: SplitAxis;
  /** `neck` = mínimo entre dos lados más anchos (cuello, cintura); `step` = el lado delgado de un escalón (cadera, hombro). */
  kind: 'neck' | 'step';
  /** Coordenada mundial del plano (mm). */
  position: number;
  /** Área de la sección en el estrechamiento (mm²). */
  sectionAreaMm2: number;
  /** Cuán marcado es: 1 − área / menor de los dos lados (0 = liso, 1 = hilo). */
  depth: number;
  /** Área de referencia del lado más chico (mm²). */
  sideAreaMm2: number;
}

export interface NaturalCandidateOptions {
  /** Ejes a analizar (por defecto los tres). */
  axes?: SplitAxis[];
  /** Resolución del perfil (mm por muestra, por defecto 1; se acota a 64–600 muestras). */
  resolutionMm?: number;
  /** Mínima profundidad para ser candidato (por defecto 0,3: la sección al menos 30 % menor que ambos lados). */
  minDepth?: number;
  /** Ventana de comparación a cada lado, como fracción del largo (por defecto 0,25). */
  windowFrac?: number;
  /** Zona excluida en cada extremo, como fracción del largo (por defecto 0,04). */
  endFrac?: number;
  /** Tope de candidatos por eje (por defecto 8, los más marcados). */
  maxPerAxis?: number;
  isCancelled?: () => boolean;
}

const AXES: SplitAxis[] = ['x', 'y', 'z'];

/** Media móvil centrada de radio `r` muestras. */
function smooth(src: Float64Array, r: number): Float64Array {
  if (r <= 0) return src.slice();
  const n = src.length;
  const out = new Float64Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + src[i];
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - r);
    const hi = Math.min(n - 1, i + r);
    out[i] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
  }
  return out;
}

/** Peso relativo de un escalón frente a un mínimo (un escalón es un sitio de corte menos claro). */
const STEP_FACTOR = 0.7;

/**
 * Escalones: un tramo parejo y delgado que de golpe se ensancha (piernas que entran a la cadera, un
 * brazo que entra al torso). El corte va en el último punto parejo del lado delgado. `depth` =
 * (1 − delgado / ancho) · `STEP_FACTOR`.
 */
function stepCandidates(p: SectionProfile, a: Float64Array, end: number, minDepth: number, peak: number): NaturalCutCandidate[] {
  const n = a.length;
  const d = Math.max(3, Math.round(n * 0.08));
  const out: NaturalCutCandidate[] = [];
  for (const dir of [1, -1] as const) {
    let run: { i: number; depth: number; side: number } | null = null;
    const flush = () => {
      if (run) out.push({ axis: p.axis, kind: 'step', position: samplePosition(p, run.i), sectionAreaMm2: p.area[run.i], depth: run.depth, sideAreaMm2: run.side });
      run = null;
    };
    // Recorre en el sentido del ensanche: el último punto que califica es el más cercano al escalón
    for (let s = 0; s < n; s++) {
      const i = dir === 1 ? s : n - 1 - s;
      let ok = i >= end && i < n - end && a[i] > 0.02 * peak;
      let wide = 0;
      if (ok) {
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k <= d; k++) {
          const b = i - dir * k;
          if (b < 0 || b >= n) { ok = false; break; }
          lo = Math.min(lo, a[b]);
          hi = Math.max(hi, a[b]);
        }
        ok = ok && hi <= 1.2 * lo;
        for (let k = 1; ok && k <= d; k++) {
          const f = i + dir * k;
          if (f >= 0 && f < n) wide = Math.max(wide, a[f]);
        }
      }
      const depth = ok && wide > 0 ? (1 - a[i] / wide) * STEP_FACTOR : 0;
      if (depth >= minDepth) run = { i, depth, side: wide };
      else flush();
    }
    flush();
  }
  return out;
}

/** Candidatos de un perfil ya medido. */
export function candidatesFromProfile(p: SectionProfile, o: NaturalCandidateOptions = {}): NaturalCutCandidate[] {
  const n = p.area.length;
  if (n < 8 || !(p.step > 0)) return [];
  const minDepth = o.minDepth ?? 0.3;
  const win = Math.max(3, Math.round(n * (o.windowFrac ?? 0.25)));
  const end = Math.max(1, Math.round(n * (o.endFrac ?? 0.04)));
  const a = smooth(p.area, Math.max(1, Math.round(n / 120)));
  const peak = Math.max(...a);
  const found: NaturalCutCandidate[] = [];
  for (let i = end; i < n - end; i++) {
    // Mínimo local (meseta: el primer punto de la meseta)
    if (!(a[i] <= a[i - 1] && a[i] < a[i + 1])) continue;
    if (a[i - 1] === a[i]) continue;
    let left = 0;
    for (let k = Math.max(0, i - win); k < i; k++) left = Math.max(left, a[k]);
    let right = 0;
    for (let k = i + 1; k <= Math.min(n - 1, i + win); k++) right = Math.max(right, a[k]);
    const side = Math.min(left, right);
    // Sección vacía (hueco entre dos cuerpos) o lados despreciables: no es un estrechamiento
    if (!(side > 0.02 * peak) || !(a[i] > 0)) continue;
    const depth = 1 - a[i] / side;
    if (depth < minDepth) continue;
    // Cuello de fondo plano (un cilindro): el plano va al medio del tramo que sigue casi igual de delgado
    let lo = i;
    let hi = i;
    while (lo > end && a[lo - 1] <= 1.1 * a[i]) lo--;
    while (hi < n - end - 1 && a[hi + 1] <= 1.1 * a[i]) hi++;
    const mid = Math.round((lo + hi) / 2);
    found.push({ axis: p.axis, kind: 'neck', position: samplePosition(p, mid), sectionAreaMm2: p.area[mid], depth, sideAreaMm2: side });
  }
  found.push(...stepCandidates(p, a, end, minDepth, peak));
  // Mínimos muy cercanos (ruido del suavizado): queda el más marcado de cada grupo
  found.sort((x, y) => y.depth - x.depth);
  const kept: NaturalCutCandidate[] = [];
  const gap = Math.max(2 * p.step, (p.max - p.min) * 0.03);
  for (const c of found) {
    if (kept.every((k) => Math.abs(k.position - c.position) >= gap)) kept.push(c);
    if (kept.length >= (o.maxPerAxis ?? 8)) break;
  }
  return kept.sort((x, y) => x.position - y.position);
}

/** Cantidad de muestras para un largo dado. */
export function profileSamples(lengthMm: number, resolutionMm = 1): number {
  return Math.min(600, Math.max(64, Math.round(lengthMm / Math.max(0.05, resolutionMm))));
}

/**
 * Candidatos de corte en los estrechamientos de la malla (mundo, mm), por eje y ordenados por
 * posición. Lineal en triángulos: para 500 mil triángulos y tres ejes, unos cientos de ms.
 */
export function naturalCutCandidates(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  o: NaturalCandidateOptions = {},
): { candidates: NaturalCutCandidate[]; profiles: SectionProfile[] } {
  const profiles: SectionProfile[] = [];
  const candidates: NaturalCutCandidate[] = [];
  for (const axis of o.axes ?? AXES) {
    const ai = AXES.indexOf(axis);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = ai; i < positions.length; i += 3) {
      if (positions[i] < lo) lo = positions[i];
      if (positions[i] > hi) hi = positions[i];
    }
    const p = sectionProfile(positions, indices, axis, profileSamples(hi - lo, o.resolutionMm), o.isCancelled);
    profiles.push(p);
    candidates.push(...candidatesFromProfile(p, o));
  }
  return { candidates, profiles };
}
