/**
 * @file mcp-server/src/exportPaths.ts
 * @description Confinamiento de rutas de exportación al directorio permitido configurado:
 * normaliza la ruta solicitada, rechaza traversal (`..`), rutas absolutas fuera de la raíz,
 * extensiones inesperadas y enlaces simbólicos/junctions que escapen de la raíz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { lstat, mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Error de política de exportación (ruta fuera del directorio permitido o inválida). */
export class ExportPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportPathError';
  }
}

/** Indica si `target` está dentro de `root` (o es la misma ruta), tras normalizar. */
export function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel) && rel.split(sep)[0] !== '..');
}

/**
 * Resuelve `requested` dentro de `exportDir` y garantiza que el archivo final quede confinado.
 * Las rutas relativas se resuelven respecto de `exportDir`; las absolutas deben caer dentro.
 * Crea la raíz y subdirectorios necesarios y verifica con `realpath` que ningún enlace los saque fuera.
 */
export async function resolveExportPath(
  exportDir: string,
  requested: string,
  expectedExtension: '.stl' | '.3mf'
): Promise<string> {
  if (typeof requested !== 'string' || requested.trim() === '') {
    throw new ExportPathError('Ruta de exportación vacía.');
  }
  if (/[\u0000-\u001f]/.test(requested)) {
    throw new ExportPathError('La ruta de exportación contiene caracteres de control.');
  }

  const root = resolve(exportDir);
  const target = resolve(root, requested.trim());

  if (!isInsideRoot(root, target) || target === root) {
    throw new ExportPathError(
      `Ruta de exportación fuera del directorio permitido (${root}). Usa una ruta relativa dentro de él.`
    );
  }
  if (extname(target).toLowerCase() !== expectedExtension) {
    throw new ExportPathError(`La ruta de exportación debe terminar en ${expectedExtension}.`);
  }

  await mkdir(root, { recursive: true });
  const realRoot = await realpath(root);

  // Crea solo subdirectorios bajo la raíz y valida su ruta real (bloquea symlinks/junctions hacia fuera).
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (!isInsideRoot(realRoot, realParent)) {
    throw new ExportPathError('La ruta de exportación atraviesa un enlace que sale del directorio permitido.');
  }

  const finalPath = join(realParent, basename(target));
  try {
    const info = await lstat(finalPath);
    if (info.isSymbolicLink()) {
      throw new ExportPathError('El destino de exportación es un enlace simbólico; se rechaza por seguridad.');
    }
    if (!info.isFile()) {
      throw new ExportPathError('El destino de exportación existe y no es un archivo regular.');
    }
  } catch (err) {
    if (err instanceof ExportPathError) throw err;
    // ENOENT: el archivo aún no existe, caso normal. Cualquier otro error se propaga.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  return finalPath;
}
