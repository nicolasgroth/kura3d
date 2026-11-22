/**
 * @file src/core/__tests__/engineClientQueue.test.ts
 * @description Cola del cliente del Worker y booleanas sin efecto: cancelar una tarea rechaza solo
 * esa y reencola las demás en el Worker nuevo; si `postMessage` lanza (DataCloneError) la tarea se
 * rechaza y no queda colgada; una resta o intersección entre piezas que no se tocan devuelve el
 * aviso `BOOLEAN_NO_EFFECT` sin cambio de escena ni paso de historial.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../../engine';
import { t } from '../../i18n';
import * as ops from '../operations';
import { createEngineClient, isEngineCancelled, type WorkerLike } from '../operations/engineClient';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskRequest } from '../operations/engineWire';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../scene/sceneObjects';
import { addBox, resetStore, store } from '../../store/__tests__/storeTestUtils';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';

/** Worker simulado que clona/transfiere como el real; con `hold` retiene las respuestas finales. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  received = 0;
  constructor(private readonly hold = false, private readonly throwOnPost = false) {}

  postMessage(message: unknown, transfer: Transferable[]): void {
    if (this.throwOnPost) throw new DOMException('could not be cloned', 'DataCloneError');
    this.received++;
    if (this.hold) return; // nunca responde: simula un cálculo largo
    const req = structuredClone(message, { transfer }) as EngineTaskRequest;
    void handleEngineRequest(req, (resp, tr) => {
      setTimeout(() => {
        if (!this.terminated) this.onmessage?.({ data: structuredClone(resp, { transfer: tr }) } as MessageEvent);
      }, 0);
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx = () => ({ policy: APP_BUILD_POLICY, newId: () => makeId('mesh'), naming });

describe('cola del cliente del Worker', () => {
  let a: SceneObject;
  let b: SceneObject;

  beforeEach(async () => {
    await initManifoldEngine();
    await resetStore();
    a = await addBox(20, [0, 0, 0], { name: 'A' });
    b = await addBox(10, [5, 5, 5], { name: 'B' });
  });

  it('cancelar una tarea rechaza solo esa y reencola las demás en el Worker nuevo', async () => {
    const workers: FakeWorker[] = [];
    // El primer Worker retiene todo; el segundo responde.
    const client = createEngineClient(() => {
      const w = new FakeWorker(workers.length === 0);
      workers.push(w);
      return w;
    });
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    const second = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    expect(workers[0].received).toBe(2);
    first.cancel();
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    const res = await second.promise;
    expect(res.result?.stats.isManifold).toBe(true);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].received).toBe(1);
  });

  it('si postMessage lanza DataCloneError la tarea se rechaza y no queda pendiente', async () => {
    let throwNext = true;
    const client = createEngineClient(() => new FakeWorker(false, throwNext));
    const bad = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    await expect(bad.promise).rejects.toMatchObject({ name: 'DataCloneError' });
    // dispose no encuentra nada colgado: cancelar la tarea fallida no hace nada.
    bad.cancel();
    throwNext = false;
    client.dispose();
  });
});

describe('booleana entre piezas que no se tocan', () => {
  let a: SceneObject;
  let far: SceneObject;

  beforeEach(async () => {
    await initManifoldEngine();
    await resetStore();
    a = await addBox(10, [0, 0, 0], { name: 'A' });
    far = await addBox(10, [40, 0, 0], { name: 'Lejos' });
  });

  it.each(['subtract', 'intersect'] as const)('%s devuelve BOOLEAN_NO_EFFECT sin cambio', async (op) => {
    const { result, change } = await ops.booleanOperation(ctx(), { target: a, tools: [far], op });
    expect(result).toBeNull();
    expect(change.added).toHaveLength(0);
    expect(change.removedIds).toHaveLength(0);
    expect(change.patches).toHaveLength(0);
    expect(change.warnings.map((w) => w.code)).toEqual(['BOOLEAN_NO_EFFECT']);
  });

  it('en el store no cambia la escena ni agrega paso de historial', async () => {
    const before = useKuraStore.getState();
    const pastLen = before.past.length;
    const objects = before.objects;
    useKuraStore.setState({ selectedIds: [a.id, far.id] });
    const res = await store().runBooleanOnSelection('subtract');
    expect(res).toBeNull();
    const after = useKuraStore.getState();
    expect(after.past.length).toBe(pastLen);
    expect(after.objects).toBe(objects);
    expect(after.toasts.some((m) => m.kind === 'info' && m.text === t(after.language, 'engineWarning.BOOLEAN_NO_EFFECT'))).toBe(true);
  });
});
