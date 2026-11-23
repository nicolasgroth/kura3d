/**
 * @file src/engine/split/splitCutCache.ts
 * @description Reutiliza el corte en celdas entre el plan y la ejecución de "dividir para imprimir". El
 * plan ya corta el sólido por los mismos planos para contar piezas reales (`splitOccupancy.ts`); la
 * ejecución lo repetía (en un busto de 2,4 M triángulos son ~20 s de `splitByPlane` más ~5 s de pasar
 * la malla a Manifold). Se guarda UNA entrada: la huella completa de la malla de mundo (hash de todas
 * las posiciones e índices, color) y de la rejilla, con el volumen del sólido y copias de las celdas.
 * La ejecución toma copias solo si la huella coincide exactamente; si no, corta como antes. La entrada
 * se libera al terminar la ejecución o al guardar otra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold } from 'manifold-3d';
import type { MeshData } from '../../types/kura';
import type { Cell } from './splitBodies';

export type CutCells = Array<{ cell: Cell; m: Manifold }>;

interface Entry {
  key: string;
  sourceVolume: number;
  cells: CutCells;
}

let entry: Entry | null = null;

/** FNV-1a de 32 bits sobre los bits de un arreglo (todas las posiciones, no una muestra). */
function hashWords(h: number, words: Uint32Array): number {
  for (let i = 0; i < words.length; i++) {
    h ^= words[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const wordsOf = (a: Float32Array | Uint32Array) => new Uint32Array(a.buffer, a.byteOffset, a.length);

/** Huella exacta del corte: malla de mundo, color y rejilla (límites y planos por eje). */
export function cutKey(world: MeshData, color: string | undefined, bounds: number[][]): string {
  const p = hashWords(0x811c9dc5, wordsOf(world.positions));
  const q = hashWords(0x01000193, wordsOf(world.positions));
  const i = hashWords(0x811c9dc5, wordsOf(world.indices));
  return [world.positions.length, world.indices.length, p, q, i, color ?? '', JSON.stringify(bounds)].join('|');
}

const copy = (cells: CutCells): CutCells => cells.map(({ cell, m }) => ({ cell: [...cell] as Cell, m: m.translate([0, 0, 0]) }));

/** Libera la entrada guardada. */
export function releaseCutCache(): void {
  if (!entry) return;
  for (const c of entry.cells) c.m.delete();
  entry = null;
}

/** Guarda copias de `cells` (no las consume) con su huella y el volumen del sólido. */
export function rememberCut(key: string, sourceVolume: number, cells: CutCells): void {
  releaseCutCache();
  entry = { key, sourceVolume, cells: copy(cells) };
}

/** Copias de las celdas guardadas (el llamador las consume) si la huella coincide; si no, `null`. */
export function recallCut(key: string): { sourceVolume: number; cells: CutCells } | null {
  if (!entry || entry.key !== key) return null;
  return { sourceVolume: entry.sourceVolume, cells: copy(entry.cells) };
}
