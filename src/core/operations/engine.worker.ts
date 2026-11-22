/**
 * @file src/core/operations/engine.worker.ts
 * @description Web Worker único y reutilizable del motor: ejecuta booleanas, corte, ahuecado,
 * moldes, proyección, segmentación, roscas y exportación fuera del hilo principal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { handleEngineRequest } from './engineWorkerHost';
import type { EngineTaskRequest } from './engineWire';

self.onmessage = ({ data }: MessageEvent<EngineTaskRequest>) => {
  void handleEngineRequest(data, (response, transfer) => self.postMessage(response, { transfer }));
};
