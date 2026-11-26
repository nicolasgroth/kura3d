/**
 * @file src/core/operations/engineWorkerHost.ts
 * @description Lado Worker del motor, independiente de `self`: inicializa Manifold una vez,
 * ejecuta la tarea pedida con nombres diferidos y responde transfiriendo los buffers de malla.
 * `engine.worker.ts` lo conecta a `self`; las pruebas lo usan con un Worker simulado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { initManifoldEngine } from '../../engine/manifoldKernel';
import { makeId } from '../scene/sceneObjects';
import { ENGINE_TASKS, runEngineTaskInProcess, type EngineTaskName } from './engineTasks';
import {
  collectTransferables,
  createRecordingNaming,
  serializeError,
  type EngineTaskRequest,
  type EngineTaskResponse,
} from './engineWire';

export type PostResponse = (response: EngineTaskResponse, transfer: Transferable[]) => void;

/** Atiende una petición del hilo principal. Nunca lanza: los errores viajan serializados. */
export async function handleEngineRequest(req: EngineTaskRequest, post: PostResponse): Promise<void> {
  try {
    if (typeof req.task !== 'string' || !Object.hasOwn(ENGINE_TASKS, req.task)) throw new Error(`Unknown engine task: ${req.task}`);
    post({ type: 'progress', id: req.id, phase: 'init' }, []);
    await initManifoldEngine();
    post({ type: 'progress', id: req.id, phase: 'compute' }, []);
    const { naming, calls } = createRecordingNaming();
    const ctx = {
      policy: req.policy,
      newId: () => makeId('mesh'),
      naming,
      onProgress: (phase: string) => post({ type: 'progress', id: req.id, phase }, []),
    };
    const result = await runEngineTaskInProcess(ctx, req.task as EngineTaskName, req.args as never);
    post({ type: 'done', id: req.id, result, names: calls }, collectTransferables(result));
  } catch (err) {
    post({ type: 'error', id: req.id, error: serializeError(err) }, []);
  }
}
