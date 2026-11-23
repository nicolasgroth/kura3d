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
import type { MeshData } from '../../types/kura';
import type { ImportedModel } from './importTypes';

/** Reorienta las piezas invertidas de `model` y devuelve el modelo con sus avisos. */
export function fixImportedOrientation(model: ImportedModel): ImportedModel {
  let flipped = false;
  let inconsistent = false;
  // Una vez por malla: las instancias que la comparten siguen compartiendo la malla corregida.
  const fixed = new Map<MeshData, MeshData>();
  const fixMesh = (mesh: MeshData): MeshData => {
    if (mesh.indices.length < 12) return mesh;
    const state = orientationState(mesh);
    if (state === 'inconsistent') {
      inconsistent = true;
      return mesh;
    }
    if (state !== 'consistent' || signedVolumeMm3(mesh) >= 0) return mesh;
    flipped = true;
    return flipTriangleWinding(mesh);
  };
  const parts = model.parts.map((part) => {
    let mesh = fixed.get(part.mesh);
    if (!mesh) {
      mesh = fixMesh(part.mesh);
      fixed.set(part.mesh, mesh);
    }
    return mesh === part.mesh ? part : { ...part, mesh };
  });
  const warnings: EngineWarning[] = [...(model.warnings ?? [])];
  if (flipped) warnings.push(engineWarning('IMPORT_NORMALS_FLIPPED', { name: model.fileName }));
  if (inconsistent) warnings.push(engineWarning('IMPORT_NORMALS_INCONSISTENT', { name: model.fileName }));
  return warnings.length > 0 ? { ...model, parts, warnings } : model;
}
