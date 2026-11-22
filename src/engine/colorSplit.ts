/**
 * @file src/engine/colorSplit.ts
 * @description Separación por color con aviso tipado: envuelve `splitMeshByColor` y marca con
 * `SPLIT_COLOR_NON_MANIFOLD` las piezas que no quedan como sólidos cerrados (una región de color es
 * una superficie abierta salvo que cubra cuerpos completos), para que la UI y MCP no presenten como
 * imprimible una pieza con bordes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, SceneObject, Vec3 } from '../types/kura';
import { engineWarning, type EngineWarning } from './engineErrors';
import { isClosedMesh } from './meshClosure';
import { splitMeshByColor } from './operations';

/** Resultado de separar por color: piezas y avisos. */
export interface ColorSplitResult {
  parts: Array<{ color: string; mesh: MeshData; position: Vec3 }>;
  warnings: EngineWarning[];
}

/** Separa `obj` por color y avisa cuántas piezas no son sólidos cerrados. */
export function splitMeshByColorDetailed(obj: SceneObject): ColorSplitResult {
  const parts = splitMeshByColor(obj);
  const open = parts.length > 1 ? parts.filter((part) => !isClosedMesh(part.mesh)).length : 0;
  return { parts, warnings: open > 0 ? [engineWarning('SPLIT_COLOR_NON_MANIFOLD', { count: open })] : [] };
}
