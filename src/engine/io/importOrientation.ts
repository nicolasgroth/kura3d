/**
 * @file src/engine/io/importOrientation.ts
 * @description Revisión de orientación de las piezas importadas: una pieza cerrada y orientable
 * con volumen negativo (normales hacia dentro) se reorienta invirtiendo el orden de sus
 * triángulos; si la orientación es mezclada solo se avisa. Los avisos nombran el archivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { engineWarning, type EngineWarning } from '../engineErrors';
import { flipTriangleWinding, orientationState, signedVolumeMm3 } from '../meshOrientation';
import type { ImportedModel } from './importTypes';

/** Reorienta las piezas invertidas de `model` y devuelve el modelo con sus avisos. */
export function fixImportedOrientation(model: ImportedModel): ImportedModel {
  let flipped = false;
  let inconsistent = false;
  const parts = model.parts.map((part) => {
    if (part.mesh.indices.length < 12) return part;
    const state = orientationState(part.mesh);
    if (state === 'inconsistent') {
      inconsistent = true;
      return part;
    }
    if (state !== 'consistent' || signedVolumeMm3(part.mesh) >= 0) return part;
    flipped = true;
    return { ...part, mesh: flipTriangleWinding(part.mesh) };
  });
  const warnings: EngineWarning[] = [...(model.warnings ?? [])];
  if (flipped) warnings.push(engineWarning('IMPORT_NORMALS_FLIPPED', { name: model.fileName }));
  if (inconsistent) warnings.push(engineWarning('IMPORT_NORMALS_INCONSISTENT', { name: model.fileName }));
  return warnings.length > 0 ? { ...model, parts, warnings } : model;
}
