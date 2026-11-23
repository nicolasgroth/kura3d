/**
 * @file src/engine/io/importTypes.ts
 * @description Tipos comunes del resultado de importación de modelos: piezas en coordenadas de
 * archivo (mm, Y-up de Kura3D), procedencia de la posición y diagnóstico de cierre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData } from '../../types/kura';
import type { EngineWarning } from '../engineErrors';
import type { ImportCluster } from './importClusters';
import type { ModelImportLimits } from './importErrors';
import type { KuraSceneGroupMeta, KuraSceneObjectMeta } from './kuraSceneMeta';
import type { UnitHint } from './unitHint';
import type { ImportedMeshAnalysis } from './importAnalysis';

/** Formatos de modelo que Kura3D sabe leer. */
export type ModelImportFormat = 'stl' | 'obj' | '3mf' | 'ply';

/** Pieza importada en coordenadas de escena del archivo (mm, Y-up), sin recentrar. */
export interface ImportedPart {
  name: string;
  /** Color base '#rrggbb' si el archivo lo declara. */
  color?: string;
  mesh: MeshData;
  /** Volumen negativo (p. ej. `negative_part` de Bambu/Orca): se importa como hueco. */
  isHole?: boolean;
  /**
   * Bloque rígido de colocación: piezas con el mismo grupo conservan sus posiciones relativas
   * al acomodarse en la cama (un ítem de build 3MF con sus componentes, o un archivo completo).
   */
  group: number;
  /** Aristas no compartidas por exactamente dos triángulos (0 = cerrada, -1 = sin analizar). */
  openEdges: number;
  /** Estado exacto del objeto si el 3MF lo exportó Kura3D (`mesh` es entonces la malla LOCAL). */
  kura?: KuraSceneObjectMeta;
  /**
   * Traslación (mm, Y-up) de esta pieza respecto de `mesh`, si la malla se comparte con otras piezas
   * (instancias repetidas de un 3MF): la malla es la misma referencia inmutable, sin copiar.
   */
  translation?: [number, number, number];
  /** Estadísticas y cuerpos calculados en el Worker (compartidos por las piezas de la misma malla). */
  analysis?: ImportedMeshAnalysis;
}

/** Placa del laminador (Bambu/Orca): nombre declarado y grupos (`ImportedPart.group`) que lleva. */
export interface ImportedPlate {
  name?: string;
  groups: number[];
}

/** Resultado de leer un archivo de modelo. */
export interface ImportedModel {
  fileName: string;
  format: ModelImportFormat;
  parts: ImportedPart[];
  /**
   * true si el archivo trae posiciones con significado entre grupos (ítems de build 3MF con
   * transformación). Si es false, los grupos se colocan sin solaparse.
   */
  hasPlacement: boolean;
  /** Placas del laminador, solo si el archivo trae dos o más con piezas. */
  plates?: ImportedPlate[];
  /** Conjuntos (placas, montajes) calculados al leer, en el Worker (`importClusters.ts`). */
  clusters?: ImportCluster[];
  /** Ajustes hechos al leer (p. ej. normales invertidas reorientadas), con el nombre del archivo. */
  warnings?: EngineWarning[];
  /**
   * Escena exportada por Kura3D (metadatos `Metadata/Kura3D_scene.json`): se restaura tal cual, sin
   * reacomodo ni conjuntos. Cada pieza trae su estado en `part.kura`.
   */
  kuraScene?: { groups: KuraSceneGroupMeta[] };
  /** Unidades dudosas (STL/OBJ/PLY diminuto o enorme): escalas sugeridas; no se aplica ninguna sola. */
  unitHint?: UnitHint;
}

/** Opciones comunes de lectura. */
export interface ModelParseOptions {
  limits?: Partial<ModelImportLimits>;
  /** Texto MTL asociado a un OBJ (colores `Kd` por material). */
  mtlText?: string;
}
