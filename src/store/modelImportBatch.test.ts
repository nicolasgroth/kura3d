/**
 * @file src/store/modelImportBatch.test.ts
 * @description Lectura de un lote de modelos con cuidado de memoria: tope total del lote, tope propio
 * de los MTL (sin leerlos ni decodificarlos en el hilo principal), un solo envío de MTL a la sesión,
 * borrador de recuperación antes de un archivo grande y error claro si el Worker se queda sin memoria.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it, vi } from 'vitest';
import * as engine from '../engine';
import { MODEL_IO_LIMITS } from '../engine/operationLimits';
import { t } from '../i18n';
import { readModelBatch } from './modelImportBatch';
import type { ModelImportSource } from './modelIoActions';

const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) => t('es', key, params);
const MiB = 1024 * 1024;

const stubModel = (fileName: string) => ({ fileName, format: 'stl', parts: [] }) as unknown as engine.ImportedModel;

function source(name: string, size: number): ModelImportSource & { read: ReturnType<typeof vi.fn> } {
  return { name, size, read: vi.fn(async () => new Blob(['x'])) };
}

function fakeSession(fail: string[] = []) {
  const parse = vi.fn(async (fileName: string) => {
    if (fail.includes(fileName)) throw new engine.ModelImportError('out-of-memory', 'worker', fileName);
    return stubModel(fileName);
  });
  const dispose = vi.fn();
  const factory = vi.fn((mtls: readonly engine.MtlSource[]) => {
    void mtls;
    return { parse, dispose };
  });
  return { parse, dispose, factory };
}

describe('lote de importación', () => {
  it('aplica un tope total al lote: los archivos que no caben se informan y no se leen', async () => {
    const session = fakeSession();
    const files = [source('a.stl', 200 * MiB), source('b.stl', 200 * MiB), source('c.stl', 200 * MiB)];
    const { models, failures } = await readModelBatch(files, { tr, language: 'es', createSession: session.factory });
    expect(models.map((m) => m.fileName)).toEqual(['a.stl', 'b.stl']);
    expect(files[2].read).not.toHaveBeenCalled();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('c.stl');
    expect(failures[0]).toContain('512 MB');
    expect(session.dispose).toHaveBeenCalled();
  });

  it('el tope del lote también cuenta los bytes leídos cuando el tamaño no se conocía', async () => {
    const session = fakeSession();
    const big = { name: 'x.stl', read: vi.fn(async () => { const b = new Blob(['x']); Object.defineProperty(b, 'size', { value: 300 * MiB }); return b; }) };
    const { models, failures } = await readModelBatch([big, { ...big, name: 'y.stl' }], { tr, language: 'es', createSession: session.factory });
    expect(models).toHaveLength(1);
    expect(failures[0]).toContain('y.stl');
  });

  it('un MTL sobre 8 MiB se rechaza sin leerlo; los demás llegan a la sesión una sola vez y sin decodificar', async () => {
    const session = fakeSession();
    const mtl = source('colores.mtl', 1024);
    const huge = source('enorme.mtl', MODEL_IO_LIMITS.maxMtlBytes + 1);
    const { failures } = await readModelBatch([source('a.obj', 10), source('b.obj', 10), mtl, huge], { tr, language: 'es', createSession: session.factory });
    expect(huge.read).not.toHaveBeenCalled();
    expect(failures.some((f) => f.includes('enorme.mtl') && f.includes('8,0 MB'))).toBe(true);
    expect(session.factory).toHaveBeenCalledTimes(1);
    const entries = session.factory.mock.calls[0][0];
    expect(entries.map((e) => e.name)).toEqual(['colores.mtl']);
    expect(entries[0].data).toBeInstanceOf(Blob);
    expect(session.parse).toHaveBeenCalledTimes(2);
  });

  it('antes de un archivo de más de 64 MiB asegura el borrador de recuperación, una vez por lote', async () => {
    const session = fakeSession();
    const order: string[] = [];
    const ensureRecoveryDraft = vi.fn(async () => { order.push('draft'); });
    session.parse.mockImplementation(async (name: string) => { order.push(name); return stubModel(name); });
    await readModelBatch([source('chico.stl', 10 * MiB), source('grande.stl', 100 * MiB), source('otro.stl', 90 * MiB)], {
      tr, language: 'es', createSession: session.factory, ensureRecoveryDraft,
    });
    expect(ensureRecoveryDraft).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['chico.stl', 'draft', 'grande.stl', 'otro.stl']);
  });

  it('no espera el borrador en lotes chicos', async () => {
    const ensureRecoveryDraft = vi.fn(async () => {});
    await readModelBatch([source('a.stl', 1000)], { tr, language: 'es', createSession: fakeSession().factory, ensureRecoveryDraft });
    expect(ensureRecoveryDraft).not.toHaveBeenCalled();
  });

  it('si el Worker se queda sin memoria el mensaje lo dice y el resto del lote sigue', async () => {
    const session = fakeSession(['grande.stl']);
    const { models, failures } = await readModelBatch([source('grande.stl', 10), source('chico.stl', 10)], { tr, language: 'es', createSession: session.factory });
    expect(models.map((m) => m.fileName)).toEqual(['chico.stl']);
    expect(failures[0]).toContain('no hay memoria suficiente');
    expect(failures[0]).not.toContain('(worker)');
  });
});
