/**
 * @file mcp-server/src/headlessExport.ts
 * @description Exportación a disco del modo headless de Kura3D usando los codificadores del
 * motor compartido (`exportSceneToBinarySTL` y `exportSceneTo3MF` de `src/engine`). El 3MF lleva
 * la paleta `<basematerials>` y el color por triángulo igual que la app. El STL ASCII se obtiene
 * transcribiendo el STL binario del motor, por lo que la geometría es idéntica en ambos formatos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { exportSceneTo3MF, exportSceneToBinarySTL } from '../../src/engine/index';
import type { HeadlessSceneObject } from './headlessSupport.js';
import type { UnitSystem } from './types.js';

/** Resultado de exportación STL/3MF en disco. */
export interface ExportFileResult {
  mode: 'headless';
  path: string;
  format: 'stl-binary' | 'stl-ascii' | '3mf';
  objectCount: number;
  triangles: number;
  /** Colores distintos escritos en `<basematerials>` (solo 3MF). */
  colorCount?: number;
  bytesWritten: number;
}

/** Objetos que el motor realmente exporta (visibles y sólidos), con error si no queda ninguno. */
function exportableObjects(targets: HeadlessSceneObject[]): HeadlessSceneObject[] {
  const solids = targets.filter((o) => o.visible && !o.isHole);
  if (solids.length === 0) {
    throw new Error(
      'There are no visible solid objects to export (hidden objects or objects marked as holes are not exported).'
    );
  }
  return solids;
}

/** Transcribe un STL binario (80 B cabecera + 50 B por triángulo) a STL ASCII equivalente. */
export function binaryStlToAscii(bytes: Uint8Array, solidName = 'Kura3D'): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triCount = view.getUint32(80, true);
  const f = (offset: number) => view.getFloat32(offset, true).toExponential(6);
  const lines: string[] = [`solid ${solidName}`];
  for (let t = 0; t < triCount; t++) {
    const base = 84 + t * 50;
    lines.push(`  facet normal ${f(base)} ${f(base + 4)} ${f(base + 8)}`, '    outer loop');
    for (let v = 0; v < 3; v++) {
      const o = base + 12 + v * 12;
      lines.push(`      vertex ${f(o)} ${f(o + 4)} ${f(o + 8)}`);
    }
    lines.push('    endloop', '  endfacet');
  }
  lines.push(`endsolid ${solidName}`);
  return `${lines.join('\n')}\n`;
}

/** Escribe un STL (binario o ASCII) con las transformaciones mundiales aplicadas por el motor. */
export async function writeStlFile(
  outputPath: string,
  targets: HeadlessSceneObject[],
  binary: boolean
): Promise<ExportFileResult> {
  const solids = exportableObjects(targets);
  const binaryBytes = exportSceneToBinarySTL(solids);
  const triangles = new DataView(binaryBytes.buffer, binaryBytes.byteOffset).getUint32(80, true);
  const data = binary ? binaryBytes : Buffer.from(binaryStlToAscii(binaryBytes), 'utf8');

  const resolvedPath = resolve(outputPath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, data);

  return {
    mode: 'headless',
    path: resolvedPath,
    format: binary ? 'stl-binary' : 'stl-ascii',
    objectCount: solids.length,
    triangles,
    bytesWritten: data.byteLength,
  };
}

/** Escribe un único 3MF estándar (como la app) con materiales y colores por triángulo generado por el motor. */
export async function write3mfFile(
  outputPath: string,
  targets: HeadlessSceneObject[],
  units: UnitSystem
): Promise<ExportFileResult> {
  const solids = exportableObjects(targets);
  const bytes = exportSceneTo3MF(solids, units);

  // Lee de vuelta el modelo escrito por el motor para informar exactamente lo exportado
  const modelXml = strFromU8(unzipSync(bytes, { filter: (f) => f.name === '3D/3dmodel.model' })['3D/3dmodel.model']);
  const triangles = (modelXml.match(/<triangle /g) ?? []).length;
  const colorCount = (modelXml.match(/<base /g) ?? []).length;

  const resolvedPath = resolve(outputPath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, bytes);

  return {
    mode: 'headless',
    path: resolvedPath,
    format: '3mf',
    objectCount: solids.length,
    triangles,
    colorCount,
    bytesWritten: bytes.byteLength,
  };
}
