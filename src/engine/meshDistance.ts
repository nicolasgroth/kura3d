/**
 * @file src/engine/meshDistance.ts
 * @description Campo de distancia con signo (SDF) exacto de una malla triangular cerrada:
 * BVH de triángulos en arreglos planos, punto más cercano por triángulo (Ericson) y signo
 * robusto por pseudo-normales ponderadas por ángulo (Bærentzen & Aanæs). Base del offset
 * real (ahuecado y núcleos de molde) y de la medición de espesor mínimo de pared.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Malla mínima (posiciones planas xyz e índices de triángulos). */
export interface DistanceMeshInput {
  positions: ArrayLike<number>;
  indices: ArrayLike<number>;
}

/** Consulta de distancia precompilada sobre una malla cerrada. */
export interface MeshDistanceField {
  /** Distancia con signo: positiva dentro del sólido, negativa fuera (convención de `Manifold.levelSet`). */
  signedDistance(x: number, y: number, z: number): number;
  /** Distancia sin signo a la superficie; devuelve `maxDistance` si no hay nada más cerca. */
  unsignedDistance(x: number, y: number, z: number, maxDistance?: number): number;
  /** Caja envolvente `[minX, minY, minZ, maxX, maxY, maxZ]`. */
  bounds: [number, number, number, number, number, number];
}

const LEAF_SIZE = 4;

/**
 * Construye el campo de distancia de una malla 2-manifold cerrada y orientada (normales salientes).
 * Coste de construcción O(n log n); cada consulta es ~O(log n).
 */
