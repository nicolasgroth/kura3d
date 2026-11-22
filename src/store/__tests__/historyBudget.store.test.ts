/**
 * @file src/store/__tests__/historyBudget.store.test.ts
 * @description Historial por presupuesto de memoria en el store: descarte de pasos antiguos, máximo
 * duro, aviso único por sesión, preferencia persistida y compatibilidad del archivo `.kura`
 * (recorte al guardar y lectura de archivos con el tope anterior de 40 pasos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_HISTORY_MAX_STEPS } from '../../project/historyBudget';
import { decodeProject, encodeProject, MAX_UNDO_HISTORY } from '../../project/projectCodec';
import { t } from '../../i18n';
import type { SceneObject } from '../../types/kura';
import { clampHistoryLimits, loadInitialHistoryLimits, STORAGE_HISTORY_LIMITS_KEY } from '../preferencesStorage';
import { hasProjectChanged } from '../projectDocument';
import { captureProject, useKuraStore } from '../useKuraStore';
import type { SceneSnapshot } from '../storeTypes';
import { addBox, resetStore, store } from './storeTestUtils';

const TRIS_10MB = Math.round((10 * 1024 * 1024) / 48);

/** Reemplaza la malla de la caja por una nueva de ~10 MB y registra un paso de historial. */
function bigStep(id: string, i: number): void {
  const base = store().objects.find((o) => o.id === id)!;
  const mesh = { positions: new Float32Array(TRIS_10MB * 9), indices: new Uint32Array(TRIS_10MB * 3) };
  useKuraStore.setState({ objects: store().objects.map((o): SceneObject => (o.id === id ? { ...base, mesh } : o)) });
  store().setObjectTransform(id, { position: [i, 0, 0] }, true);
}

describe('Historial por presupuesto', () => {
  beforeEach(async () => {
    await resetStore();
    store().setHistoryLimits({ budgetMb: 32, maxSteps: 500 });
  });

  // Va primero: el aviso es único por sesión (por store) y esta prueba lo consume.
  it('avisa una sola vez por sesión que se descartaron pasos', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= 10; i++) bigStep(box.id, i);
    const msg = t('es', 'toast.historyTrimmed');
    expect(store().toasts.filter((x) => x.text === msg)).toHaveLength(1);
  });

  it('descarta los pasos más antiguos al superar el presupuesto y conserva el último', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= 8; i++) bigStep(box.id, i);
    const { past } = store();
    expect(past.length).toBeLessThan(8);
    expect(past.length).toBeGreaterThanOrEqual(2);
    // El paso más reciente (la escena previa al último movimiento) siempre sigue ahí.
    const snaps = past as SceneSnapshot[]; // solo hay movimientos: todos son instantáneas
    expect(snaps[snaps.length - 1].objects[0].mesh).not.toBe(snaps[0].objects[0].mesh);
  });

  it('con un solo paso enorme conserva ese paso aunque exceda el presupuesto', async () => {
    store().setHistoryLimits({ budgetMb: 32 });
    const box = await addBox(10);
    bigStep(box.id, 1);
    bigStep(box.id, 2);
    expect(store().past.length).toBeGreaterThanOrEqual(1);
  });

  it('el máximo duro de pasos se respeta aunque sobre memoria', async () => {
    store().setHistoryLimits({ budgetMb: 1024, maxSteps: 50 });
    const box = await addBox(10);
    for (let i = 1; i <= 60; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    expect(store().past.length + store().future.length).toBe(50);
    expect(store().toasts.some((x) => x.text === t('es', 'toast.historyTrimmed'))).toBe(false);
  });

  it('bajar el límite recorta de inmediato y vaciar deja el historial en cero', async () => {
    store().setHistoryLimits({ budgetMb: 1024, maxSteps: 500 });
    const box = await addBox(10);
    for (let i = 1; i <= 80; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    expect(store().past.length).toBe(81);
    store().setHistoryLimits({ maxSteps: 60 });
    expect(store().past.length).toBe(60);
    store().clearHistory();
    expect(store().past).toEqual([]);
    expect(store().future).toEqual([]);
    expect(store().objects).toHaveLength(1);
  });

  it('deshacer y rehacer funcionan con más de 40 pasos', async () => {
    store().setHistoryLimits({ budgetMb: 1024, maxSteps: 500 });
    const box = await addBox(10);
    for (let i = 1; i <= 100; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    for (let i = 0; i < 90; i++) store().undo();
    expect(store().objects[0].position[0]).toBe(10);
    store().redo();
    expect(store().objects[0].position[0]).toBe(11);
  });
});

describe('Preferencia del historial', () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('se persiste con las preferencias y se recupera', () => {
    store().setHistoryLimits({ budgetMb: 512, maxSteps: 1200 });
    expect(JSON.parse(data.get(STORAGE_HISTORY_LIMITS_KEY)!)).toEqual({ budgetMb: 512, maxSteps: 1200 });
    expect(loadInitialHistoryLimits()).toEqual({ budgetMb: 512, maxSteps: 1200 });
  });

  it('valores corruptos o fuera de rango caen al defecto o se acotan', () => {
    data.set(STORAGE_HISTORY_LIMITS_KEY, '{no json');
    expect(loadInitialHistoryLimits().maxSteps).toBe(500);
    data.set(STORAGE_HISTORY_LIMITS_KEY, JSON.stringify({ budgetMb: 99999, maxSteps: 5 }));
    expect(loadInitialHistoryLimits()).toEqual({ budgetMb: 1024, maxSteps: 50 });
    expect(clampHistoryLimits({ budgetMb: NaN, maxSteps: 99999 })).toEqual({ budgetMb: 32, maxSteps: 2000 });
  });

  it('no forma parte del documento del proyecto', () => {
    const doc = captureProject(store());
    expect(Object.keys(doc)).not.toContain('historyLimits');
  });
});

