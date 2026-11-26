/**
 * @file src/engine/split/naturalProfile.ts
 * @description Perfil de área de la sección transversal de una malla a lo largo de un eje (cuello,
 * cintura, muñeca: mínimos del perfil). Por cada triángulo que cruza el plano se toma el segmento de
 * corte orientado con la normal de la cara y se suma su aporte al área con la fórmula del polígono
 * (teorema de Green), sin construir la sección: O(triángulos + cruces) para todas las muestras a la
 * vez. En una malla cerrada y bien orientada da el área exacta de la sección (huecos restados).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SplitAxis } from './splitTypes';

/** Perfil de sección: `area[i]` y `perimeter[i]` en `min + (i + 0,5)·step` (centro de cada franja). */
export interface SectionProfile {
  axis: SplitAxis;
  min: number;
  max: number;
  step: number;
  /** Área de la sección (mm²) por muestra. */
  area: Float64Array;
  /** Largo total del contorno (mm) por muestra. */
  perimeter: Float64Array;
}

const AXIS_INDEX: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };

/** Coordenada de la muestra `i`. */
export function samplePosition(p: SectionProfile, i: number): number {
  return p.min + (i + 0.5) * p.step;
}

/** Aborta si la señal lo pide (cada cierto número de triángulos). */
export class ProfileCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'ProfileCancelled';
  }
}

/**
 * Perfil de sección de `positions`/`indices` (mundo, mm) en `samples` planos perpendiculares a `axis`.
 * `isCancelled` se consulta cada 32 mil triángulos; si devuelve `true` lanza `ProfileCancelled`.
 */
export function sectionProfile(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  axis: SplitAxis,
  samples: number,
  isCancelled?: () => boolean,
): SectionProfile {
  const a = AXIS_INDEX[axis];
  // (a, u, v) en orden cíclico: el área en el plano (u, v) con la normal +a.
  const u = (a + 1) % 3;
  const v = (a + 2) % 3;
  let min = Infinity;
  let max = -Infinity;
  for (let i = a; i < positions.length; i += 3) {
    const c = positions[i];
    if (c < min) min = c;
    if (c > max) max = c;
  }
  const n = Math.max(1, Math.floor(samples));
  const area = new Float64Array(n);
  const perimeter = new Float64Array(n);
  if (!(max > min)) return { axis, min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0, step: 0, area, perimeter };
  const step = (max - min) / n;
  const tri = indices.length / 3;
  const pa = [0, 0, 0];
  const pu = [0, 0, 0];
  const pv = [0, 0, 0];
  for (let t = 0; t < tri; t++) {
    if (isCancelled && (t & 0x7fff) === 0 && isCancelled()) throw new ProfileCancelled();
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < 3; k++) {
      const o = 3 * indices[3 * t + k];
      pa[k] = positions[o + a];
      pu[k] = positions[o + u];
      pv[k] = positions[o + v];
      if (pa[k] < lo) lo = pa[k];
      if (pa[k] > hi) hi = pa[k];
    }
    // Muestras cuyo plano corta el triángulo
    const i0 = Math.max(0, Math.ceil((lo - min) / step - 0.5));
    const i1 = Math.min(n - 1, Math.floor((hi - min) / step - 0.5));
    if (i1 < i0) continue;
    // Normal de la cara proyectada en (u, v): fija el sentido del segmento (borde exterior antihorario).
    const e1u = pu[1] - pu[0], e1v = pv[1] - pv[0], e1a = pa[1] - pa[0];
    const e2u = pu[2] - pu[0], e2v = pv[2] - pv[0], e2a = pa[2] - pa[0];
    const nu = e1v * e2a - e1a * e2v;
    const nv = e1a * e2u - e1u * e2a;
    for (let i = i0; i <= i1; i++) {
      const s = min + (i + 0.5) * step;
      // Dos puntos donde las aristas cruzan el plano
      let qu0 = 0, qv0 = 0, qu1 = 0, qv1 = 0, found = 0;
      for (let k = 0; k < 3 && found < 2; k++) {
        const k2 = (k + 1) % 3;
        const d0 = pa[k] - s;
        const d1 = pa[k2] - s;
        if ((d0 < 0) === (d1 < 0)) continue;
        const f = d0 / (d0 - d1);
        const cu = pu[k] + f * (pu[k2] - pu[k]);
        const cv = pv[k] + f * (pv[k2] - pv[k]);
        if (found === 0) { qu0 = cu; qv0 = cv; } else { qu1 = cu; qv1 = cv; }
        found++;
      }
      if (found < 2) continue;
      let du = qu1 - qu0;
      let dv = qv1 - qv0;
      // Dirección = â × n (en el plano: (-nv, nu)); si el segmento va al revés, se invierte.
      if (du * -nv + dv * nu < 0) {
        const tu = qu0, tv = qv0;
        qu0 = qu1; qv0 = qv1; qu1 = tu; qv1 = tv;
        du = -du; dv = -dv;
      }
      area[i] += 0.5 * (qu0 * qv1 - qu1 * qv0);
      perimeter[i] += Math.hypot(du, dv);
    }
  }
  for (let i = 0; i < n; i++) area[i] = Math.abs(area[i]);
  return { axis, min, max, step, area, perimeter };
}
