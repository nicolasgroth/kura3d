/**
 * @file src/store/__tests__/importMainThreadWork.test.ts
 * @description Trabajo del hilo principal al importar: las estadísticas y los cuerpos llegan hechos
 * desde el Worker (una vez por malla única) y las piezas entran a la escena por tandas acotadas en
 * triángulos, cediendo hasta el pintado entre tandas e informando el avance real («7 de 19»), con un solo
 * paso de deshacer; cancelar a mitad deja la escena como estaba. Se cuenta, no se mide con reloj.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { parseModelFile } from '../../engine';
import { cubeMeshXml, modelXml, pack3mf, translate } from '../../engine/__tests__/ioFixtures';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import type { SceneObject } from '../../types/kura';
import { createModelIoActions } from '../modelIoActions';
import { TRANSLATIONS } from '../../i18n/translations';

const tr = (key: string, params?: Record<string, string | number>) =>
  Object.entries(params ?? {}).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), (TRANSLATIONS.es as Record<string, string>)[key] ?? key);

const PARTS = 19;
const file3mf = () => pack3mf({
  '3D/3dmodel.model': modelXml(
    Array.from({ length: PARTS }, (_, i) => `<object id="${i + 1}" name="P${i + 1}">${cubeMeshXml(5)}</object>`).join(''),
    Array.from({ length: PARTS }, (_, i) => `<item objectid="${i + 1}" transform="${translate(i * 20, 0, 0)}"/>`).join(''),
  ),
});

describe('importación: trabajo del hilo principal', () => {
  it('el Worker entrega estadísticas y cuerpos por pieza', () => {
    const model = parseModelFile('p.3mf', file3mf());
    expect(model.parts).toHaveLength(PARTS);
    for (const part of model.parts) {
      expect(part.analysis?.stats.triangles).toBe(12);
      expect(part.analysis?.stats.isManifold).toBe(true);
      expect(part.analysis?.stats.volumeMm3).toBeCloseTo(125, 3);
      expect(part.analysis?.bodies).toBe(1);
    }
  });

  /** Store mínimo en memoria con contadores de historial y cesiones. */
  function harness(initial: SceneObject[] = [], extra: { signal?: AbortSignal; onYield?: (n: number) => void } = {}) {
    const model = parseModelFile('p.3mf', file3mf());
    let state = {
      language: 'es' as const, objects: initial, groups: [], selectedIds: initial.map((o) => o.id), unitSystem: 'mm', printerProfile: {}, projectName: null,
      importPlacementMode: 'bed' as const, addToast: (text: string) => void toasts.push(text), requestCameraPreset: () => {},
    };
    const toasts: string[] = [];
    const history: Array<{ objects: SceneObject[] } | undefined> = [];
    const progress: Array<[number, number]> = [];
    const sceneAtYield: number[] = [];
    let statsProvided = 0;
    const io = createModelIoActions({
      get: () => state as never,
      set: (updater) => { state = { ...state, ...updater(state as never) } as typeof state; },
      tr: tr as never,
      pushHistory: (before) => void history.push(before),
      buildObject: (p) => {
        if (p.stats) statsProvided++;
        return buildSceneObject({ ...p, source: 'imported' });
      },
      onBuildProgress: (done, total) => progress.push([done, total]),
      // Cesión simulada (sin reloj): registra cuántos objetos hay en la escena en cada pintado.
      yieldFrame: async () => {
        sceneAtYield.push(state.objects.length);
        extra.onYield?.(sceneAtYield.length);
      },
      batchTriangles: 12 * 5,
      createImportSession: () => ({ parse: async () => model, dispose: () => {} }),
    });
    const run = () => io.importModelFiles([{ name: 'p.3mf', read: async () => new ArrayBuffer(0) }], { signal: extra.signal });
    return { run, history, progress, sceneAtYield, toasts, get state() { return state; }, get statsProvided() { return statsProvided; } };
  }

  it('entra a la escena por tandas acotadas, pintando entre tandas, con avance real y un solo paso de deshacer', async () => {
    const h = harness();
    expect(await h.run()).toBe(true);
    // 19 cubos de 12 triángulos en tandas de 60: 5 + 5 + 5 + 4; se pinta tras cada tanda intermedia.
    expect(h.sceneAtYield).toEqual([5, 10, 15]);
    expect(h.progress).toEqual([[5, PARTS], [10, PARTS], [15, PARTS], [PARTS, PARTS]]);
    expect(h.history).toHaveLength(1);
    expect(h.history[0]?.objects).toEqual([]);
    expect(h.state.objects).toHaveLength(PARTS);
    expect(h.state.selectedIds).toEqual(h.state.objects.map((o) => o.id));
    expect(h.statsProvided).toBe(PARTS);
  });

  it('cancelar a mitad deja la escena como estaba y sin paso de deshacer', async () => {
    const existing = buildSceneObject({ name: 'previo', source: 'imported', mesh: parseModelFile('p.3mf', file3mf()).parts[0].mesh, position: [0, 0, 0], color: '#fff' });
    const controller = new AbortController();
    const h = harness([existing], { signal: controller.signal, onYield: (n) => n === 2 && controller.abort() });
    const objectsBefore = h.state.objects;
    expect(await h.run()).toBe(false);
    expect(h.sceneAtYield).toEqual([6, 11]);
    expect(h.state.objects).toBe(objectsBefore);
    expect(h.state.selectedIds).toEqual([existing.id]);
    expect(h.state.groups).toEqual([]);
    expect(h.history).toHaveLength(0);
    expect(h.toasts.some((t) => /cancel/i.test(t))).toBe(true);
  });
});
