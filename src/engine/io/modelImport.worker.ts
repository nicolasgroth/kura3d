/**
 * @file src/engine/io/modelImport.worker.ts
 * @description Web Worker que lee archivos STL/OBJ/PLY/3MF fuera del hilo principal: guarda los MTL
 * del lote (llegan una vez), lee cada Blob aquí mismo y devuelve las mallas transfiriendo sus buffers.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { attachViewportShading } from './importShading';
import { MtlLibrary, errorReply, runModelImport, type ModelImportWorkerMessage, type ModelImportWorkerReply } from './modelImportTask';

const library = new MtlLibrary();

function reply(response: ModelImportWorkerReply, transfer: Transferable[] = []) {
  self.postMessage(response, { transfer });
}

self.onmessageerror = () => reply({ id: 0, ok: false, code: 'corrupt', message: 'Unable to read the import request.' });
self.onmessage = async ({ data }: MessageEvent<ModelImportWorkerMessage>) => {
  if (data.kind === 'mtl') {
    library.set(data.entries);
    return;
  }
  try {
    const model = await runModelImport(library, data);
    // El sombreado del visor se calcula aquí: montarlo en el hilo principal congelaba la pestaña.
    const transfer = new Set<ArrayBuffer>(attachViewportShading(model));
    for (const part of model.parts) {
      for (const attr of [part.mesh.positions, part.mesh.indices, part.mesh.normals]) {
        if (attr?.buffer instanceof ArrayBuffer) transfer.add(attr.buffer);
      }
    }
    reply({ id: data.id, ok: true, model }, [...transfer]);
  } catch (error) {
    reply(errorReply(data.id, error, data.fileName));
  }
};
