/**
 * @file src/engine/smooth/taubin.ts
 * @description Núcleo de Taubin λ/μ (Taubin 1995) sobre el grafo de vértices soldados: en cada
 * iteración un paso de Laplace uniforme con λ > 0 (suaviza) y otro con μ < 0 (devuelve el volumen),
 * ambos escalados por el peso del vértice (zona y atenuación). Actualización de Jacobi con dos
 * búferes. Al final se acota cada vértice a la caja envolvente original, así la caja no crece.
 * Solo cambia posiciones: misma topología, mismos vértices y triángulos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SmoothGraph } from './smoothGraph';
import { taubinCoefficients } from './smoothOptions';

/** Posiciones soldadas (doble precisión) tomadas del primer vértice original de cada soldado. */
export function weldedPositions(positions: Float32Array, graph: SmoothGraph): Float64Array {
  const out = new Float64Array(graph.weldedCount * 3);
  const seen = new Uint8Array(graph.weldedCount);
  for (let v = 0; v < graph.weld.length; v++) {
    const w = graph.weld[v];
    if (seen[w]) continue;
    seen[w] = 1;
    out[w * 3] = positions[v * 3];
    out[w * 3 + 1] = positions[v * 3 + 1];
    out[w * 3 + 2] = positions[v * 3 + 2];
  }
  return out;
}

function laplacePass(src: Float64Array, dst: Float64Array, graph: SmoothGraph, factor: number): void {
  const { active, nbrStart, nbr, weight } = graph;
  for (let i = 0; i < active.length; i++) {
    const v = active[i];
    const s = nbrStart[v], e = nbrStart[v + 1];
    let x = 0, y = 0, z = 0;
    for (let j = s; j < e; j++) {
      const u = nbr[j] * 3;
      x += src[u];
      y += src[u + 1];
      z += src[u + 2];
    }
    const inv = 1 / (e - s);
    const c = factor * weight[v];
    const p = v * 3;
    dst[p] = src[p] + c * (x * inv - src[p]);
    dst[p + 1] = src[p + 1] + c * (y * inv - src[p + 1]);
    dst[p + 2] = src[p + 2] + c * (z * inv - src[p + 2]);
  }
}

/**
 * Suaviza y devuelve las nuevas posiciones originales (Float32, misma longitud). Los vértices con
 * peso 0 conservan exactamente su valor de entrada.
 */
export function taubinSmooth(
  positions: Float32Array,
  graph: SmoothGraph,
  strength: number,
  iterations: number,
  onIteration?: (done: number) => void,
): Float32Array {
  const { lambda, mu } = taubinCoefficients(strength);
  const a = weldedPositions(positions, graph);
  const b = a.slice();
  for (let it = 0; it < iterations; it++) {
    laplacePass(a, b, graph, lambda);
    laplacePass(b, a, graph, mu);
    onIteration?.(it + 1);
  }

  // Caja envolvente original: el suavizado no la agranda.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const c = positions[i + k];
      if (c < min[k]) min[k] = c;
      if (c > max[k]) max[k] = c;
    }
  }
  const out = positions.slice();
  const { weld, weight } = graph;
  for (let v = 0; v < weld.length; v++) {
    const w = weld[v];
    if (weight[w] <= 0) continue;
    for (let k = 0; k < 3; k++) {
      const c = a[w * 3 + k];
      out[v * 3 + k] = c < min[k] ? min[k] : c > max[k] ? max[k] : c;
    }
  }
  return out;
}
