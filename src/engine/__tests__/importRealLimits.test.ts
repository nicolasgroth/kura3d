/**
 * @file src/engine/__tests__/importRealLimits.test.ts
 * @description Límites unificados de importación/exportación (QA con modelos reales): un STL que la
 * app exporta con el máximo de triángulos cabe en el tamaño máximo de importación, el error de tamaño
 * trae el tamaño y el máximo, y una coordenada absurda (1e30, vértice suelto) se rechaza con error tipado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_LIMITS, ModelImportError, checkInputSize } from '../io/importErrors';
import { readOBJBuffer } from '../io/obj';
import { exportMeshToBinarySTL, readSTL } from '../io/stl';
import { read3MF } from '../io/threeMfImport';
import { MODEL_IO_LIMITS } from '../operationLimits';
import { cubeMeshXml, modelXml, pack3mf } from './ioFixtures';

const errorOf = (fn: () => unknown): ModelImportError => {
  try {
    fn();
  } catch (error) {
    return error as ModelImportError;
  }
  throw new Error('no lanzó');
};

/** STL binario de un tetraedro con un vértice desplazado a `far` (mm). */
function tetraStl(far: number): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, far]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]);
  const bytes = exportMeshToBinarySTL({ positions, indices, normals: new Float32Array(12) });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('límites unificados de archivos de modelo', () => {
  it('la importación usa los límites de operationLimits', () => {
    expect(DEFAULT_IMPORT_LIMITS.maxFileBytes).toBe(MODEL_IO_LIMITS.maxFileBytes);
    expect(DEFAULT_IMPORT_LIMITS.maxTriangles).toBe(MODEL_IO_LIMITS.maxTriangles);
    expect(DEFAULT_IMPORT_LIMITS.maxUncompressedBytes).toBe(MODEL_IO_LIMITS.maxUncompressedBytes);
  });

  it('un STL exportado con el máximo de triángulos cabe en el máximo de importación', () => {
    expect(84 + 50 * MODEL_IO_LIMITS.maxTriangles).toBeLessThanOrEqual(DEFAULT_IMPORT_LIMITS.maxFileBytes);
    // El caso real: escena de 3,1 M triángulos → STL de ~155 MB, que antes se rechazaba (máximo 128 MiB).
    expect(() => checkInputSize(84 + 50 * 3_110_226, DEFAULT_IMPORT_LIMITS)).not.toThrow();
  });

  it('el error de tamaño trae el tamaño del archivo y el máximo', () => {
    const err = errorOf(() => readSTL(tetraStl(10), 'grande.stl', { maxFileBytes: 100 }));
    expect(err.code).toBe('too-large');
    expect(err.size).toEqual({ bytes: 284, maxBytes: 100 });
  });
});

describe('coordenadas fuera de rango', () => {
  it('STL con un vértice en 1e30: out-of-range', () => {
    const err = errorOf(() => readSTL(tetraStl(1e30), 'suelto.stl'));
    expect(err.code).toBe('out-of-range');
  });

  it('STL con un vértice a 2 km: out-of-range; a 100 m se acepta', () => {
    expect(errorOf(() => readSTL(tetraStl(2e6), 'lejos.stl')).code).toBe('out-of-range');
    expect(readSTL(tetraStl(1e5), 'grande.stl').parts).toHaveLength(1);
  });

  it('3MF con un vértice fuera de rango tras aplicar la unidad: out-of-range', () => {
    // 2000 m en metros = 2e6 mm.
    const xml = modelXml(`<object id="1">${cubeMeshXml(10, [0, 0, 2000])}</object>`, '<item objectid="1"/>', 'meter');
    expect(errorOf(() => read3MF(pack3mf({ '3D/3dmodel.model': xml }), 'm.3mf')).code).toBe('out-of-range');
  });

  it('OBJ con un vértice fuera de rango: out-of-range', () => {
    const obj = 'v 0 0 0\nv 10 0 0\nv 0 10 0\nv 0 0 1e30\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4\n';
    expect(errorOf(() => readOBJBuffer(new TextEncoder().encode(obj).buffer as ArrayBuffer, 'x.obj')).code).toBe('out-of-range');
  });
});
