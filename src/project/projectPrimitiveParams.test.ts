/**
 * @file src/project/projectPrimitiveParams.test.ts
 * @description Los parámetros de primitiva de un .kura se acotan a los rangos del motor
 * (`primitiveLimits.ts`) al leer y al guardar: un proyecto con valores fuera de rango se abre
 * (la malla guardada no cambia) y sus parámetros quedan dentro de lo que la interfaz acepta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { createPrimitiveMesh, computeMeshStats } from '../engine/primitives';
import { PRIMITIVE_LIMITS, TEXT_DEPTH_RANGE } from '../engine/primitiveLimits';
import { DEFAULT_PRINTER_PROFILES, type SceneObject } from '../types/kura';
import { boundPrimitiveParams } from './primitiveParamsBounds';
import { decodeProject, encodeProjectImage, type ProjectDocument } from './projectCodec';

async function documentWith(params: SceneObject['primitiveParams'], primitiveType: SceneObject['primitiveType'] = 'cylinder'): Promise<ProjectDocument> {
  const mesh = await createPrimitiveMesh('cylinder', { radius: 5, height: 10, segments: 24 });
  const object: SceneObject = {
    id: 'c', name: 'c', source: 'primitive', primitiveType, primitiveParams: params,
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#38bdf8',
    materialPreset: 'pla_matte', role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  };
  return {
    objects: [object], selectedIds: [], past: [], future: [], unitSystem: 'mm',
    printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
    sectionPlane: { enabled: false, heightMm: 0 }, snapGridMm: 0,
  };
}

/** Escribe parámetros arbitrarios en el manifiesto sin pasar por el acotado del guardado. */
function withRawParams(bytes: Uint8Array, params: Record<string, unknown>): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const length = view.getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + length)));
  manifest.current.objects[0].primitiveParams = params;
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const payload = bytes.slice(16 + length);
  const out = new Uint8Array(16 + json.length + payload.length);
  out.set(bytes.subarray(0, 16));
  out.set(json, 16);
  out.set(payload, 16 + json.length);
  const header = new DataView(out.buffer);
  header.setUint32(8, json.length, true);
  // CRC32 del manifiesto + carga, como lo calcula el códec.
  let crc = ~0;
  for (const byte of out.subarray(16)) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  header.setUint32(12, ~crc >>> 0, true);
  return out;
}

describe('parámetros de primitiva del .kura dentro de rango', () => {
  it('acota por tipo, redondea enteros y no toca lo que ya es válido', () => {
    const p = { radius: 5, height: 12, segments: 24 };
    expect(boundPrimitiveParams('cylinder', p)).toBe(p);
    expect(boundPrimitiveParams('cylinder', { segments: 1e9, radius: -3, height: 5000 })).toEqual({
      segments: PRIMITIVE_LIMITS.maxSegments, radius: PRIMITIVE_LIMITS.minSize, height: PRIMITIVE_LIMITS.maxSize,
    });
    expect(boundPrimitiveParams('torus', { segments: 2.6 })).toEqual({ segments: 6 });
    expect(boundPrimitiveParams('text', { text: 'hola', depth: 900, fontSize: 0 })).toEqual({
      text: 'hola', depth: TEXT_DEPTH_RANGE.max, fontSize: 1,
    });
  });

  it('un proyecto con segments: 1e9 se abre con los parámetros acotados y la malla intacta', async () => {
    const doc = await documentWith({ radius: 5, height: 10, segments: 24 });
    const bytes = withRawParams(encodeProjectImage(doc), { radius: 5, height: 10, segments: 1e9, width: 1e12 });
    const back = decodeProject(bytes);
    expect(back.objects[0].primitiveParams).toEqual({ radius: 5, height: 10, segments: 256, width: 2000 });
    expect(back.objects[0].stats.volumeMm3).toBeCloseTo(doc.objects[0].stats.volumeMm3, 6);
  });

  it('valores no finitos siguen rechazándose con error tipado', async () => {
    const doc = await documentWith({ radius: 5 });
    const bytes = withRawParams(encodeProjectImage(doc), { radius: 'x' });
    expect(() => decodeProject(bytes)).toThrow(expect.objectContaining({ name: 'ProjectCodecError', code: 'invalid' }));
  });

  it('al guardar también se acota (un .kura nuevo nunca trae valores fuera de rango)', async () => {
    const doc = await documentWith({ radius: 5, segments: 4096 });
    const back = decodeProject(encodeProjectImage(doc));
    expect(back.objects[0].primitiveParams).toEqual({ radius: 5, segments: 256 });
    expect(doc.objects[0].primitiveParams).toEqual({ radius: 5, segments: 4096 });
  });
});
