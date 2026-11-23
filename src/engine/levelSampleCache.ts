/**
 * @file src/engine/levelSampleCache.ts
 * @description Caché de muestras del campo de distancia entre extracciones de nivel sobre la MISMA
 * rejilla (el margen adaptativo del ahuecado extrae de nuevo con un nivel algo mayor). Una muestra
 * exacta (|d| < tope) sirve siempre; una recortada al tope sirve si sigue lejos del nivel nuevo
 * (más de una arista de rejilla): por Lipschitz ninguna arista que la toque cruza ese nivel. Con el
 * busto de 325 k triángulos cada extracción eran ~260 k consultas de 35 µs (9 s).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Distancia con signo acotada: exacta si |d| < cap, si no ±cap. */
export type BoundedSample = (x: number, y: number, z: number, cap: number) => number;

export interface LevelSampleCache {
  /** Valor para el nivel `level` con tope `cap` (= nivel + 2 aristas), reutilizando si se puede. */
  sample(x: number, y: number, z: number, level: number, cap: number): number;
  /** Consultas que fueron al campo (pruebas). */
  readonly misses: number;
}

export function createLevelSampleCache(field: BoundedSample, gridEdge: number): LevelSampleCache {
  const values = new Map<string, number>();
  const caps = new Map<string, number>();
  let misses = 0;
  return {
    sample(x, y, z, level, cap) {
      const key = `${x},${y},${z}`;
      const d = values.get(key);
      if (d !== undefined) {
        const storedCap = caps.get(key)!;
        const exact = Math.abs(d) < storedCap;
        // Recortada: el signo es seguro y queda a más de una arista del nivel nuevo.
        if (exact || (d > 0 ? d - level > gridEdge : level - d > gridEdge)) return d;
      }
      misses++;
      const v = field(x, y, z, cap);
      values.set(key, v);
      caps.set(key, cap);
      return v;
    },
    get misses() {
      return misses;
    },
  };
}
