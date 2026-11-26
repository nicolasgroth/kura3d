/**
 * @file mcp-server/src/__tests__/exportPathsMkdir.test.ts
 * @description `resolveExportPath` verifica la ruta real del ancestro existente antes de crear
 * subdirectorios: una junction que sale de la raíz no deja carpetas creadas fuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { mkdir, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ExportPathError, resolveExportPath } from '../exportPaths.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()?.();
});

describe('resolveExportPath no crea directorios fuera de la raíz', () => {
  it('rechaza link/sub/x.stl sin crear "sub" en el destino del enlace', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'kura3d-out-'));
    const root = await mkdtemp(join(tmpdir(), 'kura3d-root-'));
    cleanup.push(() => rm(outside, { recursive: true, force: true }), () => rm(root, { recursive: true, force: true }));
    await mkdir(root, { recursive: true });
    await symlink(outside, join(root, 'link'), 'junction');

    await expect(resolveExportPath(root, 'link/sub/deep/x.stl', '.stl')).rejects.toBeInstanceOf(ExportPathError);
    await expect(stat(join(outside, 'sub'))).rejects.toThrow();
  });

  it('crea subdirectorios legítimos dentro de la raíz', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kura3d-root-'));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const path = await resolveExportPath(root, 'a/b/pieza.stl', '.stl');
    expect(path.endsWith('pieza.stl')).toBe(true);
    expect((await stat(join(root, 'a', 'b'))).isDirectory()).toBe(true);
  });
});
