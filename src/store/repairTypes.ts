/**
 * @file src/store/repairTypes.ts
 * @description Tipos del slice de "Reparar malla": diagnóstico vigente (para resaltar los bordes
 * abiertos en el visor y mostrarlo en el panel de análisis) y las acciones de diagnosticar y reparar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type * as engine from '../engine';
import type { SceneObject } from '../types/kura';

export interface MeshDiagnosisState {
  objectId: string;
  /** Malla diagnosticada: si la del objeto cambia, el diagnóstico deja de valer. */
  mesh: SceneObject['mesh'];
  diagnosis: engine.MeshDiagnosis;
  /** false: diagnóstico pedido solo para informar (inspector), sin resaltar los bordes en el visor. */
  highlight?: boolean;
}

export interface RepairSliceState {
  /** Diagnóstico de malla vigente (bordes abiertos resaltados en el visor). */
  meshDiagnosis: MeshDiagnosisState | null;
  /** Diagnostica la malla del objeto en el Worker (solo lectura). */
  diagnoseObjectMesh: (id: string, options?: { highlight?: boolean }) => Promise<engine.MeshDiagnosis | null>;
  /** Muestra u oculta en el visor los bordes libres del objeto (lo diagnostica si hace falta). */
  setOpenEdgesVisible: (id: string, visible: boolean) => Promise<void>;
  /** Repara la malla del objeto en el Worker; un paso de deshacer. `null` si falló o no aplica. */
  repairObjectMesh: (id: string, options?: Omit<engine.MeshRepairOptions, 'onProgress'>) => Promise<engine.MeshRepairReport | null>;
  clearMeshDiagnosis: () => void;
}
