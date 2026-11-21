/**
 * @file src/project/projectFiles.test.ts
 * @description Pruebas de lectura y escritura de archivos de proyecto en web y Tauri.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

// @vitest-environment jsdom

import { invoke } from '@tauri-apps/api/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTauriRuntime, saveBinaryFile } from '../utils/platformBridge';
import { openProjectFile, saveProjectFile } from './projectFiles';
import { MAX_PROJECT_BYTES } from './projectSchema';

vi.mock('../utils/platformBridge', () => ({ isTauriRuntime: vi.fn(), saveBinaryFile: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('Project file IO', () => {
  it('returns null and removes the web input when the picker is canceled', async () => {
    const opening = openProjectFile();
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
    expect(input.accept).toBe('.kura');
    input.dispatchEvent(new Event('cancel'));
    await expect(opening).resolves.toBeNull();
    expect(input.isConnected).toBe(false);
  });

  it('rejects unreadable selections and rejects oversized inputs before reading', async () => {
    const arrayBuffer = vi.fn().mockRejectedValue(new Error('read failed'));
    const chooseFile = (size: number) => {
      const opening = openProjectFile();
      const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
      Object.defineProperty(input, 'files', { value: [{ name: 'modelo.kura', size, arrayBuffer }] });
      input.dispatchEvent(new Event('change'));
      return opening;
    };

    await expect(chooseFile(MAX_PROJECT_BYTES + 1)).rejects.toMatchObject({ code: 'too-large' });
    expect(arrayBuffer).not.toHaveBeenCalled();
    await expect(chooseFile(8)).rejects.toThrow('read failed');
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('preserves native cancellation and errors without switching to browser download', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValueOnce(new ArrayBuffer(0)).mockResolvedValueOnce(null)
      .mockRejectedValueOnce('write failed');
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(openProjectFile()).resolves.toBeNull();
    await expect(saveProjectFile('modelo', bytes)).resolves.toBeNull();
    await expect(saveProjectFile('modelo', bytes, 'session-token')).rejects.toThrow('write failed');
    expect(saveBinaryFile).not.toHaveBeenCalled();

    const payload = vi.mocked(invoke).mock.calls[2][1] as Uint8Array;
    const offset = 4 + new DataView(payload.buffer).getUint32(0, true);
    const metadata = JSON.parse(new TextDecoder().decode(payload.subarray(4, offset)));
    expect(metadata).toEqual({ name: 'modelo.kura', location: 'session-token' });
    expect(payload.subarray(offset)).toEqual(bytes);
  });

  it('uses a browser download and returns no reusable location', async () => {
    vi.mocked(saveBinaryFile).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(saveProjectFile('modelo', bytes)).resolves.toEqual({ name: 'modelo.kura', viaDownload: true });
    expect(saveBinaryFile).toHaveBeenCalledWith('modelo.kura', bytes, [{ name: 'Kura3D', extensions: ['kura'] }]);
    await expect(saveProjectFile('modelo.kura', bytes)).rejects.toThrow('No se pudo iniciar la descarga');
  });

  it('uses the browser picker before encoding and reuses the returned destination after a confirmed write', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const encode = vi.fn(async () => new Uint8Array([2, 7]));
    const picker = vi.fn(async () => {
      expect(encode).not.toHaveBeenCalled();
      return { name: 'Escena.kura', createWritable };
    });
    vi.stubGlobal('showSaveFilePicker', picker);

    const saved = await saveProjectFile('modelo', encode);
    expect(saved?.name).toBe('Escena.kura');
    expect(saved?.location).toBeDefined();
    expect(write).toHaveBeenCalledWith(new Uint8Array([2, 7]));
    expect(close).toHaveBeenCalledOnce();
    expect(await saveProjectFile('modelo', encode, saved?.location)).toEqual(saved);
    expect(picker).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
    expect(saveBinaryFile).not.toHaveBeenCalled();
  });

  it('does not encode or start a download when the browser save dialog is canceled', async () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')));
    const encode = vi.fn();

    await expect(saveProjectFile('modelo', encode)).resolves.toBeNull();
    expect(encode).not.toHaveBeenCalled();
    expect(saveBinaryFile).not.toHaveBeenCalled();
  });
});
