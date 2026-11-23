/**
 * @file src/engine/io/importClusters.ts
 * @description Conjuntos de piezas de un archivo importado que deben ir juntos: placas del laminador
 * (Bambu/Orca) o piezas montadas entre sí (sus cajas se solapan o tocan en las posiciones originales,
 * p. ej. anillos concéntricos de un fidget). La colocación los trata como bloque rígido y la escena los
 * agrupa. Piezas separadas sin relación no forman conjunto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImportedModel } from './importTypes';
import { boundsOf } from './meshBuffers';

/** Conjunto de piezas (índices en `model.parts`). */
export type ImportCluster =
  | { kind: 'plate'; name?: string; plateNumber: number; parts: number[] }
  | { kind: 'assembly'; parts: number[] };

/** Holgura (mm) para considerar que dos cajas se tocan: piezas que encajan cara a cara cuentan como montadas. */
const TOUCH_MM = 0.01;

type Box = [number, number, number, number, number, number];

function overlaps(a: Box, b: Box): boolean {
  for (let k = 0; k < 3; k++) {
    if (a[k] > b[k + 3] + TOUCH_MM || b[k] > a[k + 3] + TOUCH_MM) return false;
  }
  return true;
}

/**
 * Conjuntos del modelo. Con placas declaradas, cada placa es un conjunto (y no se buscan montajes).
 * Si no, las piezas de distintos bloques (`group`) cuyas cajas se solapan se unen: cada componente
 * con piezas de dos o más bloques es un montaje.
 */
export function findImportClusters(model: ImportedModel): ImportCluster[] {
  if (model.plates && model.plates.length >= 2) {
    return model.plates.map((plate, i) => ({
      kind: 'plate' as const,
      name: plate.name,
      plateNumber: i + 1,
      parts: model.parts.flatMap((part, index) => (plate.groups.includes(part.group) ? [index] : [])),
    }));
  }
  const n = model.parts.length;
  if (n < 2) return [];
  const parent = model.parts.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const boxes = model.parts.map((p) => boundsOf(p.mesh.positions) as Box);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (model.parts[i].group === model.parts[j].group || overlaps(boxes[i], boxes[j])) union(i, j);
    }
  }
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = members.get(root);
    if (list) list.push(i);
    else members.set(root, [i]);
  }
  const clusters: ImportCluster[] = [];
  for (const parts of members.values()) {
    if (new Set(parts.map((i) => model.parts[i].group)).size >= 2) clusters.push({ kind: 'assembly', parts });
  }
  return clusters;
}
