/**
 * @file src/components/viewport/__tests__/paintStrokeVisibility.test.ts
 * @description El trazo del pincel por el store (borde fino, malla importada, pincelada del bus/MCP y
 * trazo diferido tras «Pintar igual» sobre una primitiva) respeta la misma regla de visibilidad que el
 * trazo en vivo: con la cámara arriba, una placa de 1 mm no se pinta por la cara inferior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { closedPlate, plateObject, wrongFaces } from '../../../engine/paint/__tests__/plateFixtures';
import { useKuraStore } from '../../../store/useKuraStore';
import type { Vec3 } from '../../../types/kura';
import { settleDecision } from '../../../utils/confirmDialog';
import { resetPaintParametricGuard } from '../paintParametricGuard';
import { continueStorePaintStroke, resetPaintStrokeController, startStorePaintStroke } from '../paintStrokeController';

const EYE: Vec3 = [0, 100, 0];
const noWait = () => Promise.resolve();

function paintedState() {
  const o = useKuraStore.getState().objects[0];
  let minY = Infinity;
  for (let i = 1; i < o.mesh.positions.length; i += 3) minY = Math.min(minY, o.mesh.positions[i]);
  return wrongFaces(o.mesh, o.color, [0, 1000, 0], minY);
}

describe('visibilidad en el trazo por el store', () => {
  beforeEach(() => {
    resetPaintParametricGuard();
    resetPaintStrokeController();
    useKuraStore.setState({
      engineReady: true, objects: [], selectedIds: [], past: [], future: [],
      paintMode: 'brush', paintRadiusMm: 3, paintRefineEdge: true, paintColor: '#ff0000',
    });
  });

  it.each([false, true])('placa importada, trazo inmediato, refine=%s: un paso y sin cara inferior', (refine) => {
    useKuraStore.setState({ objects: [plateObject(closedPlate())], paintRefineEdge: refine });
    const o = useKuraStore.getState().objects[0];
    const base = useKuraStore.getState().past.length;
    const view = { eye: EYE };
    expect(startStorePaintStroke(o, { point: [0, 0.5, 0], faceIndex: null, view }, refine, noWait)).toBeUndefined();
    for (let x = 1; x <= 4; x++) continueStorePaintStroke(o.id, { point: [x, 0.5, 0], faceIndex: null, view });
    useKuraStore.getState().endPaintStroke();
    const r = paintedState();
    expect(r.painted).toBeGreaterThan(0);
    expect(r).toMatchObject({ back: 0, bottom: 0 });
    expect(useKuraStore.getState().past.length).toBe(base + 1);
  });

  it('pincelada del bus/MCP sin dirección de vista: la deduce de la cara más cercana', () => {
    useKuraStore.setState({ objects: [plateObject(closedPlate())] });
    useKuraStore.getState().paintObjectSurface('placa', [0, 0.5, 0], null, 'brush');
    const r = paintedState();
    expect(r.painted).toBeGreaterThan(0);
    expect(r.bottom).toBe(0);
  });

  it('trazo diferido tras «Pintar igual» sobre una placa primitiva: cada muestra con su vista', async () => {
    await useKuraStore.getState().createPrimitive('box', { width: 60, height: 1, depth: 60 });
    const o = useKuraStore.getState().objects[0];
    const base = useKuraStore.getState().past.length;
    const view = { eye: EYE };
    const pending = startStorePaintStroke(o, { point: [0, 1, 0], faceIndex: null, view }, true, noWait);
    for (let x = 1; x <= 4; x++) continueStorePaintStroke(o.id, { point: [x, 1, 0], faceIndex: null, view });
    useKuraStore.getState().endPaintStroke();
    expect(useKuraStore.getState().objects[0].mesh.faceColors).toBeUndefined();
    await new Promise((r) => setTimeout(r, 50));
    settleDecision('paint');
    await pending;
    const r = paintedState();
    expect(r.painted).toBeGreaterThan(0);
    expect(r).toMatchObject({ back: 0, bottom: 0 });
    expect(useKuraStore.getState().past.length).toBe(base + 1);
  });
});
