/**
 * @file src/store/menuIdeasTypes.ts
 * @description Tipos del slice de las ideas de menú: centrar en la cama, restablecer rotación y escala,
 * reemplazar la geometría de un objeto por la de un archivo y pedir el panel Simplificar (aviso de malla pesada).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Archivo ya leído que reemplaza la geometría de un objeto. */
export interface ReplaceMeshFile {
  name: string;
  buffer: ArrayBuffer;
}

export interface MenuIdeasSliceState {
  /** Centra la selección (o `ids`) en X e Y de la cama sin cambiar la altura; un paso de deshacer. */
  centerSelectionOnBed: (ids?: string[]) => boolean;
  /** Restablece la rotación (o la escala) de los objetos sin bloquear; un paso de deshacer. */
  resetObjectsRotation: (ids?: string[]) => boolean;
  resetObjectsScale: (ids?: string[]) => boolean;
  /** Sustituye la malla de `id` por la del archivo conservando nombre, posición, rotación, escala, color y tipo. */
  replaceObjectMesh: (id: string, file: ReplaceMeshFile) => Promise<boolean>;
  /** Pide el archivo (STL/3MF/OBJ/PLY) con el selector del sistema y reemplaza la malla de `id`. */
  replaceObjectMeshFromDialog: (id: string) => Promise<boolean>;
  /** Petición de abrir el panel Simplificar para un objeto (la atiende `useSimplifyRequestRelay`). */
  simplifyRequest: { id: string; n: number; at: number; mode?: 'target' } | null;
  /** `mode: 'target'` abre el panel ya en «Por cantidad» con un objetivo sugerido (aviso de malla pesada). */
  requestSimplifyPanel: (id: string, options?: { mode?: 'target' }) => void;
}