describe('Archivo .kura con historial largo', () => {
  beforeEach(() => resetStore());

  it('guarda solo los pasos más recientes (máx. 40) y se vuelve a leer', async () => {
    store().setHistoryLimits({ budgetMb: 1024, maxSteps: 500 });
    const box = await addBox(10);
    for (let i = 1; i <= 300; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    expect(store().past.length).toBeGreaterThan(MAX_UNDO_HISTORY);
    const doc = captureProject(store());
    expect(doc.past.length).toBe(FILE_HISTORY_MAX_STEPS);
    expect(doc.past[doc.past.length - 1].objects[0].position[0]).toBe(299);
    const back = decodeProject(encodeProject(doc));
    expect(back.past).toHaveLength(FILE_HISTORY_MAX_STEPS);
  });

  it('un proyecto guardado con historial largo no queda "sucio" por el recorte', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= 120; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    const saved = captureProject(store());
    expect(hasProjectChanged(saved, store())).toBe(false);
    store().setObjectTransform(box.id, { position: [500, 0, 0] }, true);
    expect(hasProjectChanged(saved, store())).toBe(true);
  });

  it('sigue aceptando un archivo existente con 40 pasos combinados', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= 25; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    for (let i = 0; i < 10; i++) store().undo();
    const doc = captureProject(store());
    expect(doc.past.length + doc.future.length).toBe(26);
    const back = decodeProject(encodeProject(doc));
    expect(back.past).toHaveLength(16);
    expect(back.future).toHaveLength(10);
  });

  it('el códec sigue rechazando archivos con más de 40 pasos de historial', async () => {
    const box = await addBox(10);
    for (let i = 1; i <= 45; i++) store().setObjectTransform(box.id, { position: [i, 0, 0] }, true);
    const doc = { ...captureProject(store()), past: store().past as SceneSnapshot[] };
    expect(() => encodeProject(doc)).toThrow();
  });
});
