/**
 * @file src/core/__tests__/engineCapacityTask.test.ts
 * @description Tarea `capacity` del Worker del motor: mismo resultado que en proceso (con la malla
 * del líquido transferida), progreso por fase y cancelación que rechaza y termina el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine, manifoldToMeshData } from '../../engine';
import { createEngineClient, isEngineCancelled, type WorkerLike } from '../operations/engineClient';
import { runEngineTaskInProcess } from '../operations/engineTasks';
import type { EngineTaskRequest } from '../operations/engineWire';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import { createKeyedNaming } from '../scene/resultNames';
import { APP_BUILD_POLICY, makeId } from '../scene/sceneObjects';
import type { MeshData } from '../../types/kura';

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage(message: unknown, transfer: Transferable[]): void {
    const req = structuredClone(message, { transfer }) as EngineTaskRequest;
    void handleEngineRequest(req, (resp, tr) => {
      setTimeout(() => {
        if (this.terminated) return;
        this.onmessage?.({ data: structuredClone(resp, { transfer: tr }) } as MessageEvent);
      }, 0);
    });
  }
  terminate(): void {
    this.terminated = true;
  }
}

const naming = createKeyedNaming((key) => key, { color: (hex) => hex, structure: (_r, id) => id });
const ctx = () => ({ policy: APP_BUILD_POLICY, newId: () => makeId('mesh'), naming });

let cupMesh: MeshData;
beforeAll(async () => {
  const wasm = await initManifoldEngine();
  const cyl = (r: number, h: number, y0: number) => wasm.Manifold.cylinder(h, r, r, 96, false).rotate([-90, 0, 0]).translate([0, y0, 0]);
  cupMesh = manifoldToMeshData(cyl(20, 50, 0).subtract(cyl(18, 50, 2)));
});

const obj = () => ({ mesh: cupMesh, position: [10, 0, -5] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] });

describe('tarea capacity del motor', () => {
  it('en el Worker da lo mismo que en proceso y trae la malla del líquido', async () => {
    const args = { obj: obj(), options: { includeLiquidMesh: true } };
    const local = await runEngineTaskInProcess(ctx(), 'capacity', args);
    const phases: string[] = [];
    const remote = await createEngineClient(() => new FakeWorker()).run(ctx(), 'capacity', args, (p) => phases.push(p)).promise;
    expect(remote.basins).toHaveLength(1);
    expect(remote.basins[0].maxCapacityMm3).toBeCloseTo(local.basins[0].maxCapacityMm3, 6);
    expect(remote.liquid?.positions).toBeInstanceOf(Float32Array);
    expect(remote.liquid!.positions.length).toBe(local.liquid!.positions.length);
    expect(phases).toEqual(expect.arrayContaining(['init', 'compute', 'capacity-scan', 'capacity-refine']));
    // La entrada queda intacta (se envía una copia).
    expect(args.obj.mesh.positions.length).toBeGreaterThan(0);
  });

  it('cancelar rechaza con EngineCancelledError y termina el Worker', async () => {
    const worker = new FakeWorker();
    const job = createEngineClient(() => worker).run(ctx(), 'capacity', { obj: obj() });
    job.cancel();
    const err = await job.promise.catch((e: unknown) => e);
    expect(isEngineCancelled(err)).toBe(true);
    expect(worker.terminated).toBe(true);
  });
});
