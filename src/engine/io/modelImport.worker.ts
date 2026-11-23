/**
 * @file src/engine/io/modelImport.worker.ts
 * @description Web Worker que lee archivos STL/OBJ/PLY/3MF fuera del hilo principal y devuelve
 * las mallas transfiriendo sus buffers.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError } from './importErrors';
import type { ModelImportRequest, ModelImportResponse } from './modelImportClient';
import { parseModelFile } from './modelImport';

function reply(response: ModelImportResponse, transfer: Transferable[] = []) {
  self.postMessage(response, { transfer });
}

self.onmessageerror = () => reply({ ok: false, code: 'corrupt', message: 'Unable to read the import request.' });
self.onmessage = ({ data }: MessageEvent<ModelImportRequest>) => {
  try {
    const model = parseModelFile(data.fileName, data.buffer, data.options);
    const transfer = new Set<ArrayBuffer>();
    for (const part of model.parts) {
      for (const attr of [part.mesh.positions, part.mesh.indices, part.mesh.normals]) {
        if (attr?.buffer instanceof ArrayBuffer) transfer.add(attr.buffer);
      }
    }
    reply({ ok: true, model }, [...transfer]);
  } catch (error) {
    const typed = error instanceof ModelImportError ? error : null;
    reply({
      ok: false,
      code: typed?.code ?? 'corrupt',
      detail: typed?.detail,
      size: typed?.size,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
