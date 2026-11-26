/**
 * @file src/project/projectCodecClient.ts
 * @description Cliente que delega la codificación y decodificación de proyectos al worker del códec.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAX_PROJECT_BYTES, ProjectCodecError, type ProjectDocument } from './projectSchema';

export type ProjectCodecRequest =
  | { operation: 'encode'; document: ProjectDocument }
  | { operation: 'decode'; bytes: Uint8Array };

export type ProjectCodecResponse<T = Uint8Array | ProjectDocument> =
  | { ok: true; value: T }
  | { ok: false; message: string; code?: ProjectCodecError['code'] };

async function runWorker<T>(request: ProjectCodecRequest, transfer: Transferable[] = []): Promise<T> {
  const worker = new Worker(new URL('./projectCodec.worker.ts', import.meta.url), {
    type: 'module',
    name: 'kura-project-codec',
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<ProjectCodecResponse<T>>) => {
        if (data.ok) resolve(data.value);
        else reject(data.code ? new ProjectCodecError(data.code) : new Error(data.message));
      };
      worker.onerror = event => {
        event.preventDefault();
        reject(new Error(event.message || 'The project worker failed.'));
      };
      worker.onmessageerror = () => reject(new Error('Unable to read the project worker response.'));
      worker.postMessage(request, transfer);
    });
  } finally {
    worker.terminate();
  }
}

export async function encodeProjectAsync(document: ProjectDocument): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return (await import('./projectCodec')).encodeProjectCompressed(document);
  // Structured clone snapshots the scene and history. Their geometry remains owned by the editor.
  return runWorker<Uint8Array>({ operation: 'encode', document });
}

/** Consumes the supplied file buffer, including any sibling views on it. */
export async function decodeProjectAsync(bytes: Uint8Array): Promise<ProjectDocument> {
  if (bytes.byteLength > MAX_PROJECT_BYTES) throw new ProjectCodecError('too-large');
  if (typeof Worker === 'undefined') return (await import('./projectCodec')).decodeProject(bytes);
  const owned = bytes.buffer instanceof ArrayBuffer ? bytes : new Uint8Array(bytes);
  return runWorker<ProjectDocument>({ operation: 'decode', bytes: owned }, [owned.buffer as ArrayBuffer]);
}
