/**
 * @file src/store/splitExport.ts
 * @description Exportación de piezas de "dividir para imprimir": un archivo por pieza
 * (`<proyecto>_<código>.<ext>`) empaquetado en un ZIP con fflate, y la escena de impresión (cada
 * pieza en su placa, placas una al lado de otra) para un 3MF, sin mover la escena real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { zipSync } from 'fflate';
import { splitPartFileName, splitTransformFor } from '../core/scene/splitGroups';
import type { ExportTaskArgs, ExportTaskResult } from '../core/operations/engineTasks';
import type { SceneObject } from '../types/kura';

/** Modo de exportación de piezas divididas. */
export type SplitExportMode = 'perPiece' | 'printLayout';

/** true si alguno de los objetos es pieza de una división. */
export function hasSplitParts(objects: SceneObject[]): boolean {
  return objects.some((o) => Boolean(o.metadata?.split));
}

/** Código de archivo de un objeto: el de la pieza o, si no es pieza, su nombre. */
const fileCode = (o: SceneObject) => o.metadata?.split?.code ?? o.name;

/**
 * Exporta cada objeto por separado y los empaqueta en un ZIP. Los archivos auxiliares (p. ej. `.mtl`)
 * comparten el nombre de su pieza. Devuelve los bytes del ZIP y la cantidad de piezas.
 */
export async function zipPerPiece(
  targets: SceneObject[],
  base: string,
  args: Omit<ExportTaskArgs, 'targets' | 'baseName'>,
  exportFiles: (a: ExportTaskArgs) => Promise<ExportTaskResult>,
): Promise<{ data: Uint8Array; count: number }> {
  const entries: Record<string, Uint8Array> = {};
  for (const obj of targets) {
    const name = splitPartFileName(base, fileCode(obj), args.format);
    const stem = name.slice(0, -(args.format.length + 1));
    const { files } = await exportFiles({ ...args, targets: [obj], baseName: stem });
    for (const f of files) {
      let entry = `${stem}${f.suffix}`;
      for (let n = 2; entries[entry]; n++) entry = `${stem}_${n}${f.suffix}`;
      entries[entry] = f.data;
    }
  }
  return { data: zipSync(entries, { level: 6 }), count: targets.length };
}

/** Objetos en su disposición de impresión (las piezas que no son de una división quedan igual). */
export function printLayoutTargets(targets: SceneObject[], bedWidthMm: number): SceneObject[] {
  return targets.map((o) => {
    const meta = o.metadata?.split;
    if (!meta) return o;
    const t = splitTransformFor(meta, 'print', bedWidthMm);
    return { ...o, position: t.position, rotation: t.rotation, scale: [1, 1, 1] };
  });
}
