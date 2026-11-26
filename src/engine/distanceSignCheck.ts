/**
 * @file src/engine/distanceSignCheck.ts
 * @description Detecta mallas cerradas que se autointersecan (una sola cáscara que se cruza a sí misma,
 * frecuente en bustos de terceros tras "reparar"): ahí el signo por pseudo-normales se contradice con el
 * número de vueltas y el offset interior sale con regiones de signo erróneo. Si hay contradicción, el
 * campo debe usar el signo por número de vueltas (`DistanceSignMode = 'winding'`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshDistanceField } from './meshDistance';

/** Muestras por defecto: barato frente al level-set (~250 000 evaluaciones). */
const DEFAULT_SAMPLES = 3000;

/**
 * Cuenta puntos (pseudoaleatorios y reproducibles, dentro de la caja) donde el signo por pseudo-normales
 * contradice al número de vueltas. Se ignoran los puntos casi sobre la superficie (ambiguos por redondeo).
 */
export function countSignConflicts(field: MeshDistanceField, samples = DEFAULT_SAMPLES): number {
  const base = field.signMode === 'pseudoNormal' ? field : field.withSignMode('pseudoNormal');
  const [x0, y0, z0, x1, y1, z1] = base.bounds;
  const eps = 1e-4 * Math.max(1e-9, Math.hypot(x1 - x0, y1 - y0, z1 - z0));
  let seed = 12345;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let conflicts = 0;
  for (let i = 0; i < samples; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const z = z0 + rnd() * (z1 - z0);
    const d = base.signedDistance(x, y, z);
    if (!Number.isFinite(d) || Math.abs(d) < eps) continue;
    if (d > 0 !== base.insideByWinding(x, y, z)) conflicts++;
  }
  return conflicts;
}

/**
 * Devuelve el campo con el signo adecuado: el mismo si es coherente, o su variante por número de vueltas
 * si se detectan contradicciones (malla autointersecada).
 */
export function consistentSignField(field: MeshDistanceField, samples = DEFAULT_SAMPLES): MeshDistanceField {
  if (field.signMode === 'winding') return field;
  // Dos o más: una sola contradicción puede ser un rayo ambiguo en las cuatro direcciones.
  return countSignConflicts(field, samples) >= 2 ? field.withSignMode('winding') : field;
}
