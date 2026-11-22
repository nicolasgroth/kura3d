/**
 * @file src/core/__tests__/fakeEngineWorker.ts
 * @description Worker simulado del motor para pruebas: clona y transfiere como el real
 * (`structuredClone` con `transfer`), ejecuta `handleEngineRequest`, registra qué tareas recibió y
 * qué buffers se transfirieron, y puede retener la respuesta final (`hold`) para probar cancelación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { WorkerLike } from '../operations/engineClient';
import { handleEngineRequest } from '../operations/engineWorkerHost';
import type { EngineTaskRequest } from '../operations/engineWire';

export class FakeEngineWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  hold = false;
  held: Array<() => void> = [];
  /** Tareas recibidas, en orden. */
  tasks: string[] = [];
  /** Tamaño en bytes de los buffers transferidos en cada envío (mismo orden que `tasks`). */
  transfers: number[][] = [];

  postMessage(message: unknown, transfer: Transferable[]): void {
    this.transfers.push(transfer.map((b) => (b as ArrayBuffer).byteLength));
    const req = structuredClone(message, { transfer }) as EngineTaskRequest;
    this.tasks.push(req.task);
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

/** Espera activa corta hasta que `cond` se cumpla (máx. ~1 s). */
export async function waitFor(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
}
