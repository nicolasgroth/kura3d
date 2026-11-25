/**
 * @file src/engine/smooth/smoothGuard.ts
 * @description Protección local de «Suavizar malla» ante daño. En vez de bajar la intensidad de toda la pieza cuando
 * unos pocos triángulos se invierten o se cortan, se fijan los vértices de esos triángulos (amortiguación 0) y se
 * amortiguan sus anillos de vecinos (anillo r de R: r/(R+1)), y se vuelve a suavizar el resto con la intensidad pedida.
 * Es un enmascarado de vértices por vecindad en el grafo (BFS), determinista: misma malla y opciones, mismo resultado.
 * Aquí viven la máscara de amortiguación, el grafo con esos pesos y la cobertura de intensidad del informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SmoothGraph } from './smoothGraph';

/** Anillos de vecinos amortiguados alrededor de cada vértice dañado (además del propio vértice, que queda fijo). */
export const SMOOTH_PROTECT_RINGS = 2;
/** Rondas de protección local antes de recurrir a bajar la intensidad global. */
export const SMOOTH_LOCAL_ROUNDS = 8;
/** Sobre esta fracción de vértices movibles protegidos, proteger deja de ser local: se baja la intensidad global. */
export const SMOOTH_LOCAL_MAX_FRACTION = 0.2;
/** Un vértice cuenta como suavizado «con la intensidad pedida» si su intensidad efectiva llega a esta fracción. */
export const SMOOTH_FULL_STRENGTH_RATIO = 0.8;

/**
 * Fija los vértices soldados `seeds` (amortiguación 0) y amortigua `rings` anillos a su alrededor con `r/(rings+1)`,
 * sin subir nunca una amortiguación ya puesta. Devuelve cuántos vértices cambiaron de amortiguación.
 */
export function protectAround(damp: Float32Array, seeds: ArrayLike<number>, graph: Pick<SmoothGraph, 'nbrStart' | 'nbr'>, rings = SMOOTH_PROTECT_RINGS): number {
  const { nbrStart, nbr } = graph;
  const seen = new Uint8Array(damp.length);
  let changed = 0;
  let frontier: number[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const v = seeds[i];
    if (seen[v]) continue;
    seen[v] = 1;
    if (damp[v] !== 0) changed++;
    damp[v] = 0;
    frontier.push(v);
  }
  for (let r = 1; r <= rings && frontier.length; r++) {
    const value = r / (rings + 1);
    const next: number[] = [];
    for (const v of frontier) {
      for (let j = nbrStart[v]; j < nbrStart[v + 1]; j++) {
        const u = nbr[j];
        if (seen[u]) continue;
        seen[u] = 1;
        if (damp[u] > value) {
          damp[u] = value;
          changed++;
        }
        next.push(u);
      }
    }
    frontier = next;
  }
  return changed;
}

/** El grafo con los pesos multiplicados por la amortiguación (y la lista de activos recalculada). */
export function dampedGraph(graph: SmoothGraph, damp: Float32Array): SmoothGraph {
  const weight = new Float32Array(graph.weight.length);
  let n = 0;
  for (let v = 0; v < weight.length; v++) if ((weight[v] = graph.weight[v] * damp[v]) > 0) n++;
  const active = new Uint32Array(n);
  for (let v = 0, i = 0; v < weight.length; v++) if (weight[v] > 0) active[i++] = v;
  return { ...graph, weight, active };
}

export interface StrengthCoverage {
  /** Vértices soldados que las opciones dejan mover (fuera de aristas vivas, bordes y fuera de zona no cuentan). */
  movable: number;
  /** De esos, los amortiguados o fijados por daño. */
  protected: number;
  /** Fracción de los movibles cuya intensidad efectiva (global · amortiguación) llega a `SMOOTH_FULL_STRENGTH_RATIO` de la pedida. */
  coverage: number;
}

/** Cobertura de intensidad: cuánto de la pieza recibió (casi) la intensidad pedida. */
export function strengthCoverage(graph: SmoothGraph, damp: Float32Array, applied: number, requested: number): StrengthCoverage {
  let movable = 0, prot = 0, full = 0;
  const need = SMOOTH_FULL_STRENGTH_RATIO * requested - 1e-9;
  for (let v = 0; v < graph.weight.length; v++) {
    if (graph.weight[v] <= 0) continue;
    movable++;
    if (damp[v] < 1) prot++;
    if (applied * damp[v] >= need) full++;
  }
  return { movable, protected: prot, coverage: movable > 0 ? full / movable : 1 };
}
