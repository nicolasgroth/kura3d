/**
 * @file src/utils/platformBridge.native.test.ts
 * @description Pruebas del puente nativo: un fallo de escritura en Tauri se propaga (no se
 * disfraza de descarga web exitosa) y la cancelación devuelve false.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const writeFile = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({ save, open: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile, readFile: vi.fn(), stat: vi.fn() }));

const { FileSaveError, saveBinaryFile, saveFileSet } = await import('./platformBridge');

describe('saveBinaryFile en Tauri', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    save.mockReset();
    writeFile.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('propaga el error de escritura en vez de caer a una descarga web', async () => {
    save.mockResolvedValue('C:/modelos/pieza.stl');
    writeFile.mockRejectedValue(new Error('acceso denegado'));
    await expect(saveBinaryFile('pieza.stl', new Uint8Array(4), [{ name: 'STL', extensions: ['stl'] }]))
      .rejects.toBeInstanceOf(FileSaveError);
  });

  it('devuelve false si el usuario cancela y true si escribe', async () => {
    save.mockResolvedValueOnce(null);
    expect(await saveBinaryFile('pieza.stl', new Uint8Array(4), [{ name: 'STL', extensions: ['stl'] }])).toBe(false);
    save.mockResolvedValueOnce('C:/modelos/pieza.stl');
    writeFile.mockResolvedValueOnce(undefined);
    expect(await saveBinaryFile('pieza.stl', new Uint8Array(4), [{ name: 'STL', extensions: ['stl'] }])).toBe(true);
  });

  it('propone la carpeta del archivo principal para el MTL de un OBJ', async () => {
    save.mockResolvedValueOnce('D:\\salida\\pieza.obj').mockResolvedValueOnce('D:\\salida\\pieza.mtl');
    writeFile.mockResolvedValue(undefined);
    expect(await saveFileSet([
      { name: 'pieza.obj', data: new Uint8Array(1), filters: [{ name: 'OBJ', extensions: ['obj'] }] },
      { name: 'pieza.mtl', data: new Uint8Array(1), filters: [{ name: 'MTL', extensions: ['mtl'] }] },
    ])).toBe(true);
    expect(save.mock.calls[1][0].defaultPath).toBe('D:\\salida\\pieza.mtl');
    expect(writeFile).toHaveBeenCalledTimes(2);
  });
});
