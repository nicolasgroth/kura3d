/**
 * @file src/engine/meshDistanceSupport.ts
 * @description Estructuras auxiliares del campo de distancia (`meshDistance.ts`): tabla hash
 * abierta de aristas no orientadas con acumulador de normal (sin `Map` ni arreglos por arista) y
 * selección del n-ésimo elemento (quickselect) para partir nodos del BVH sin ordenar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Tabla de aristas `{a,b}` → normal acumulada (3 doubles), con direccionamiento abierto. */
export interface EdgeNormalTable {
  /** Suma `(nx,ny,nz)` a la arista `{a,b}` (la crea si no existe). */
  add(a: number, b: number, nx: number, ny: number, nz: number): void;
  /** Posición base de la normal en `normals` o -1 si la arista no existe. */
  find(a: number, b: number): number;
  normals: Float64Array;
}

export function createEdgeNormalTable(expectedEdges: number): EdgeNormalTable {
  let cap = 16;
  while (cap < expectedEdges * 2) cap <<= 1;
  const mask = cap - 1;
  const keyA = new Int32Array(cap).fill(-1);
  const keyB = new Int32Array(cap);
  const normals = new Float64Array(cap * 3);
  const hash = (lo: number, hi: number) => (Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi, 0x85ebca6b)) & mask;

  const slot = (a: number, b: number, insert: boolean): number => {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    let i = hash(lo, hi);
    for (;;) {
      const k = keyA[i];
      if (k === -1) {
        if (!insert) return -1;
        keyA[i] = lo;
        keyB[i] = hi;
        return i;
      }
      if (k === lo && keyB[i] === hi) return i;
      i = (i + 1) & mask;
    }
  };

  return {
    normals,
    add(a, b, nx, ny, nz) {
      const o = slot(a, b, true) * 3;
      normals[o] += nx;
      normals[o + 1] += ny;
      normals[o + 2] += nz;
    },
    find(a, b) {
      const s = slot(a, b, false);
      return s < 0 ? -1 : s * 3;
    },
  };
}

/**
 * Reordena `order[start, end)` para que `order[nth]` quede en su lugar según `key` y los menores
 * a su izquierda (equivalente a `std::nth_element`). O(n) esperado, sin asignaciones.
 */
export function selectNth(order: Uint32Array, start: number, end: number, nth: number, key: (t: number) => number): void {
  let lo = start;
  let hi = end - 1;
  while (hi > lo) {
    const pivot = key(order[(lo + hi) >> 1]);
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (key(order[i]) < pivot) i++;
      while (key(order[j]) > pivot) j--;
      if (i <= j) {
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
        i++;
        j--;
      }
    }
    if (nth <= j) hi = j;
    else if (nth >= i) lo = i;
    else return;
  }
}

/**
 * Caché de signo por bolas vacías: si un punto `p` está a distancia sin signo `d` de la superficie,
 * todo `q` con |q − p| < d tiene su mismo signo (la bola no toca la malla). Guarda las últimas
 * `size` consultas; el level-set y la medición recorren puntos vecinos en orden, así que casi todas
 * las consultas lejos de la superficie se resuelven sin lanzar un rayo.
 */
export function createSignBallCache(size = 32) {
  const data = new Float64Array(size * 5); // x, y, z, r², signo
  let count = 0;
  let next = 0;
  return {
    /** Signo conocido para (x, y, z) o 0 si ninguna bola guardada lo contiene. */
    lookup(x: number, y: number, z: number): number {
      for (let k = 0; k < count; k++) {
        const o = k * 5;
        const dx = x - data[o], dy = y - data[o + 1], dz = z - data[o + 2];
        if (dx * dx + dy * dy + dz * dz < data[o + 3]) return data[o + 4];
      }
      return 0;
    },
    /** Registra la bola de radio `d` (distancia sin signo exacta o cota inferior) con su signo. */
    store(x: number, y: number, z: number, d: number, sign: number): void {
      // Margen relativo: evita reutilizar en el borde exacto de la bola por redondeo.
      const r = d * (1 - 1e-6);
      if (!(r > 0)) return;
      const o = next * 5;
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = z;
      data[o + 3] = r * r;
      data[o + 4] = sign;
      next = (next + 1) % size;
      if (count < size) count++;
    },
  };
}
