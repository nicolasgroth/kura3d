/**
 * @file src/engine/io/soupWeld.ts
 * @description Soldadura de la sopa de triángulos de un STL (tres vértices propios por triángulo) con
 * la menor memoria posible: compacta las posiciones únicas en el mismo arreglo de entrada, usa el
 * arreglo de reasignación como índices (sin índices secuenciales), compara contra la posición del
 * representante en vez de guardar una copia cuantizada y hace crecer la tabla hash según los únicos.
 * El resultado es idéntico al de `weldVertices(raw, 0..n-1, tolerance)` (mismo orden de primera
 * aparición, mismos triángulos degenerados descartados).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { quantizedHash, tableCapacity } from '../positionHash';

/**
 * Suelda `raw` (x,y,z por vértice, de a tres por triángulo). CONSUME `raw`: sus primeras posiciones
 * quedan sobrescritas con las únicas; el llamador no debe volver a usarlo.
 */
export function weldTriangleSoup(raw: Float32Array, tolerance = 1e-5): { positions: Float32Array; indices: Uint32Array } {
  const invTol = tolerance > 0 ? 1 / tolerance : 1e5;
  const vertCount = Math.floor(raw.length / 3);
  // Reasignación de cada vértice = índices de la sopa (vértice i ↔ esquina i).
  const remap = new Uint32Array(vertCount);
  // Una sopa STL suele tener ~1/6 de vértices únicos: se empieza chico y se duplica al llenarse.
  let capacity = tableCapacity(Math.max(16, vertCount >>> 3));
  let mask = capacity - 1;
  let table = new Int32Array(capacity);
  let unique = 0;

  const rehash = () => {
    capacity *= 2;
    mask = capacity - 1;
    table = new Int32Array(capacity);
    for (let u = 0; u < unique; u++) {
      let slot = quantizedHash(Math.round(raw[u * 3] * invTol), Math.round(raw[u * 3 + 1] * invTol), Math.round(raw[u * 3 + 2] * invTol)) & mask;
      while (table[slot] !== 0) slot = (slot + 1) & mask;
      table[slot] = u + 1;
    }
  };

  for (let i = 0; i < vertCount; i++) {
    const x = raw[i * 3];
    const y = raw[i * 3 + 1];
    const z = raw[i * 3 + 2];
    const qx = Math.round(x * invTol);
    const qy = Math.round(y * invTol);
    const qz = Math.round(z * invTol);
    let slot = quantizedHash(qx, qy, qz) & mask;
    let mapped = -1;
    while (table[slot] !== 0) {
      const c = (table[slot] - 1) * 3;
      // La posición del representante es la original de su primera aparición: misma cuantización.
      if (Math.round(raw[c] * invTol) === qx && Math.round(raw[c + 1] * invTol) === qy && Math.round(raw[c + 2] * invTol) === qz) {
        mapped = c / 3;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (mapped < 0) {
      mapped = unique++;
      table[slot] = mapped + 1;
      // En sitio: `mapped` ≤ i, y los vértices posteriores aún no se leyeron.
      raw[mapped * 3] = x;
      raw[mapped * 3 + 1] = y;
      raw[mapped * 3 + 2] = z;
      if (unique * 2 > capacity) rehash();
    }
    remap[i] = mapped;
  }

  // Triángulos no degenerados, compactados en el mismo arreglo (escritura ≤ lectura).
  const triCount = Math.floor(vertCount / 3);
  let kept = 0;
  for (let t = 0; t < triCount; t++) {
    const a = remap[t * 3];
    const b = remap[t * 3 + 1];
    const c = remap[t * 3 + 2];
    if (a !== b && b !== c && c !== a) {
      remap[kept * 3] = a;
      remap[kept * 3 + 1] = b;
      remap[kept * 3 + 2] = c;
      kept++;
    }
  }
  return {
    positions: raw.slice(0, unique * 3),
    indices: kept === triCount && remap.length === kept * 3 ? remap : remap.slice(0, kept * 3),
  };
}