export function buildMeshDistanceField(mesh: DistanceMeshInput): MeshDistanceField {
  const triCount = Math.floor(mesh.indices.length / 3);
  const vertCount = Math.floor(mesh.positions.length / 3);
  const P = Float64Array.from(mesh.positions as ArrayLike<number>);
  const I = Uint32Array.from(mesh.indices as ArrayLike<number>);

  // Normales de cara y pseudo-normales de vértice (ponderadas por ángulo) y de arista
  const faceN = new Float64Array(triCount * 3);
  const vertN = new Float64Array(vertCount * 3);
  const edgeN = new Map<number, [number, number, number]>();
  const edgeKey = (a: number, b: number): number => (a < b ? a * vertCount + b : b * vertCount + a);

  for (let t = 0; t < triCount; t++) {
    const ia = I[t * 3];
    const ib = I[t * 3 + 1];
    const ic = I[t * 3 + 2];
    const ax = P[ia * 3], ay = P[ia * 3 + 1], az = P[ia * 3 + 2];
    const bx = P[ib * 3], by = P[ib * 3 + 1], bz = P[ib * 3 + 2];
    const cx = P[ic * 3], cy = P[ic * 3 + 1], cz = P[ic * 3 + 2];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    faceN[t * 3] = nx;
    faceN[t * 3 + 1] = ny;
    faceN[t * 3 + 2] = nz;

    const corners = [ia, ib, ic];
    for (let k = 0; k < 3; k++) {
      const v = corners[k];
      const v1 = corners[(k + 1) % 3];
      const v2 = corners[(k + 2) % 3];
      const e1x = P[v1 * 3] - P[v * 3], e1y = P[v1 * 3 + 1] - P[v * 3 + 1], e1z = P[v1 * 3 + 2] - P[v * 3 + 2];
      const e2x = P[v2 * 3] - P[v * 3], e2y = P[v2 * 3 + 1] - P[v * 3 + 1], e2z = P[v2 * 3 + 2] - P[v * 3 + 2];
      const l1 = Math.hypot(e1x, e1y, e1z) || 1;
      const l2 = Math.hypot(e2x, e2y, e2z) || 1;
      const cosA = Math.max(-1, Math.min(1, (e1x * e2x + e1y * e2y + e1z * e2z) / (l1 * l2)));
      const angle = Math.acos(cosA);
      vertN[v * 3] += nx * angle;
      vertN[v * 3 + 1] += ny * angle;
      vertN[v * 3 + 2] += nz * angle;

      const key = edgeKey(v, v1);
      const acc = edgeN.get(key);
      if (acc) {
        acc[0] += nx;
        acc[1] += ny;
        acc[2] += nz;
      } else {
        edgeN.set(key, [nx, ny, nz]);
      }
    }
  }

  // BVH: orden de triángulos + nodos [minX..maxZ, left/start, right/count, isLeaf]
  const order = new Uint32Array(triCount);
  const centroid = new Float64Array(triCount * 3);
  const triBox = new Float64Array(triCount * 6);
  for (let t = 0; t < triCount; t++) {
    order[t] = t;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = I[t * 3 + k];
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      if (x < mnx) mnx = x;
      if (y < mny) mny = y;
      if (z < mnz) mnz = z;
      if (x > mxx) mxx = x;
      if (y > mxy) mxy = y;
      if (z > mxz) mxz = z;
    }
    triBox.set([mnx, mny, mnz, mxx, mxy, mxz], t * 6);
    centroid[t * 3] = (mnx + mxx) * 0.5;
    centroid[t * 3 + 1] = (mny + mxy) * 0.5;
    centroid[t * 3 + 2] = (mnz + mxz) * 0.5;
  }

  const maxNodes = Math.max(1, 2 * triCount + 1);
  const nodeBox = new Float64Array(maxNodes * 6);
  const nodeA = new Int32Array(maxNodes); // hijo izquierdo o inicio de hoja
  const nodeB = new Int32Array(maxNodes); // hijo derecho o cantidad (negativa en hojas)
  let nodeCount = 0;

  const build = (start: number, end: number): number => {
    const node = nodeCount++;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    let cmnx = Infinity, cmny = Infinity, cmnz = Infinity, cmxx = -Infinity, cmxy = -Infinity, cmxz = -Infinity;
    for (let i = start; i < end; i++) {
      const t = order[i];
      const o = t * 6;
      if (triBox[o] < mnx) mnx = triBox[o];
      if (triBox[o + 1] < mny) mny = triBox[o + 1];
      if (triBox[o + 2] < mnz) mnz = triBox[o + 2];
      if (triBox[o + 3] > mxx) mxx = triBox[o + 3];
      if (triBox[o + 4] > mxy) mxy = triBox[o + 4];
      if (triBox[o + 5] > mxz) mxz = triBox[o + 5];
      const cx = centroid[t * 3], cy = centroid[t * 3 + 1], cz = centroid[t * 3 + 2];
      if (cx < cmnx) cmnx = cx;
      if (cy < cmny) cmny = cy;
      if (cz < cmnz) cmnz = cz;
      if (cx > cmxx) cmxx = cx;
      if (cy > cmxy) cmxy = cy;
      if (cz > cmxz) cmxz = cz;
    }
    nodeBox.set([mnx, mny, mnz, mxx, mxy, mxz], node * 6);
    const count = end - start;
    if (count <= LEAF_SIZE) {
      nodeA[node] = start;
      nodeB[node] = -count;
      return node;
    }
    const sx = cmxx - cmnx, sy = cmxy - cmny, sz = cmxz - cmnz;
    const axis = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2;
    const sub = Array.from(order.subarray(start, end));
    sub.sort((a, b) => centroid[a * 3 + axis] - centroid[b * 3 + axis]);
    order.set(sub, start);
    const mid = start + (count >> 1);
    const left = build(start, mid);
    const right = build(mid, end);
    nodeA[node] = left;
    nodeB[node] = right;
    return node;
  };
  if (triCount > 0) build(0, triCount);

  // Resultado de la consulta más cercana (evita asignaciones por llamada)
  let bestD2 = Infinity;
  let bestTri = -1;
  let bestRegion = 0; // 0 cara, 1..3 vértice a/b/c, 4..6 arista ab/bc/ca
  let bestPx = 0, bestPy = 0, bestPz = 0;
  const stack = new Int32Array(128);

  const boxDist2 = (node: number, x: number, y: number, z: number): number => {
    const o = node * 6;
    const dx = x < nodeBox[o] ? nodeBox[o] - x : x > nodeBox[o + 3] ? x - nodeBox[o + 3] : 0;
    const dy = y < nodeBox[o + 1] ? nodeBox[o + 1] - y : y > nodeBox[o + 4] ? y - nodeBox[o + 4] : 0;
    const dz = z < nodeBox[o + 2] ? nodeBox[o + 2] - z : z > nodeBox[o + 5] ? z - nodeBox[o + 5] : 0;
    return dx * dx + dy * dy + dz * dz;
  };

  /** Punto más cercano de (x,y,z) al triángulo t (Real-Time Collision Detection, Ericson §5.1.5). */
  const closestOnTri = (t: number, x: number, y: number, z: number): void => {
    const ia = I[t * 3] * 3, ib = I[t * 3 + 1] * 3, ic = I[t * 3 + 2] * 3;
    const ax = P[ia], ay = P[ia + 1], az = P[ia + 2];
    const abx = P[ib] - ax, aby = P[ib + 1] - ay, abz = P[ib + 2] - az;
    const acx = P[ic] - ax, acy = P[ic + 1] - ay, acz = P[ic + 2] - az;
    const apx = x - ax, apy = y - ay, apz = z - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let px: number, py: number, pz: number, region: number;
    if (d1 <= 0 && d2 <= 0) {
      px = ax; py = ay; pz = az; region = 1;
    } else {
      const bpx = x - P[ib], bpy = y - P[ib + 1], bpz = z - P[ib + 2];
      const d3 = abx * bpx + aby * bpy + abz * bpz;
      const d4 = acx * bpx + acy * bpy + acz * bpz;
      const cpx = x - P[ic], cpy = y - P[ic + 1], cpz = z - P[ic + 2];
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vc = d1 * d4 - d3 * d2;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d3 >= 0 && d4 <= d3) {
        px = P[ib]; py = P[ib + 1]; pz = P[ib + 2]; region = 2;
      } else if (d6 >= 0 && d5 <= d6) {
        px = P[ic]; py = P[ic + 1]; pz = P[ic + 2]; region = 3;
      } else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const v = d1 / (d1 - d3);
        px = ax + abx * v; py = ay + aby * v; pz = az + abz * v; region = 4;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        const w = d2 / (d2 - d6);
        px = ax + acx * w; py = ay + acy * w; pz = az + acz * w; region = 6;
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        px = P[ib] + (P[ic] - P[ib]) * w;
        py = P[ib + 1] + (P[ic + 1] - P[ib + 1]) * w;
        pz = P[ib + 2] + (P[ic + 2] - P[ib + 2]) * w;
        region = 5;
      } else {
        const denom = 1 / (va + vb + vc);
        const v = vb * denom;
        const w = vc * denom;
        px = ax + abx * v + acx * w;
        py = ay + aby * v + acy * w;
        pz = az + abz * v + acz * w;
        region = 0;
      }
    }
    const dx = x - px, dy = y - py, dz = z - pz;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < bestD2) {
      bestD2 = dd;
      bestTri = t;
      bestRegion = region;
      bestPx = px; bestPy = py; bestPz = pz;
    }
  };

  const nearest = (x: number, y: number, z: number, maxD2: number): void => {
    bestD2 = maxD2;
    bestTri = -1;
    if (triCount === 0) return;
    let sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      const node = stack[--sp];
      if (boxDist2(node, x, y, z) >= bestD2) continue;
      const b = nodeB[node];
      if (b <= 0) {
        const start = nodeA[node];
        const end = start - b;
        for (let i = start; i < end; i++) closestOnTri(order[i], x, y, z);
      } else {
        const l = nodeA[node];
        const dl = boxDist2(l, x, y, z);
        const dr = boxDist2(b, x, y, z);
        // Visita primero el hijo más cercano (se apila último)
        if (dl < dr) {
          if (dr < bestD2) stack[sp++] = b;
          if (dl < bestD2) stack[sp++] = l;
        } else {
          if (dl < bestD2) stack[sp++] = l;
          if (dr < bestD2) stack[sp++] = b;
        }
      }
    }
  };

  const signOfBest = (x: number, y: number, z: number): number => {
    let nx: number, ny: number, nz: number;
    const t = bestTri;
    if (bestRegion === 0) {
      nx = faceN[t * 3]; ny = faceN[t * 3 + 1]; nz = faceN[t * 3 + 2];
    } else if (bestRegion <= 3) {
      const v = I[t * 3 + bestRegion - 1];
      nx = vertN[v * 3]; ny = vertN[v * 3 + 1]; nz = vertN[v * 3 + 2];
    } else {
      const k = bestRegion - 4;
      const a = I[t * 3 + k];
      const b = I[t * 3 + ((k + 1) % 3)];
      const acc = edgeN.get(edgeKey(a, b));
      if (acc) {
        nx = acc[0]; ny = acc[1]; nz = acc[2];
      } else {
        nx = faceN[t * 3]; ny = faceN[t * 3 + 1]; nz = faceN[t * 3 + 2];
      }
    }
    const dot = (x - bestPx) * nx + (y - bestPy) * ny + (z - bestPz) * nz;
    return dot > 0 ? -1 : 1; // normal saliente => fuera negativo
  };

  const rootBox = triCount > 0 ? Array.from(nodeBox.subarray(0, 6)) : [0, 0, 0, 0, 0, 0];

  return {
    bounds: rootBox as [number, number, number, number, number, number],
    signedDistance(x, y, z) {
      nearest(x, y, z, Infinity);
      if (bestTri < 0) return -Infinity;
      return Math.sqrt(bestD2) * signOfBest(x, y, z);
    },
    unsignedDistance(x, y, z, maxDistance = Infinity) {
      nearest(x, y, z, maxDistance === Infinity ? Infinity : maxDistance * maxDistance);
      return bestTri < 0 ? maxDistance : Math.sqrt(bestD2);
    },
  };
}
