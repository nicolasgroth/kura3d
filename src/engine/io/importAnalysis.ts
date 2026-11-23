/**
 * @file src/engine/io/importAnalysis.ts
 * @description Análisis por malla de lo importado, hecho en el Worker y UNA vez por malla única
 * (instancias que comparten malla comparten análisis): estadísticas (triángulos, volumen, cierre,
 * dimensiones) y cuerpos sueltos. El hilo principal las recibe hechas y no recorre las mallas.
 * Las estadísticas son invariantes a la traslación con que luego se apoya la pieza en la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject } from '../../types/kura';
import type { CreasedShading } from '../../utils/creasedNormals';
import { computeMeshStats } from '../meshStats';
import type { ImportedModel } from './importTypes';
import { countMeshBodies } from './meshBodies';

/** Análisis de una malla importada. */
export interface ImportedMeshAnalysis {
  stats: SceneObject['stats'];
  /** Cuerpos sueltos (null si la malla es demasiado grande para contarlos). */
  bodies: number | null;
  /** Sombreado con pliegue para el visor (solo lo adjunta el Worker; ver `importShading`). */
  shading?: CreasedShading;
}

/** Adjunta `analysis` a cada pieza, calculando una vez por malla (misma referencia = misma malla). */
export function analyzeImportedModel(model: ImportedModel): ImportedModel {
  const cache = new Map<MeshData, ImportedMeshAnalysis>();
  for (const part of model.parts) {
    let analysis = cache.get(part.mesh);
    if (!analysis) {
      analysis = { stats: computeMeshStats(part.mesh), bodies: countMeshBodies(part.mesh) };
      cache.set(part.mesh, analysis);
    }
    part.analysis = analysis;
  }
  return model;
}
