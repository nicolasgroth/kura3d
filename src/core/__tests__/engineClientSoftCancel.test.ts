/**
 * @file src/core/__tests__/engineClientSoftCancel.test.ts
 * @description Cancelación suave y dura del cliente del Worker: la suave descarta el resultado sin
 * recrear el Worker (no se recarga Manifold); la dura lo termina; y si un trabajo descartado deja al
 * Worker ocupado más del umbral mientras otro pedido espera, se escala a dura y se reencola lo
 * pendiente en un Worker nuevo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../../engine';
import { createEngineClient, isEngineCancelled, type WorkerLike } from '../operations/engineClient';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskRequest } from '../operations/engineWire';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../scene/sceneObjects';
import { addBox, resetStore } from '../../store/__tests__/storeTestUtils';
import type { SceneObject } from '../../types/kura';

/** Worker simulado: con `hold` retiene las respuestas hasta `release()`; si no, responde en orden. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  received = 0;
  delivered: number[] = [];
  private held: (() => void)[] = [];
  constructor(private hold = false) {}

  postMessage(message: unknown, transfer: Transferable[]): void {
    this.received++;
    const req = structuredClone(message, { transfer }) as EngineTaskRequest;
    const run = () =>
      void handleEngineRequest(req, (resp, tr) => {
        setTimeout(() => {
          if (this.terminated) return;
          if (resp.type !== 'progress') this.delivered.push(resp.id);
          this.onmessage?.({ data: structuredClone(resp, { transfer: tr }) } as MessageEvent);
        }, 0);
      });
    if (this.hold) this.held.push(run);
    else run();
  }

  /** Deja de retener y procesa lo acumulado (como un cálculo largo que por fin termina). */
  release(): void {
    this.hold = false;
    for (const run of this.held.splice(0)) run();
  }

  /** Procesa solo el primero retenido (el Worker termina el trabajo en curso y sigue con la cola). */
  releaseOne(): void {
    this.held.shift()?.();
  }

  terminate(): void {
    this.terminated = true;
  }
}

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx = () => ({ policy: APP_BUILD_POLICY, newId: () => makeId('mesh'), naming });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('cancelación suave y dura del cliente del Worker', () => {
  let a: SceneObject;
  let b: SceneObject;

  beforeEach(async () => {
    await initManifoldEngine();
    await resetStore();
    a = await addBox(20, [0, 0, 0], { name: 'A' });
    b = await addBox(10, [5, 5, 5], { name: 'B' });
  });

  it('suave: rechaza como cancelada, no termina ni recrea el Worker y descarta el resultado', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    first.cancel('soft');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    const second = await client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' }).promise;
    expect(second.result?.stats.isManifold).toBe(true);
    // El resultado de la primera llegó y se descartó en silencio, en el mismo Worker.
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(false);
    expect(workers[0].delivered).toHaveLength(2);
    client.dispose();
  });

  it('dura: termina el Worker y el siguiente pedido usa uno nuevo', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(() => {
      const w = new FakeWorker(workers.length === 0);
      workers.push(w);
      return w;
    });
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    first.cancel('hard');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    expect(workers[0].terminated).toBe(true);
    const second = await client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' }).promise;
    expect(second.result?.stats.isManifold).toBe(true);
    expect(workers).toHaveLength(2);
    client.dispose();
  });

  it('sin modo, cancel() es dura (botón Cancelar del usuario)', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(() => {
      const w = new FakeWorker(true);
      workers.push(w);
      return w;
    });
    const job = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    job.cancel();
    await expect(job.promise).rejects.toSatisfy(isEngineCancelled);
    expect(workers[0].terminated).toBe(true);
    client.dispose();
  });

  it('escala a dura si un trabajo descartado deja esperando al siguiente más del umbral', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(workers.length === 0);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 30 },
    );
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    first.cancel('soft');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    expect(workers[0].terminated).toBe(false);
    const second = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    const res = await second.promise;
    expect(res.result?.stats.isManifold).toBe(true);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].received).toBe(1);
    client.dispose();
  });

  it('escala también si el pedido ya estaba en cola cuando se canceló en suave el que corría', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(workers.length === 0);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 30 },
    );
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    // El segundo entra a la cola ANTES de que se descarte el primero: al pedirlo aún no había huérfanos.
    const second = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    first.cancel('soft');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    const res = await Promise.race([second.promise, sleep(400).then(() => null)]);
    expect(res?.result?.stats.isManifold).toBe(true);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    client.dispose();
  });

  it('no escala si el trabajo descartado termina antes del umbral', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(true);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 200 },
    );
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    first.cancel('soft');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    const second = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    workers[0].release();
    const res = await second.promise;
    expect(res.result?.stats.isManifold).toBe(true);
    await sleep(250);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(false);
    client.dispose();
  });

  it('no escala por un huérfano que quedó en cola detrás de un trabajo legítimo que corre', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(true);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 30 },
    );
    // B (legítima y larga) corre; A entra detrás y se descarta: A no bloquea a nadie.
    const running = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    const queued = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    queued.cancel('soft');
    await expect(queued.promise).rejects.toSatisfy(isEngineCancelled);
    await sleep(90);
    expect(workers[0].terminated).toBe(false);
    workers[0].release();
    const res = await running.promise;
    expect(res.result?.stats.isManifold).toBe(true);
    expect(workers).toHaveLength(1);
    client.dispose();
  });

  it('escala cuando el huérfano en cola pasa a ejecutarse y bloquea al siguiente', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(true);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 30 },
    );
    const running = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    const orphan = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'union' });
    const waiting = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'intersect' });
    orphan.cancel('soft');
    await expect(orphan.promise).rejects.toSatisfy(isEngineCancelled);
    await sleep(60);
    expect(workers[0].terminated).toBe(false);
    // Termina B: ahora el Worker calcula el huérfano y C espera detrás de él.
    workers[0].releaseOne();
    expect((await running.promise).result?.stats.isManifold).toBe(true);
    await sleep(90);
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].received).toBe(1);
    workers[1].release();
    expect((await waiting.promise).result?.stats.isManifold).toBe(true);
    client.dispose();
  });

  it('sin nadie esperando, un trabajo descartado largo no termina el Worker', async () => {
    const workers: FakeWorker[] = [];
    const client = createEngineClient(
      () => {
        const w = new FakeWorker(true);
        workers.push(w);
        return w;
      },
      { softCancelGraceMs: 20 },
    );
    const first = client.run(ctx(), 'boolean', { target: a, tools: [b], op: 'subtract' });
    first.cancel('soft');
    await expect(first.promise).rejects.toSatisfy(isEngineCancelled);
    await sleep(60);
    expect(workers[0].terminated).toBe(false);
    client.dispose();
  });
});
