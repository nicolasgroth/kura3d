/**
 * @file src/engine/io/partGeometry.ts
 * @description Geometría de piezas importadas que pueden compartir malla (instancias repetidas de un
 * 3MF): la malla es inmutable y se comparte por referencia; la pieza aporta su traslación. Cajas y
 * centrado se calculan una vez por malla (caché por referencia) y se desplazan por pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, Vec3 } from '../../types/kura';
import type { ImportedPart } from './importTypes';
import { boundsOf, centerMeshOnBed } from './meshBuffers';

type Bounds = [number, number, number, number, number, number];

const boundsCache = new WeakMap<MeshData, Bounds>();
const centeredCache = new WeakMap<MeshData, { mesh: MeshData; offset: Vec3 }>();

/** Caja de la malla (una vez por malla). */
export function meshBounds(mesh: MeshData): Bounds {
  let b = boundsCache.get(mesh);
  if (!b) {
    b = boundsOf(mesh.positions);
    boundsCache.set(mesh, b);
  }
  return b;
}

/** Caja de la pieza en coordenadas del archivo (malla + traslación propia). */
export function partBounds(part: Pick<ImportedPart, 'mesh' | 'translation'>): Bounds {
  const b = meshBounds(part.mesh);
  const t = part.translation;
  return t ? [b[0] + t[0], b[1] + t[1], b[2] + t[2], b[3] + t[0], b[4] + t[1], b[5] + t[2]] : b;
}

/**
 * Malla con pivote local (centro XZ, base en Y=0) y la posición que la deja donde estaba la pieza. Las
 * piezas que comparten malla comparten también la malla centrada (misma referencia).
 */
export function centerPartOnBed(part: Pick<ImportedPart, 'mesh' | 'translation'>): { mesh: MeshData; offset: Vec3 } {
  let centered = centeredCache.get(part.mesh);
  if (!centered) {
    centered = centerMeshOnBed(part.mesh);
    centeredCache.set(part.mesh, centered);
  }
  const t = part.translation ?? [0, 0, 0];
  return { mesh: centered.mesh, offset: [centered.offset[0] + t[0], centered.offset[1] + t[1], centered.offset[2] + t[2]] };
}
