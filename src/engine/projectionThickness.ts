/**
 * @file src/engine/projectionThickness.ts
 * @description Espesor de material a lo largo de un rayo de proyección: recorre los impactos
 * ordenados contando entradas y salidas por el signo de la normal de cada cara, descarta los
 * impactos rasantes (rayo casi paralelo a la cara, típicos en las paredes de un relieve previo)
 * y une tramos separados por huecos mínimos. Así el control de grabado mide el sólido y no la
 * capa superficial recién agregada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Impacto mínimo del rayo: distancia desde el origen y coseno entre normal saliente y rayo. */
export interface RayHitSample {
  distance: number;
  /** `normal · dir` con la normal saliente de la cara (negativo = entra, positivo = sale). */
  cosToRay: number;
}

/** Coseno bajo el que un impacto se considera rasante y no cuenta como entrada ni salida. */
const GRAZING_COS = 0.08;
/** Huecos menores a esto (mm) entre dos tramos de material se tratan como continuos. */
const GAP_MERGE_MM = 1e-3;
/** Impactos del mismo signo a menos de esto (mm) son el mismo cruce por una arista. */
const SAME_CROSSING_MM = 1e-4;

/**
 * Espesor (mm) del primer tramo macizo que atraviesa el rayo, medido desde el primer impacto.
 * Devuelve `Infinity` si no se puede determinar (sin entrada o sin salida válidas).
 */
export function firstSolidThickness(hits: readonly RayHitSample[]): number {
  const sorted = [...hits].sort((a, b) => a.distance - b.distance);
  let inside = 0;
  let start = Number.NaN;
  let lastExit = Number.NaN;
  let prev: RayHitSample | null = null;
  for (const h of sorted) {
    if (Math.abs(h.cosToRay) < GRAZING_COS) continue;
    // Un rayo que pasa por una arista toca las dos caras vecinas: es un solo cruce
    const sameCrossing =
      prev !== null && h.distance - prev.distance < SAME_CROSSING_MM && Math.sign(h.cosToRay) === Math.sign(prev.cosToRay);
    prev = h;
    if (sameCrossing) continue;
    if (h.cosToRay < 0) {
      if (Number.isNaN(start)) start = h.distance;
      else if (inside === 0 && h.distance - lastExit > GAP_MERGE_MM) break;
      inside++;
    } else if (inside > 0) {
      inside--;
      if (inside === 0) lastExit = h.distance;
    }
  }
  if (Number.isNaN(start) || Number.isNaN(lastExit)) return Infinity;
  return lastExit - start;
}
