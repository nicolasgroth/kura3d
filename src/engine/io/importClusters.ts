/**
 * @file src/engine/io/importClusters.ts
 * @description Conjuntos de piezas de un archivo importado que deben ir juntos: placas del laminador
 * (Bambu/Orca) o piezas montadas entre sí (sus cajas se solapan o tocan en las posiciones originales,
 * p. ej. anillos concéntricos de un fidget). La colocación los trata como bloque rígido y la escena los
 * agrupa. Piezas separadas sin relación no forman conjunto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { ImportedModel } from './importTypes';

/** Conjuntos ya calculados al leer (en el Worker) o, si faltan, calculados ahora. */
export function clustersOf(model: ImportedModel): ImportCluster[] {
  return model.clusters ?? findImportClusters(model);
}
import { partBounds } from './partGeometry';

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
    // Cada pieza en una sola placa (la primera), aunque el modelo llegue con placas que se repiten.
    const taken = new Set<number>();
    const clusters: ImportCluster[] = [];
    model.plates.forEach((plate, i) => {
      const groups = new Set(plate.groups);
      const parts = model.parts.flatMap((part, index) => (groups.has(part.group) && !taken.has(index) ? [index] : []));
      parts.forEach((index) => taken.add(index));
      if (parts.length > 0) clusters.push({ kind: 'plate', name: plate.name, plateNumber: i + 1, parts });
    });
    return clusters;
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
  // Piezas del mismo bloque van juntas (unión lineal por grupo).
  const firstOfGroup = new Map<number, number>();
  model.parts.forEach((part, i) => {
    const first = firstOfGroup.get(part.group);
    if (first === undefined) firstOfGroup.set(part.group, i);
    else union(first, i);
  });
  // Barrido ordenado por X (sort-and-sweep): solo se comparan cajas cuyo tramo X se cruza.
  const boxes = model.parts.map((p) => partBounds(p) as Box);
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a][0] - boxes[b][0]);
  let active: number[] = [];
  for (const i of order) {
    const minX = boxes[i][0] - TOUCH_MM;
    active = active.filter((j) => boxes[j][3] >= minX);
    for (const j of active) {
      if (find(i) !== find(j) && overlaps(boxes[i], boxes[j])) union(i, j);
    }
    active.push(i);
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
