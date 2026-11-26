/**
 * @file src/components/viewport/__tests__/paintStrokeController.test.ts
 * @description Trazo del pincel con borde fino desde el visor (pointerdown → move → up): sobre una
 * primitiva sin consentimiento no se modifica nada hasta responder el aviso; "Cancelar" deja el objeto
 * paramétrico intacto; un trazo con refinado es UN paso de historial; tras refinar una zona el pincel
 * sigue refinando en las caras gruesas que quedan.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parametricStateOf } from '../../../core/scene/parametric';
import { useKuraStore } from '../../../store/useKuraStore';
import { settleDecision, useDecisionStore } from '../../../utils/confirmDialog';
import { resetPaintParametricGuard } from '../paintParametricGuard';
import { strokeNeedsEdgeRefine } from '../paintPointer';
import { continueStorePaintStroke, startStorePaintStroke } from '../paintStrokeController';

const tris = () => useKuraStore.getState().objects[0].mesh.indices.length / 3;
const pastLen = () => useKuraStore.getState().past.length;
const obj = () => useKuraStore.getState().objects[0];

/** Suelta el puntero: como el visor, cierra el trazo del store. */
const release = () => {
  useKuraStore.getState().endPaintStroke();
};
const flush = () => new Promise((r) => setTimeout(r, 120));

async function newCube() {
  useKuraStore.setState({
    engineReady: true, objects: [], selectedIds: [], past: [], future: [],
    paintMode: 'brush', paintRadiusMm: 2, paintRefineEdge: true, paintColor: '#ff0000',
  });
  await useKuraStore.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 });
}

/** Arrastre sobre la cara superior (Y local = 20) desde x=-4 hasta x=4. */
function drag(): Promise<void> | void {
  const first = startStorePaintStroke(obj(), { point: [-4, 20, 0], faceIndex: null }, true, () => Promise.resolve());
  for (let x = -3; x <= 4; x++) continueStorePaintStroke(obj().id, { point: [x, 20, 0], faceIndex: null });
  return first;
}

describe('trazo del pincel sobre una primitiva', () => {
  beforeEach(async () => {
    resetPaintParametricGuard();
    await newCube();
  });

  it('sin consentimiento el arrastre no toca nada; Cancelar deja el cubo paramétrico y sin historial', async () => {
    expect(parametricStateOf(obj()).status).toBe('primitive');
    const base = pastLen();
    const pending = drag();
    release();
    await flush();
    expect(tris()).toBe(12);
    expect(useDecisionStore.getState().request?.actions.map((a) => a.id)).toContain('cancel');
    settleDecision('cancel');
    await pending;
    await flush();
    expect(tris()).toBe(12);
    expect(obj().mesh.faceColors).toBeUndefined();
    expect(parametricStateOf(obj()).status).toBe('primitive');
    expect(pastLen()).toBe(base);
  });

  it('«Pintar igual» aplica el trazo capturado en un solo paso; un trazo con refinado es UN paso', async () => {
    const base = pastLen();
    const pending = drag();
    release();
    await flush();
    settleDecision('paint');
    await pending;
    await flush();
    expect(tris()).toBeGreaterThan(12);
    expect(pastLen()).toBe(base + 1);

    // Segundo trazo (ya aceptado) con varias muestras: también un solo paso.
    const second = startStorePaintStroke(obj(), { point: [-4, 0, 0], faceIndex: null }, true);
    expect(second).toBeUndefined();
    for (let x = -3; x <= 4; x++) continueStorePaintStroke(obj().id, { point: [x, 0, 0], faceIndex: null });
    release();
    expect(pastLen()).toBe(base + 2);
    useKuraStore.getState().undo();
    useKuraStore.getState().undo();
    expect(tris()).toBe(12);
  });

  it('tras confirmar, un clic suelto (una sola muestra) y el trazo siguiente también pintan', async () => {
    const base = pastLen();
    // Primer toque: una sola muestra retenida hasta responder el aviso.
    const pending = startStorePaintStroke(obj(), { point: [0, 20, 0], faceIndex: null }, true, () => Promise.resolve());
    release();
    await flush();
    settleDecision('paint');
    await pending;
    await flush();
    expect(pastLen()).toBe(base + 1);
    expect(useKuraStore.getState().isPaintStrokeOpen()).toBe(false);
    const afterFirst = tris();
    expect(afterFirst).toBeGreaterThan(12);
    // Trazo siguiente en otra zona: sin aviso, pinta y es un paso más de historial.
    const second = startStorePaintStroke(obj(), { point: [8, 20, 8], faceIndex: null }, true);
    expect(second).toBeUndefined();
    continueStorePaintStroke(obj().id, { point: [9, 20, 8], faceIndex: null });
    release();
    expect(pastLen()).toBe(base + 2);
    expect(tris()).toBeGreaterThan(afterFirst);
  });

  it('sin trazo abierto, mover con el botón apretado no pinta ni agrega historial', () => {
    const base = pastLen();
    continueStorePaintStroke(obj().id, { point: [0, 20, 0], faceIndex: null });
    expect(tris()).toBe(12);
    expect(pastLen()).toBe(base);
  });

  it('tras refinar una zona, las caras gruesas restantes siguen pidiendo refinado', async () => {
    const pending = drag();
    release();
    await flush();
    settleDecision('paint');
    await pending;
    await flush();
    const { mesh, scale } = obj();
    expect(strokeNeedsEdgeRefine(true, mesh, scale, 2)).toBe(true);
  });
});
