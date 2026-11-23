/**
 * @file src/core/__tests__/engineWorker.test.ts
 * @description Worker del motor con un Worker simulado que clona y transfiere como el real
 * (`structuredClone` con `transfer`) y ejecuta `handleEngineRequest`: equivalencia con la ruta en
 * proceso (booleana, ahuecado, corte, exportación), nombres resueltos, entradas intactas, error
 * tipado a través del límite, cancelación que libera `busyOperation` y resultado obsoleto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMeshStats, EngineError, initManifoldEngine } from '../../engine';
import { createEngineClient, type WorkerLike } from '../operations/engineClient';
import { runEngineTaskInProcess, type EngineTaskArgs, type EngineTaskName } from '../operations/engineTasks';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskRequest } from '../operations/engineWire';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../scene/sceneObjects';
import { setStoreEngineClient } from '../../store/storeContext';
import { t } from '../../i18n';
import { addBox, byId, resetStore, store } from '../../store/__tests__/storeTestUtils';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';

/** Worker simulado: clona/transfiere en ambos sentidos; `hold` retiene la respuesta final. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  hold = false;
  held: Array<() => void> = [];
  sentTransfer: Transferable[] = [];

  postMessage(message: unknown, transfer: Transferable[]): void {
    this.sentTransfer = transfer;
    const req = structuredClone(message, { transfer }) as EngineTaskRequest;
    void handleEngineRequest(req, (resp, tr) => {
      const deliver = () => {
        if (this.terminated) return;
        const data = structuredClone(resp, { transfer: tr });
        this.onmessage?.({ data } as MessageEvent);
      };
      if (this.hold && resp.type !== 'progress') this.held.push(deliver);
      else setTimeout(deliver, 0);
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

const naming = createKeyedNaming((key, params) => `${key}${params ? JSON.stringify(params) : ''}`, {
  color: (hex) => hex,
  structure: (_r, id) => id,
});
const ctx = () => ({ policy: APP_BUILD_POLICY, newId: () => makeId('mesh'), naming });

function summary(objs: SceneObject[]) {
  return objs.map((o) => {
    const s = computeMeshStats(o.mesh);
    return { name: o.name, tris: s.triangles, volume: Math.round(s.volumeMm3 * 1000) / 1000, manifold: s.isManifold };
  });
}

describe('Worker del motor: equivalencia con la ruta en proceso', () => {
  let worker: FakeWorker;
  let client: ReturnType<typeof createEngineClient>;
  let a: SceneObject;
  let b: SceneObject;

  beforeEach(async () => {
    await resetStore();
    a = await addBox(20, [0, 0, 0], { name: 'A' });
    b = await addBox(10, [5, 5, 5], { name: 'B' });
    worker = new FakeWorker();
    client = createEngineClient(() => worker);
  });

  async function both<N extends EngineTaskName>(name: N, args: EngineTaskArgs<N>) {
    const local = await runEngineTaskInProcess(ctx(), name, args);
    const remote = await client.run(ctx(), name, args).promise;
    return { local, remote };
  }

  it('booleana: mismo volumen, triángulos, manifold y nombre', async () => {
    const { local, remote } = await both('boolean', { target: a, tools: [b], op: 'subtract' });
    expect(summary([remote.result!])).toEqual(summary([local.result!]));
    expect(remote.result!.name).toBe('A − B');
    expect(remote.change.removedIds).toEqual([a.id, b.id]);
    // Las entradas se copiaron antes de transferir: la malla del editor sigue intacta.
    expect(byId(a.id)!.mesh.positions.length).toBeGreaterThan(0);
    expect(worker.sentTransfer.length).toBeGreaterThan(0);
  });

  it('ahuecado: misma malla y avisos', async () => {
    const { local, remote } = await both('hollow', { obj: a, options: { enabled: true, wallThickness: 2 } });
    const l = computeMeshStats(local.patches[0].patch.mesh!);
    const r = computeMeshStats(remote.patches[0].patch.mesh!);
    expect(r).toEqual(l);
    expect(r.isManifold).toBe(true);
    expect(remote.warnings).toEqual(local.warnings);
  });

  it('corte por plano: mismas mitades con nombres resueltos', async () => {
    const options: EngineTaskArgs<'planeCut'>['options'] = {
      axis: 'y', offset: 0, connectorType: 'dowel', connectorSize: 3, connectorDepth: 4, tolerance: 0.25, connectorCount: 1, keepMode: 'both',
    } as EngineTaskArgs<'planeCut'>['options'];
    const { local, remote } = await both('planeCut', { obj: a, options });
    expect(remote.parts.length).toBe(2);
    expect(summary(remote.parts)).toEqual(summary(local.parts));
    // Eje Y del motor = Z del usuario: la mitad positiva (arriba) es la B.
    expect(remote.parts[0].name).toBe('A — cut.half.b{"axis":"Z"}');
    // `parts` y `change.added` siguen siendo los mismos objetos tras clonar.
    expect(remote.change.added[0]).toBe(remote.parts[0]);
  });

  it('exportación STL y 3MF: mismos bytes', async () => {
    for (const format of ['stl', '3mf'] as const) {
      const args = { format, targets: [a], baseName: 'x', unitSystem: 'mm' as const };
      const { local, remote } = await both('export', args);
      expect(remote.files.map((f) => f.data.byteLength)).toEqual(local.files.map((f) => f.data.byteLength));
      if (format === 'stl') expect(Array.from(remote.files[0].data)).toEqual(Array.from(local.files[0].data));
    }
  });

  it('el error tipado cruza el límite con código y parámetros', async () => {
    const err = await client.run(ctx(), 'hollow', { obj: a, options: { enabled: true, wallThickness: 15 } }).promise.catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe('HOLLOW_WALL_TOO_THICK');
    expect((err as EngineError).params.thickness).toBeDefined();
  });
});

describe('Worker del motor en el store: cancelación y resultado obsoleto', () => {
  let worker: FakeWorker;

  beforeEach(async () => {
    await initManifoldEngine();
    await resetStore();
    worker = new FakeWorker();
    worker.hold = true;
    setStoreEngineClient(createEngineClient(() => worker));
  });
  afterEach(() => setStoreEngineClient(null));

  const waitFor = async (cond: () => boolean) => {
    for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
  };

  it('cancelar libera busyOperation, descarta el resultado y termina el Worker', async () => {
    const box = await addBox(20);
    const pending = store().hollowObject(box.id, { enabled: true, wallThickness: 2 });
    expect(useKuraStore.getState().busyOperation).toBe('hollow');
    await waitFor(() => worker.held.length > 0);
    const progress = useKuraStore.getState().busyProgress!;
    expect(progress.name).toBe('hollow');
    expect(progress.cancellable).toBe(true);
    expect(progress.phase).toBe('compute');
    expect(store().cancelBusyOperation()).toBe(true);
    await expect(pending).resolves.toBe(false);
    worker.held.forEach((deliver) => deliver());
    expect(useKuraStore.getState().busyOperation).toBeNull();
    expect(useKuraStore.getState().busyProgress).toBeNull();
    expect(worker.terminated).toBe(true);
    expect(byId(box.id)!.mesh).toBe(box.mesh);
    expect(store().lastOperationError).toBeNull();
  });

  it('un resultado obsoleto se descarta con stale-input', async () => {
    const box = await addBox(20);
    const pending = store().hollowObject(box.id, { enabled: true, wallThickness: 2 });
    await waitFor(() => worker.held.length > 0);
    // La escena cambia mientras el Worker calcula.
    useKuraStore.setState((s) => ({ objects: s.objects.map((o) => (o.id === box.id ? { ...o, position: [9, 0, 0] } : o)) }));
    worker.held.forEach((deliver) => deliver());
    await expect(pending).resolves.toBe(false);
    // `stale-input` (StoreOperationError) se reporta con su mensaje localizado.
    expect(store().lastOperationError).toBe(t('es', 'store.error.staleInput'));
    expect(byId(box.id)!.mesh).toBe(box.mesh);
    expect(useKuraStore.getState().busyOperation).toBeNull();
  });
});
