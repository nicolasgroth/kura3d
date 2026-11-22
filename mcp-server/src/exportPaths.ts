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

/** Sube desde `path` hasta el primer directorio que existe (como mucho, `root`, que ya existe). */
async function nearestExistingAncestor(path: string, root: string): Promise<string> {
  let current = path;
  while (current !== root) {
    try {
      await lstat(current);
      return current;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const up = dirname(current);
    if (up === current) break;
    current = up;
  }
  return root;
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
    throw new ExportPathError('Export path is empty.');
  }
  if (/[\u0000-\u001f]/.test(requested)) {
    throw new ExportPathError('The export path contains control characters.');
  }

  const root = resolve(exportDir);
  const target = resolve(root, requested.trim());

  if (!isInsideRoot(root, target) || target === root) {
    throw new ExportPathError(
      `Export path is outside the allowed directory (${root}). Use a relative path inside it.`
    );
  }
  if (extname(target).toLowerCase() !== expectedExtension) {
    throw new ExportPathError(`The export path must end in ${expectedExtension}.`);
  }

  await mkdir(root, { recursive: true });
  const realRoot = await realpath(root);

  // Antes de crear nada, el ancestro existente más cercano debe resolver dentro de la raíz: si un
  // enlace sale de ella, `mkdir` crearía carpetas fuera antes del rechazo.
  const parent = dirname(target);
  const realAncestor = await realpath(await nearestExistingAncestor(parent, root));
  if (!isInsideRoot(realRoot, realAncestor)) {
    throw new ExportPathError('The export path traverses a link that leaves the allowed directory.');
  }
  // Crea solo subdirectorios bajo la raíz y revalida su ruta real (bloquea symlinks/junctions hacia fuera).
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (!isInsideRoot(realRoot, realParent)) {
    throw new ExportPathError('The export path traverses a link that leaves the allowed directory.');
  }

  const finalPath = join(realParent, basename(target));
  try {
    const info = await lstat(finalPath);
    if (info.isSymbolicLink()) {
      throw new ExportPathError('The export destination is a symbolic link; it is rejected for security.');
    }
    if (!info.isFile()) {
      throw new ExportPathError('The export destination exists and is not a regular file.');
    }
  } catch (err) {
    if (err instanceof ExportPathError) throw err;
    // ENOENT: el archivo aún no existe, caso normal. Cualquier otro error se propaga.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  return finalPath;
}
