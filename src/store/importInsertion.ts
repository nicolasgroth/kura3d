/**
 * @file src/store/importInsertion.ts
 * @description Entrada de las piezas importadas a la escena por tandas acotadas en triángulos, cediendo
 * el hilo hasta que el navegador pinte entre tanda y tanda: el visor monta cada tanda en su propio
 * fotograma (sin congelar la pestaña) y la barra muestra el avance real «N de M piezas». Las tandas
 * intermedias entran sin grupo (los grupos sin miembros se descartarían); la última deja objetos,
 * grupos y selección definitivos. Cancelar a mitad devuelve la escena a como estaba.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../types/kura';

/** Triángulos por tanda: lo que el visor monta en un fotograma sin un bloqueo perceptible. */
export const IMPORT_BATCH_TRIANGLES = 400_000;

/** Cede el hilo principal (un ciclo del bucle de eventos) entre trozos de trabajo. */
export const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Cede hasta después del próximo pintado (`requestAnimationFrame` + macrotarea). Con la pestaña oculta
 * los fotogramas se detienen: un temporizador de respaldo sigue adelante igual.
 */
export const yieldToPaint = (): Promise<void> =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(finish, 0));
    setTimeout(finish, 120);
  });

/** Parte la lista en tandas consecutivas de hasta `budget` triángulos (al menos un elemento cada una). */
export function sliceByTriangles<T>(items: readonly T[], triangles: (item: T) => number, budget = IMPORT_BATCH_TRIANGLES): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let acc = 0;
  for (const item of items) {
    const n = triangles(item);
    if (current.length > 0 && acc + n > budget) {
      out.push(current);
      current = [];
      acc = 0;
    }
    current.push(item);
    acc += n;
  }
  if (current.length > 0) out.push(current);
  return out;
}

const trianglesOf = (o: SceneObject) => Math.floor(o.mesh.indices.length / 3);

/** Estado de escena que se toca al insertar. */
export interface InsertionScene {
  objects: SceneObject[];
  groups?: import('../types/kura').SceneGroup[];
  selectedIds: string[];
}

export interface InsertionDeps {
  get: () => InsertionScene;
  set: (patch: (prev: InsertionScene) => Partial<InsertionScene>) => void;
  /** Avance tras cada tanda ya en la escena. */
  onProgress?: (done: number, total: number) => void;
  /** Cesión entre tandas (por defecto, hasta el próximo pintado). */
  yieldFrame?: () => Promise<void>;
  signal?: AbortSignal;
  budget?: number;
}

/**
 * Inserta `created` (objetos definitivos, con su grupo) por tandas y aplica `finish` a la escena en la
 * última. Devuelve false si se canceló: la escena queda exactamente como antes de empezar.
 */
export async function insertImportedObjects(
  created: readonly SceneObject[],
  finish: (prev: InsertionScene) => Partial<InsertionScene>,
  deps: InsertionDeps,
): Promise<boolean> {
  const before = deps.get();
  const restore = { objects: before.objects, groups: before.groups, selectedIds: before.selectedIds };
  const yieldFrame = deps.yieldFrame ?? yieldToPaint;
  const batches = sliceByTriangles(created, trianglesOf, deps.budget);
  const total = created.length;
  let done = 0;
  for (let b = 0; b < batches.length - 1; b++) {
    if (deps.signal?.aborted) break;
    // Sin grupo en las tandas intermedias: el grupo, aún sin miembros completos, se descartaría.
    const staged = batches[b].map((o) => {
      if (o.groupRef === undefined) return o;
      const { groupRef: _pending, ...rest } = o;
      return rest as SceneObject;
    });
    deps.set((prev) => ({ objects: [...prev.objects, ...staged] }));
    done += staged.length;
    deps.onProgress?.(done, total);
    await yieldFrame();
  }
  if (deps.signal?.aborted) {
    deps.set(() => restore);
    return false;
  }
  // Última tanda: los objetos definitivos reemplazan a los provisorios y entran grupos y selección.
  deps.set((prev) => finish({ ...prev, objects: prev.objects.slice(0, before.objects.length) }));
  deps.onProgress?.(total, total);
  return true;
}
