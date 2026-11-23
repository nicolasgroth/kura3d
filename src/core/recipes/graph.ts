/**
 * @file src/core/recipes/graph.ts
 * @description Orden topológico iterativo (DFS sin recursión) para `derive` y para los parámetros cuyo valor
 * depende de otros. Un ciclo es un `RecipeError` con la ruta del primer campo y el ciclo completo
 * (`d.a → d.b → d.a`). Costo O(nodos + aristas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { RecipeError } from './errors';

export interface TopoInput {
  /** Nodos en el orden en que aparecen en la receta (el orden de salida es estable respecto de este). */
  readonly nodes: readonly string[];
  /** Dependencias de cada nodo (solo nodos existentes; las referencias inexistentes se reportan antes). */
  readonly deps: ReadonlyMap<string, readonly string[]>;
  /** Ruta del campo de un nodo, para el error (`derive.ow`, `params[3]`). */
  readonly pathOf: (node: string) => string;
  /** Prefijo para mostrar el ciclo (`d.`, `p.`). */
  readonly label: string;
}

/** Devuelve los nodos ordenados de modo que cada uno va después de sus dependencias. */
export function topoSort(input: TopoInput): { order: string[]; edges: number } {
  const state = new Map<string, 1 | 2>(); // 1 = en curso, 2 = listo
  const order: string[] = [];
  let edges = 0;
  for (const start of input.nodes) {
    if (state.has(start)) continue;
    const stack: Array<{ node: string; next: number }> = [{ node: start, next: 0 }];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const deps = input.deps.get(top.node) ?? [];
      if (top.next < deps.length) {
        const dep = deps[top.next++];
        edges += 1;
        const seen = state.get(dep);
        if (seen === 2) continue;
        if (seen === 1) {
          const from = stack.findIndex((frame) => frame.node === dep);
          const cycle = [...stack.slice(from).map((frame) => frame.node), dep].map((n) => input.label + n).join(' → ');
          throw new RecipeError('graph.cycle', input.pathOf(dep), { cycle });
        }
        state.set(dep, 1);
        stack.push({ node: dep, next: 0 });
        continue;
      }
      state.set(top.node, 2);
      order.push(top.node);
      stack.pop();
    }
  }
  return { order, edges };
}
