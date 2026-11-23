/**
 * @file src/store/modelImportNotices.test.ts
 * @description Avisos de límites de archivos de modelo: el error de tamaño nombra el tamaño y el
 * máximo, y exportar un archivo sobre el tamaño que otros programas rechazan (o con más triángulos de
 * los que la app reabre) avisa sin impedir la exportación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import * as engine from '../engine';
import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import { t } from '../i18n';
import type { SceneObject } from '../types/kura';
import { LocalFileError, MAX_MODEL_FILE_BYTES, saveFileSet } from '../utils/platformBridge';
import { createModelIoActions, importErrorMessage } from './modelIoActions';
import { exportNotices } from './modelImportNotices';

vi.mock('../utils/platformBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/platformBridge')>()),
  saveFileSet: vi.fn(async () => true),
}));

const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) => t('es', key, params);

describe('mensajes de tamaño', () => {
  it('el error de tamaño dice cuánto pesa el archivo y cuál es el máximo', () => {
    const error = new engine.ModelImportError('too-large', undefined, 'escena.stl', { bytes: 700 * 1024 * 1024, maxBytes: 572 * 1024 * 1024 });
    expect(importErrorMessage(error, 'escena.stl', tr, 'es')).toBe('escena.stl: pesa 700 MB y el máximo que se puede abrir es 572 MB. Simplifícalo en el programa de origen o divide el archivo en partes.');
  });

  it('el selector de archivos usa el máximo de modelos y su error trae los números', () => {
    expect(MAX_MODEL_FILE_BYTES).toBe(MODEL_IO_LIMITS.maxFileBytes);
    const error = new LocalFileError('enorme.stl', 'too-large', { bytes: 600 * 1024 * 1024, maxBytes: MAX_MODEL_FILE_BYTES });
    expect(importErrorMessage(error, 'enorme.stl', tr, 'es')).toBe('enorme.stl: pesa 600 MB y el máximo que se puede abrir es 256 MB. Simplifícalo en el programa de origen o divide el archivo en partes.');
  });

  it('sin el tamaño se mantiene el mensaje genérico', () => {
    expect(importErrorMessage(new engine.ModelImportError('too-large'), 'x.stl', tr)).toBe(t('es', 'importError.too-large', { name: 'x.stl' }));
  });

  it('avisos de exportación: tamaño grande y triángulos sobre el máximo de importación', () => {
    expect(exportNotices([{ name: 'a.stl', bytes: 10 }], 10, tr, 'es')).toEqual([]);
    const notes = exportNotices([{ name: 'a.stl', bytes: 155 * 1024 * 1024 }], MODEL_IO_LIMITS.maxTriangles + 1, tr, 'es');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('155 MB');
    expect(notes[0]).toContain('100 MB');
    expect(notes[1]).toContain('5.368.707');
  });

  it('tope práctico de 256 MiB: un STL binario del máximo de triángulos se puede reabrir', () => {
    expect(MODEL_IO_LIMITS.maxFileBytes).toBe(256 * 1024 * 1024);
    expect(84 + 50 * MODEL_IO_LIMITS.maxTriangles).toBeLessThanOrEqual(MODEL_IO_LIMITS.maxFileBytes);
    expect(84 + 50 * (MODEL_IO_LIMITS.maxTriangles + 1)).toBeGreaterThan(MODEL_IO_LIMITS.maxFileBytes);
  });

  it('avisa al exportar un archivo que pesa más de lo que la app puede reabrir (p. ej. OBJ de texto)', () => {
    const notes = exportNotices([{ name: 'a.obj', bytes: MODEL_IO_LIMITS.maxFileBytes + 1 }], 1000, tr, 'es');
    expect(notes.some((n) => n.includes('256 MB') && n.includes('a.obj') && n.includes('volver a abrir'))).toBe(true);
  });
});

describe('exportModel avisa al superar el tamaño que otros programas rechazan', () => {
  it('exporta y agrega el aviso', async () => {
    const toasts: Array<[string, string | undefined]> = [];
    const mesh = { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]), normals: new Float32Array(9) };
    const obj = { id: 'o1', name: 'Pieza', role: 'solid', visible: true, mesh, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as unknown as SceneObject;
    const big = new Uint8Array(4);
    Object.defineProperty(big, 'byteLength', { value: 160 * 1024 * 1024 });
    const state = {
      language: 'es' as const, objects: [obj], selectedIds: [], unitSystem: 'mm', printerProfile: {}, projectName: 'p',
      importPlacementMode: 'bed' as const, addToast: (text: string, kind?: string) => toasts.push([text, kind]), requestCameraPreset: () => {},
    };
    const io = createModelIoActions({
      get: () => state as never,
      set: () => {},
      tr,
      pushHistory: () => {},
      buildObject: () => obj,
      exportFiles: async () => ({ files: [{ suffix: '.stl', data: big }] }) as never,
    });
    expect(await io.exportModel({ format: 'stl', scope: 'scene', fileName: 'grande' })).toBe(true);
    expect(vi.mocked(saveFileSet)).toHaveBeenCalled();
    expect(toasts.some(([text, kind]) => kind === 'info' && text.includes('160 MB'))).toBe(true);
  });
});
