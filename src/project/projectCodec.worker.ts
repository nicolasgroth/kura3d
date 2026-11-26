/**
 * @file src/project/projectCodec.worker.ts
 * @description Web Worker que codifica (v6, con el deflate nativo si existe) y decodifica proyectos .kura fuera del hilo principal,
 * transfiriendo los buffers de geometría; al guardar, envía el avance (`{ progress }`) antes de la respuesta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { decodeProject, encodeProjectCompressed } from './projectCodec';
import type { ProjectCodecRequest, ProjectCodecResponse } from './projectCodecClient';
import { ProjectCodecError, type ProjectDocument } from './projectSchema';
import type { MeshData } from '../types/kura';

function geometryBuffers(document: ProjectDocument): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const meshes = new Set<MeshData>();
  for (const scene of [document, ...document.past, ...document.future]) {
    for (const { mesh } of scene.objects) {
      if (meshes.has(mesh)) continue;
      meshes.add(mesh);
      for (const attribute of [mesh.positions, mesh.indices, mesh.normals]) {
        if (attribute?.buffer instanceof ArrayBuffer) buffers.add(attribute.buffer);
      }
    }
  }
  return [...buffers];
}

function reply(response: ProjectCodecResponse, transfer: Transferable[] = []) {
  self.postMessage(response, { transfer });
}

self.onmessageerror = () => reply({ ok: false, message: 'Unable to read the project worker request.' });
self.onmessage = async ({ data }: MessageEvent<ProjectCodecRequest>) => {
  try {
    if (data.operation === 'encode') {
      let sent = -1;
      const value = await encodeProjectCompressed(data.document, (percent, phase) => {
        if (percent === sent) return; // Un mensaje por porcentaje nuevo.
        sent = percent;
        reply({ progress: { percent, phase } });
      });
      reply({ ok: true, value }, [value.buffer as ArrayBuffer]);
    } else {
      const value = decodeProject(data.bytes);
      reply({ ok: true, value }, geometryBuffers(value));
    }
  } catch (error) {
    reply({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof ProjectCodecError ? error.code : undefined,
    });
  }
};
