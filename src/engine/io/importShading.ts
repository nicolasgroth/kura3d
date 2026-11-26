/**
 * @file src/engine/io/importShading.ts
 * @description Sombreado con pliegue de las piezas importadas, calculado en el Worker de importación
 * (una vez por malla única) para que el visor no lo recalcule en el hilo principal al montar la escena:
 * con un 3MF de millones de triángulos ese cálculo era el bloqueo principal tras leer el archivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { computeCreasedShading, MAX_CREASED_TRIANGLES } from '../../utils/creasedNormals';
import type { ImportedModel } from './importTypes';

/**
 * Adjunta `analysis.shading` a cada pieza que el visor sombrea con pliegue (hasta el tope de
 * triángulos) y devuelve los buffers nuevos para transferirlos sin copia.
 */
export function attachViewportShading(model: ImportedModel): ArrayBuffer[] {
  const transfer = new Set<ArrayBuffer>();
  const done = new Map<unknown, NonNullable<ImportedModel['parts'][number]['analysis']>['shading']>();
  for (const part of model.parts) {
    const { mesh, analysis } = part;
    const triangles = Math.floor(mesh.indices.length / 3);
    if (!analysis || triangles === 0 || triangles > MAX_CREASED_TRIANGLES) continue;
    let shading = done.get(mesh);
    if (!shading) {
      shading = analysis.shading ?? computeCreasedShading(mesh.positions, mesh.indices);
      done.set(mesh, shading);
      for (const buf of [shading.normals, shading.indices, shading.source]) {
        if (buf.buffer instanceof ArrayBuffer) transfer.add(buf.buffer);
      }
    }
    analysis.shading = shading;
  }
  return [...transfer];
}
