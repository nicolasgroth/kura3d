/**
 * @file src/engine/io/importPlacement.ts
 * @description Colocación en la cama de las piezas importadas. Modo `original`: conserva la
 * posición y altura del archivo. Modo `bed` (por defecto): cada bloque rígido (un archivo con
 * posiciones, o cada pieza suelta) conserva sus posiciones relativas, se apoya en Y=0 y los
 * bloques se distribuyen en filas sin solaparse entre sí ni con la escena existente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { clustersOf } from './importClusters';
import { ModelImportError } from './importErrors';
import type { ImportedModel, ImportedPart } from './importTypes';
import { centerPartOnBed, partBounds } from './partGeometry';

/** Modo de colocación elegido por el usuario. */
export type ImportPlacementMode = 'bed' | 'original';

/** Huella XZ ocupada en la cama. */
export interface FootprintXZ {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Pieza lista para insertar: malla con pivote local (centro XZ, base en Y=0) y posición mundial. */
export interface PlacedPart {
  part: ImportedPart;
  fileName: string;
  mesh: MeshData;
  position: Vec3;
}

/** Separación entre bloques distribuidos (mm). */
export const PLACEMENT_GAP_MM = 5;

interface Block {
  fileName: string;
  parts: ImportedPart[];
  bounds: [number, number, number, number, number, number];
}

function unionBounds(parts: ImportedPart[]): Block['bounds'] {
  const out: Block['bounds'] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    const b = partBounds(part);
    for (let k = 0; k < 3; k++) {
      out[k] = Math.min(out[k], b[k]);
      out[k + 3] = Math.max(out[k + 3], b[k + 3]);
    }
  }
  return out;
}

/**
 * Divide los modelos en bloques rígidos: cada placa del laminador es un bloque; un archivo con
 * posiciones con significado es un bloque; si no, cada conjunto montado (piezas que se solapan) es un
 * bloque y el resto de las piezas se agrupa por `group`.
 */
function toBlocks(models: ImportedModel[]): Block[] {
  const blocks: Block[] = [];
  const push = (fileName: string, parts: ImportedPart[]) => {
    if (parts.length > 0) blocks.push({ fileName, parts, bounds: unionBounds(parts) });
  };
  for (const model of models) {
    const clusters = clustersOf(model);
    const plates = clusters.filter((c) => c.kind === 'plate');
    if (plates.length > 0 || !model.hasPlacement) {
      // Cada pieza se coloca una sola vez aunque dos conjuntos la nombren.
      const taken = new Set<number>();
      for (const cluster of clusters) {
        const fresh: number[] = [];
        for (const i of cluster.parts) {
          if (i < 0 || i >= model.parts.length || taken.has(i)) continue;
          taken.add(i);
          fresh.push(i);
        }
        push(model.fileName, fresh.map((i) => model.parts[i]));
      }
      const rest = model.parts.filter((_, i) => !taken.has(i));
      if (model.hasPlacement) {
        push(model.fileName, rest);
        continue;
      }
      const groups = new Map<number, ImportedPart[]>();
      for (const part of rest) {
        const list = groups.get(part.group) ?? [];
        list.push(part);
        groups.set(part.group, list);
      }
      for (const parts of groups.values()) push(model.fileName, parts);
      continue;
    }
    push(model.fileName, model.parts);
  }
  return blocks;
}

/**
 * Distribuye rectángulos (ancho X, fondo Z) en filas; devuelve el centro de cada uno relativo
 * al centro del conjunto, y el tamaño total.
 */
function shelfLayout(sizes: Array<[number, number]>, gap: number): { centers: Array<[number, number]>; width: number; depth: number } {
  const area = sizes.reduce((acc, [w, d]) => acc + (w + gap) * (d + gap), 0);
  const widest = sizes.reduce((acc, [w]) => Math.max(acc, w), 0);
  const rowLimit = Math.max(widest, Math.sqrt(area) * 1.5);
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b][1] - sizes[a][1] || a - b);
  const raw: Array<[number, number]> = new Array(sizes.length);
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  let width = 0;
  for (const i of order) {
    const [w, d] = sizes[i];
    if (x > 0 && x + w > rowLimit) {
      z += rowDepth + gap;
      x = 0;
      rowDepth = 0;
    }
    raw[i] = [x + w / 2, z + d / 2];
    x += w + gap;
    rowDepth = Math.max(rowDepth, d);
    width = Math.max(width, x - gap);
  }
  const depth = z + rowDepth;
  return { centers: raw.map(([cx, cz]) => [cx - width / 2, cz - depth / 2]), width, depth };
}

/**
 * Calcula mallas locales y posiciones para insertar los modelos importados.
 *
 * @param occupied Huella de los objetos ya presentes en la escena (null si está vacía).
 */
export function placeImportedModels(
  models: ImportedModel[],
  mode: ImportPlacementMode,
  occupied: FootprintXZ | null = null,
  gap = PLACEMENT_GAP_MM,
): PlacedPart[] {
  const placed: PlacedPart[] = [];
  if (mode === 'original') {
    for (const model of models) {
      for (const part of model.parts) {
        const { mesh, offset } = centerPartOnBed(part);
        placed.push({ part, fileName: model.fileName, mesh, position: offset });
      }
    }
    return placed;
  }

  const blocks = toBlocks(models);
  const sizes = blocks.map((b): [number, number] => [b.bounds[3] - b.bounds[0], b.bounds[5] - b.bounds[2]]);
  const layout = shelfLayout(sizes, gap);
  // Sin escena previa, el conjunto queda centrado en el origen; con escena, a su derecha.
  const originX = occupied ? occupied.maxX + gap + layout.width / 2 : 0;
  const originZ = occupied ? (occupied.minZ + occupied.maxZ) / 2 : 0;

  blocks.forEach((block, i) => {
    const [minX, minY, minZ, maxX, , maxZ] = block.bounds;
    const dx = originX + layout.centers[i][0] - (minX + maxX) / 2;
    const dz = originZ + layout.centers[i][1] - (minZ + maxZ) / 2;
    const dy = -minY;
    for (const part of block.parts) {
      const { mesh, offset } = centerPartOnBed(part);
      placed.push({
        part,
        fileName: block.fileName,
        mesh,
        position: [offset[0] + dx, offset[1] + dy, offset[2] + dz],
      });
    }
  });
  // Invariante: cada pieza leída se coloca a lo sumo una vez (el lector ya aplicó maxParts y maxTriangles).
  if (placed.length > models.reduce((acc, m) => acc + m.parts.length, 0)) throw new ModelImportError('too-many-parts');
  return placed;
}
