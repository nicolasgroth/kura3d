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
import type { ImportedModel, ImportedPart } from './importTypes';
import { boundsOf, centerMeshOnBed } from './meshBuffers';

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
    const b = boundsOf(part.mesh.positions);
    for (let k = 0; k < 3; k++) {
      out[k] = Math.min(out[k], b[k]);
      out[k + 3] = Math.max(out[k + 3], b[k + 3]);
    }
  }
  return out;
}

/** Divide los modelos en bloques rígidos según si traen posiciones con significado. */
function toBlocks(models: ImportedModel[]): Block[] {
  const blocks: Block[] = [];
  for (const model of models) {
    if (model.hasPlacement) {
      blocks.push({ fileName: model.fileName, parts: model.parts, bounds: unionBounds(model.parts) });
      continue;
    }
    const groups = new Map<number, ImportedPart[]>();
    for (const part of model.parts) {
      const list = groups.get(part.group) ?? [];
      list.push(part);
      groups.set(part.group, list);
    }
    for (const parts of groups.values()) {
      blocks.push({ fileName: model.fileName, parts, bounds: unionBounds(parts) });
    }
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
        const { mesh, offset } = centerMeshOnBed(part.mesh);
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
      const { mesh, offset } = centerMeshOnBed(part.mesh);
      placed.push({
        part,
        fileName: block.fileName,
        mesh,
        position: [offset[0] + dx, offset[1] + dy, offset[2] + dz],
      });
    }
  });
  return placed;
}
