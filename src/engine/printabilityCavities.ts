/**
 * @file src/engine/printabilityCavities.ts
 * @description Detección de cavidades cerradas en una malla (p. ej. un cubo ahuecado sin orificio): se
 * sueldan los vértices por posición, se separan las cáscaras conexas y se mide el volumen con signo de
 * cada una. Una cáscara con el signo contrario al de la cáscara dominante (normales hacia dentro) es el
 * borde de un vacío sellado: líquido o polvo atrapado no puede salir. Solo geometría, sin motor WASM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export interface CavityMesh {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

export interface SealedCavities {
  /** Cantidad de cavidades cerradas. */
  count: number;
  /** Volumen total encerrado (mm³). */
  volumeMm3: number;
}

/** Cuenta las cavidades cerradas (cáscaras internas con orientación opuesta a la exterior). */
export function measureSealedCavities(mesh: CavityMesh): SealedCavities {
  const p = mesh.positions;
  const idx = mesh.indices;
  const triCount = Math.floor(idx.length / 3);
  if (triCount < 8) return { count: 0, volumeMm3: 0 };

  const weld = new Map<string, number>();
  const vertexId = (i: number) => {
    const key = `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
    let id = weld.get(key);
    if (id === undefined) {
      id = weld.size;
      weld.set(key, id);
    }
    return id;
  };
  const welded = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) welded[i] = vertexId(idx[i]);

  // Unión-búsqueda sobre los vértices soldados: cada triángulo une sus tres vértices.
  const parent = new Int32Array(weld.size);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    let c = a;
    while (parent[c] !== r) {
      const next = parent[c];
      parent[c] = r;
      c = next;
    }
    return r;
  };
  for (let t = 0; t < triCount; t++) {
    const a = find(welded[t * 3]);
    const b = find(welded[t * 3 + 1]);
    const c = find(welded[t * 3 + 2]);
    if (a !== b) parent[b] = a;
    const root = find(a);
    if (c !== root) parent[find(c)] = root;
  }

  // Volumen con signo (sextuplicado) por cáscara.
  const volume = new Map<number, number>();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx[t * 3] * 3, i1 = idx[t * 3 + 1] * 3, i2 = idx[t * 3 + 2] * 3;
    const v =
      p[i0] * (p[i1 + 1] * p[i2 + 2] - p[i1 + 2] * p[i2 + 1]) -
      p[i0 + 1] * (p[i1] * p[i2 + 2] - p[i1 + 2] * p[i2]) +
      p[i0 + 2] * (p[i1] * p[i2 + 1] - p[i1 + 1] * p[i2]);
    const root = find(welded[t * 3]);
    volume.set(root, (volume.get(root) ?? 0) + v / 6);
  }
  if (volume.size < 2) return { count: 0, volumeMm3: 0 };

  let dominant = 0;
  for (const v of volume.values()) if (Math.abs(v) > Math.abs(dominant)) dominant = v;
  if (dominant === 0) return { count: 0, volumeMm3: 0 };

  let count = 0;
  let volumeMm3 = 0;
  for (const v of volume.values()) {
    if (Math.sign(v) !== Math.sign(dominant) && Math.abs(v) > 1e-3) {
      count++;
      volumeMm3 += Math.abs(v);
    }
  }
  return { count, volumeMm3 };
}
