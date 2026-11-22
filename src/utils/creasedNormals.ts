/**
 * @file src/utils/creasedNormals.ts
 * @description Normales con ángulo de pliegue para el visor: las aristas con ángulo diedro mayor que el
 * umbral quedan vivas y las menores se suavizan. Devuelve una malla indexada donde solo se duplican los
 * vértices que están sobre un pliegue (poca memoria) y conserva el orden de los triángulos (el índice de
 * cara de un clic sigue siendo el de la malla original). Con caché por identidad del buffer de índices.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Ángulo diedro (grados) a partir del cual una arista queda viva. */
export const CREASE_ANGLE_DEG = 35;

export interface CreasedMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** Mismo largo y orden de triángulos que los índices de entrada. */
  indices: Uint32Array;
}

/**
 * Calcula normales con pliegue. Los vértices coincidentes en posición se sueldan solo para decidir qué
 * caras se suavizan juntas, así que también sirve con mallas importadas sin índices compartidos.
 */
export function computeCreasedMesh(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  creaseAngleDeg: number = CREASE_ANGLE_DEG,
): CreasedMesh {
  const triCount = Math.floor(indices.length / 3);
  const vertCount = Math.floor(positions.length / 3);
  const cosLimit = Math.cos((creaseAngleDeg * Math.PI) / 180);

  // Normales unitarias de cara.
  const faceN = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const e1x = positions[b] - positions[a];
    const e1y = positions[b + 1] - positions[a + 1];
    const e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a];
    const e2y = positions[c + 1] - positions[a + 1];
    const e2z = positions[c + 2] - positions[a + 2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      faceN[t * 3] = nx / len;
      faceN[t * 3 + 1] = ny / len;
      faceN[t * 3 + 2] = nz / len;
    }
  }

  // Soldadura por posición: id canónico por vértice.
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let v = 0; v < vertCount; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const q = 1 / (diag * 1e-6);
  const canon = new Int32Array(vertCount);
  const seen = new Map<string, number>();
  let canonCount = 0;
  for (let v = 0; v < vertCount; v++) {
    const key = `${Math.round(positions[v * 3] * q)},${Math.round(positions[v * 3 + 1] * q)},${Math.round(positions[v * 3 + 2] * q)}`;
    let id = seen.get(key);
    if (id === undefined) {
      id = canonCount++;
      seen.set(key, id);
    }
    canon[v] = id;
  }

  // Esquinas por vértice canónico (CSR).
  const cornerCount = triCount * 3;
  const start = new Int32Array(canonCount + 1);
  for (let c = 0; c < cornerCount; c++) start[canon[indices[c]] + 1]++;
  for (let i = 0; i < canonCount; i++) start[i + 1] += start[i];
  const fill = start.slice(0, canonCount);
  const cornersOf = new Int32Array(cornerCount);
  for (let c = 0; c < cornerCount; c++) cornersOf[fill[canon[indices[c]]]++] = c;

  // Cota superior de vértices de salida: uno por esquina.
  const outPos = new Float32Array(cornerCount * 3);
  const outNrm = new Float32Array(cornerCount * 3);
  const outIdx = new Uint32Array(cornerCount);
  let outCount = 0;

  // Buffers pequeños de clústeres, reutilizados por vértice.
  let cap = 16;
  let clusterRef = new Int32Array(cap); // triángulo representante
  let clusterOut = new Int32Array(cap); // vértice de salida
  let clusterAcc = new Float32Array(cap * 3);

  for (let cv = 0; cv < canonCount; cv++) {
    let clusters = 0;
    for (let k = start[cv]; k < start[cv + 1]; k++) {
      const corner = cornersOf[k];
      const tri = (corner / 3) | 0;
      const fx = faceN[tri * 3];
      const fy = faceN[tri * 3 + 1];
      const fz = faceN[tri * 3 + 2];

      // Peso por ángulo de la esquina (suavizado más fiel que ponderar por área).
      const slot = corner - tri * 3;
      const p = indices[corner] * 3;
      const pn = indices[tri * 3 + ((slot + 1) % 3)] * 3;
      const pp = indices[tri * 3 + ((slot + 2) % 3)] * 3;
      const ux = positions[pn] - positions[p];
      const uy = positions[pn + 1] - positions[p + 1];
      const uz = positions[pn + 2] - positions[p + 2];
      const wx = positions[pp] - positions[p];
      const wy = positions[pp + 1] - positions[p + 1];
      const wz = positions[pp + 2] - positions[p + 2];
      const ul = Math.hypot(ux, uy, uz) || 1;
      const wl = Math.hypot(wx, wy, wz) || 1;
      const cosA = Math.max(-1, Math.min(1, (ux * wx + uy * wy + uz * wz) / (ul * wl)));
      const weight = Math.acos(cosA);

      let found = -1;
      // Triángulo degenerado (sin área): se une al primer clúster para no crear vértices de más.
      if (fx === 0 && fy === 0 && fz === 0 && clusters > 0) found = 0;
      for (let i = 0; i < clusters && found < 0; i++) {
        let r = clusterRef[i] * 3;
        if (faceN[r] === 0 && faceN[r + 1] === 0 && faceN[r + 2] === 0) {
          // El representante era degenerado: adopta esta cara.
          clusterRef[i] = tri;
          r = tri * 3;
        }
        if (faceN[r] * fx + faceN[r + 1] * fy + faceN[r + 2] * fz >= cosLimit) {
          found = i;
          break;
        }
      }
      if (found < 0) {
        if (clusters === cap) {
          cap *= 2;
          const r2 = new Int32Array(cap);
          r2.set(clusterRef);
          clusterRef = r2;
          const o2 = new Int32Array(cap);
          o2.set(clusterOut);
          clusterOut = o2;
          const a2 = new Float32Array(cap * 3);
          a2.set(clusterAcc);
          clusterAcc = a2;
        }
        found = clusters++;
        clusterRef[found] = tri;
        clusterOut[found] = outCount++;
        clusterAcc[found * 3] = 0;
        clusterAcc[found * 3 + 1] = 0;
        clusterAcc[found * 3 + 2] = 0;
        const o = clusterOut[found] * 3;
        outPos[o] = positions[p];
        outPos[o + 1] = positions[p + 1];
        outPos[o + 2] = positions[p + 2];
      }
      clusterAcc[found * 3] += fx * weight;
      clusterAcc[found * 3 + 1] += fy * weight;
      clusterAcc[found * 3 + 2] += fz * weight;
      outIdx[corner] = clusterOut[found];
    }
    for (let i = 0; i < clusters; i++) {
      const ax = clusterAcc[i * 3];
      const ay = clusterAcc[i * 3 + 1];
      const az = clusterAcc[i * 3 + 2];
      const len = Math.hypot(ax, ay, az) || 1;
      const o = clusterOut[i] * 3;
      outNrm[o] = ax / len;
      outNrm[o + 1] = ay / len;
      outNrm[o + 2] = az / len;
    }
  }

  return {
    positions: outPos.slice(0, outCount * 3),
    normals: outNrm.slice(0, outCount * 3),
    indices: outIdx,
  };
}

const cache = new WeakMap<object, { positions: unknown; mesh: CreasedMesh }>();

/** Igual que `computeCreasedMesh`, memoizado por identidad del buffer de índices (y de posiciones). */
export function getCreasedMesh(positions: ArrayLike<number> & object, indices: ArrayLike<number> & object): CreasedMesh {
  const hit = cache.get(indices);
  if (hit && hit.positions === positions) return hit.mesh;
  const mesh = computeCreasedMesh(positions, indices);
  cache.set(indices, { positions, mesh });
  return mesh;
}
