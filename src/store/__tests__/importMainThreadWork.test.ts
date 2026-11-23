/**
 * @file src/store/__tests__/importMainThreadWork.test.ts
 * @description Trabajo del hilo principal al importar: las estadísticas y los cuerpos llegan hechos
 * desde el Worker (una vez por malla única) y el store construye los objetos de a una pieza, cediendo
 * el bucle de eventos entre piezas e informando el avance real («7 de 19»). Se mide contando trabajo
 * síncrono por tramo, no con reloj.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
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

  it('construye de a una pieza cediendo el bucle entre piezas, con avance real y sin recalcular estadísticas', async () => {
    const model = parseModelFile('p.3mf', file3mf());
    const objects: SceneObject[] = [];
    let state = {
      language: 'es' as const, objects, groups: [], selectedIds: [] as string[], unitSystem: 'mm', printerProfile: {}, projectName: null,
      importPlacementMode: 'bed' as const, addToast: () => {}, requestCameraPreset: () => {},
    };
    // Reloj lógico: cuenta los turnos del bucle de eventos que corren mientras se importa.
    let ticks = 0;
    let ticking = true;
    const tick = () => {
      ticks++;
      if (ticking) setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    const builtAtTick: number[] = [];
    const progress: Array<[number, number]> = [];
    let statsProvided = 0;
    const io = createModelIoActions({
      get: () => state as never,
      set: (updater) => { state = { ...state, ...updater(state as never) } as typeof state; },
      tr: tr as never,
      pushHistory: () => {},
      buildObject: (p) => {
        builtAtTick.push(ticks);
        if (p.stats) statsProvided++;
        return buildSceneObject({ ...p, source: 'imported' });
      },
      onBuildProgress: (done, total) => progress.push([done, total]),
      createImportSession: () => ({ parse: async () => model, dispose: () => {} }),
    });
    expect(await io.importModelFiles([{ name: 'p.3mf', read: async () => new ArrayBuffer(0) }])).toBe(true);
    ticking = false;
    expect(builtAtTick).toHaveLength(PARTS);
    // Entre una pieza y la siguiente corrió al menos un turno del bucle: ninguna racha síncrona de 2+ piezas.
    for (let i = 1; i < builtAtTick.length; i++) expect(builtAtTick[i]).toBeGreaterThan(builtAtTick[i - 1]);
    expect(progress).toEqual(Array.from({ length: PARTS }, (_, i) => [i + 1, PARTS]));
    expect(statsProvided).toBe(PARTS);
    expect((state as { objects: SceneObject[] }).objects).toHaveLength(PARTS);
  });
});
