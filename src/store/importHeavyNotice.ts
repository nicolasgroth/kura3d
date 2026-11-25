/**
 * @file src/store/importHeavyNotice.ts
 * @description Decide el aviso de «modelo pesado» tras importar: un solo aviso por importación, que apunta a la
 * pieza más pesada (la que se selecciona al pulsar «Simplificar…»). Desde `heavyMesh.hugeTriangles` (1 millón, el
 * límite desde el que los laminadores avisan) el texto es el más firme, sea por una pieza o por el total
 * importado; entre `warnTriangles` y ese umbral sigue el aviso de siempre. Una malla ya avisada no vuelve a
 * avisar (por ejemplo, al repetir la inserción de la misma malla).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { OPERATION_DEFAULTS } from '../engine/operationLimits';
import type { MeshData, SceneObject } from '../types/kura';

/** Una malla única del archivo y las piezas que la usan. */
export interface UniqueMeshEntry {
  mesh: MeshData;
  entries: ReadonlyArray<{ object: SceneObject }>;
}

export interface HeavyImportNotice {
  /** Clave de i18n del texto (usa `{tris}`). */
  key: 'import.heavy' | 'import.heavy.huge' | 'import.heavy.total';
  /** Triángulos que cita el texto (los de la pieza más pesada o el total). */
  tris: number;
  /** Objeto que se selecciona al simplificar: el de la malla más pesada. */
  id: string;
}

const warned = new WeakSet<MeshData>();
const trisOf = (m: MeshData) => Math.floor(m.indices.length / 3);

/** Aviso a mostrar (o `null`). Cuenta cada malla compartida una sola vez. */
export function heavyImportNotice(unique: readonly UniqueMeshEntry[]): HeavyImportNotice | null {
  const { warnTriangles, hugeTriangles } = OPERATION_DEFAULTS.heavyMesh;
  let top: UniqueMeshEntry | null = null;
  let total = 0;
  for (const u of unique) {
    total += trisOf(u.mesh);
    if (!top || trisOf(u.mesh) > trisOf(top.mesh)) top = u;
  }
  if (!top || warned.has(top.mesh)) return null;
  const tris = trisOf(top.mesh);
  const id = top.entries[0].object.id;
  let notice: HeavyImportNotice | null = null;
  if (tris >= hugeTriangles) notice = { key: 'import.heavy.huge', tris, id };
  else if (total >= hugeTriangles) notice = { key: 'import.heavy.total', tris: total, id };
  else if (tris >= warnTriangles) notice = { key: 'import.heavy', tris, id };
  if (notice) warned.add(top.mesh);
  return notice;
}
