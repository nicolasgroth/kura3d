/**
 * @file src/store/__tests__/paintHistory.store.test.ts
 * @description Historial de pintura en el store: un trazo en vivo = UN paso guardado como delta,
 * deshacer/rehacer restauran exactamente (incluido "sin pintar"), un trazo sin cambios no deja paso
 * ni colores, pintar de una vez (relleno, MCP) también guarda delta, mezcla de deltas con
 * instantáneas y guardado `.kura` con deltas convertidos en instantáneas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PaintStrokeSession } from '../../engine/paint/strokeSession';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import type { Vec3 } from '../../types/kura';
import { isPaintDeltaStep } from '../historySteps';
import { hasProjectChanged } from '../projectDocument';
import { captureProject } from '../useKuraStore';
import { addBox, resetStore, store } from './storeTestUtils';

beforeEach(() => resetStore());

/** Trazo en vivo como lo hace el visor: preparar, pintar muestras fuera del store y cerrar. */
function liveStroke(id: string, points: Vec3[], color: string, radius = 3) {
  const mesh = store().preparePaintStroke(id)!;
  const obj = store().objects.find((o) => o.id === id)!;
  const session = new PaintStrokeSession(mesh, obj.color);
  for (const center of points) session.paint({ center, radiusMm: radius, scale: obj.scale, eye: [center[0], 100, center[2]] }, color);
  store().commitPaintStroke(id, session.finish());
}

const topPoints: Vec3[] = Array.from({ length: 10 }, (_, i) => [i - 5, 10, 0]);

describe('trazo en vivo', () => {
  it('un trazo = un paso delta; deshacer vuelve a sin pintar y rehacer restaura exacto', async () => {
    const box = await addBox(10);
    const steps = store().past.length;
    liveStroke(box.id, topPoints, '#ff0000');
    const painted = store().objects[0].mesh.faceColors!;
    expect(painted.filter((c) => c === '#ff0000').length).toBeGreaterThan(0);
    expect(store().past).toHaveLength(steps + 1);
    expect(isPaintDeltaStep(store().past[steps])).toBe(true);

    store().undo();
    expect(store().objects[0].mesh.faceColors).toBeUndefined();
    store().redo();
    expect(store().objects[0].mesh.faceColors).toEqual(painted);
    expect(store().past).toHaveLength(steps + 1);
  });

  it('un trazo sin cambios no deja paso ni colores por cara', async () => {
    const box = await addBox(10);
    const before = store().objects[0].mesh;
    const steps = store().past.length;
    liveStroke(box.id, [[500, 500, 500]], '#ff0000');
    expect(store().past).toHaveLength(steps);
    expect(store().objects[0].mesh).toBe(before);
  });

  it('solo pinta la cara de arriba (no atraviesa la pieza)', async () => {
    const box = await addBox(10);
    liveStroke(box.id, [[0, 10, 0]], '#00ff00', 20);
    const obj = store().objects[0];
    const { positions: P, indices: I, faceColors } = obj.mesh;
    faceColors!.forEach((c, t) => {
      if (c !== '#00ff00') return;
      // Cara de frente a una cámara sobre la pieza: normal con componente Y positiva.
      const y = (k: number) => P[I[t * 3 + k] * 3 + 1];
      expect(Math.min(y(0), y(1), y(2))).toBeGreaterThan(9.99);
    });
  });

  it('deltas e instantáneas mezclados: deshacer todo y rehacer todo da la misma escena', async () => {
    const box = await addBox(10);
    liveStroke(box.id, topPoints, '#ff0000');
    store().setObjectTransform(box.id, { position: [5, 0, 0] }, true);
    liveStroke(box.id, [[0, 10, 0]], '#0000ff', 6);
    const final = store().objects[0];
    const steps = store().past.length;
    for (let i = 0; i < steps; i++) store().undo();
    for (let i = 0; i < steps; i++) store().redo();
    expect(store().objects[0].mesh.faceColors).toEqual(final.mesh.faceColors);
    expect(store().objects[0].position).toEqual(final.position);
  });
});

describe('pintar de una vez', () => {
  it('el relleno por región guarda un delta y deshacer restaura', async () => {
    const box = await addBox(10);
    store().setPaintSettings({ paintColor: '#ff0000', paintMode: 'smart_fill' });
    store().paintObjectSurface(box.id, null, 0);
    expect(isPaintDeltaStep(store().past[store().past.length - 1])).toBe(true);
    store().undo();
    expect(store().objects[0].mesh.faceColors).toBeUndefined();
  });
});

describe('archivo .kura con deltas', () => {
  it('se guardan como instantáneas y el proyecto queda sin cambios tras guardar', async () => {
    const box = await addBox(10);
    liveStroke(box.id, topPoints, '#ff0000');
    liveStroke(box.id, [[0, 10, 0]], '#0000ff', 6);
    const doc = captureProject(store());
    expect(doc.past.every((s) => Array.isArray(s.objects))).toBe(true);
    expect(hasProjectChanged(doc, store())).toBe(false);
    const back = decodeProject(encodeProject(doc));
    const last = back.past[back.past.length - 1];
    // El paso anterior al último trazo tiene el rojo pero no el azul.
    expect(last.objects[0].mesh.faceColors!.includes('#ff0000')).toBe(true);
    expect(last.objects[0].mesh.faceColors!.includes('#0000ff')).toBe(false);
    expect(back.past[back.past.length - 2].objects[0].mesh.faceColors).toBeUndefined();
  });
});
