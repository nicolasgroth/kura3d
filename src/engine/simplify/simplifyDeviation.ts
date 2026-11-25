/**
 * @file src/engine/simplify/simplifyDeviation.ts
 * @description Desviación máxima muestreada entre dos mallas (Hausdorff aproximado en ambos sentidos con
 * `three-mesh-bvh`): vértices y centroides de cada malla contra la superficie de la otra, con un tope de muestras
 * por sentido para que la medición no domine el tiempo de Simplificar. Es una cota inferior del máximo real.
 * La usan la verificación de Simplificar y la medición de `simplifyMeasure.perf.test.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { MeshData } from '../../types/kura';

export interface SampledDeviation {
  /** Mayor distancia hallada (mismas unidades que las mallas). */
  maxMm: number;
  /** Puntos medidos en total (ambos sentidos). */
  samples: number;
}

/** Malla soldada que devuelve Manifold (posiciones en las 3 primeras propiedades). */
export function manifoldMesh(m: Manifold): MeshData {
  const raw = m.getMesh();
  const n = raw.numVert, np = raw.numProp;
  const positions = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) positions[v * 3 + k] = raw.vertProperties[v * np + k];
  return { positions, indices: new Uint32Array(raw.triVerts) };
}

/** BVH de una malla indexada. */
export function bvhOf(mesh: MeshData): MeshBVH {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  g.setIndex(new BufferAttribute(mesh.indices, 1));
  return new MeshBVH(g);
}

/** Máxima distancia de vértices y centroides de `from` (hasta `maxSamples` de cada uno) a la superficie de `to`. */
export function maxDistanceTo(from: MeshData, to: MeshBVH, maxSamples: number): SampledDeviation {
  const P = from.positions, I = from.indices;
  const vCount = P.length / 3, tCount = I.length / 3;
  const p = new Vector3();
  const target = { point: new Vector3(), distance: 0, faceIndex: 0 };
  let worst = 0, samples = 0;
  const vStep = Math.max(1, Math.ceil(vCount / maxSamples));
  for (let v = 0; v < vCount; v += vStep) {
    p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const hit = to.closestPointToPoint(p, target);
    if (hit) worst = Math.max(worst, hit.distance);
    samples++;
  }
  const tStep = Math.max(1, Math.ceil(tCount / maxSamples));
  for (let t = 0; t < tCount; t += tStep) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    p.set((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3);
    const hit = to.closestPointToPoint(p, target);
    if (hit) worst = Math.max(worst, hit.distance);
    samples++;
  }
  return { maxMm: worst, samples };
}

/**
 * Desviación en ambos sentidos entre `a` y `b`, con hasta `maxSamples` vértices y otros tantos centroides por
 * sentido. Si se pasa `aBvh`, se reutiliza (la original se mide contra varios resultados).
 */
export function sampledDeviation(a: MeshData, b: MeshData, maxSamples: number, aBvh?: MeshBVH): SampledDeviation {
  const ab = maxDistanceTo(a, bvhOf(b), maxSamples);
  const ba = maxDistanceTo(b, aBvh ?? bvhOf(a), maxSamples);
  return { maxMm: Math.max(ab.maxMm, ba.maxMm), samples: ab.samples + ba.samples };
}
