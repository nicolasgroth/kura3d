/**
 * @file src/engine/__tests__/importMeshFormats.test.ts
 * @description Pruebas de los lectores STL, OBJ y PLY: detección binario/ASCII, bytes extra,
 * truncado, NaN, índices inválidos, mallas abiertas, conservación de posición (prototipo IO-01a)
 * y soldado de vértices con reasignación de colores por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshData } from '../../types/kura';
import { computeMeshStats, initManifoldEngine, weldVertices } from '../index';
import {
  ModelImportError,
  importOBJText,
  importSTLBuffer,
  parseModelFile,
  readOBJ,
  readPLY,
  readSTL,
  type MeshImportOptions,
} from '../ioFormats';
import { boundsOf } from '../io/meshBuffers';
import { cubeStlAscii, cubeStlBinary } from './ioFixtures';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof ModelImportError ? error.code : `other: ${String(error)}`;
  }
  return 'none';
};

beforeAll(async () => {
  await initManifoldEngine();
});

describe('posición del archivo (prototipo IO-01a)', () => {
  const world = [10, -2, 30, 14, -1, 30, 10, 3, 36];
  const centered = [-2, 0, -3, 2, 1, -3, -2, 5, 3];
  const stlVertices = [10, -30, -2, 14, -30, -1, 10, -36, 3];
  const obj = 'v 10 -2 30\nv 14 -1 30\nv 10 3 36\nf 1 2 3';
  const asciiSTL = new TextEncoder().encode(
    'solid sample\nfacet normal 0 0 1\nouter loop\nvertex 10 -30 -2\nvertex 14 -30 -1\nvertex 10 -36 3\nendloop\nendfacet\nendsolid',
  ).buffer;
  const binarySTL = new ArrayBuffer(84 + 50);
  const view = new DataView(binarySTL);
  view.setUint32(80, 1, true);
  stlVertices.forEach((coordinate, i) => view.setFloat32(96 + 4 * i, coordinate, true));

  const fixtures: [string, (options?: MeshImportOptions) => MeshData][] = [
    ['STL ASCII', (options) => importSTLBuffer(asciiSTL, options)],
    ['STL binario', (options) => importSTLBuffer(binarySTL, options)],
    ['OBJ', (options) => importOBJText(obj, options)],
  ];
  it.each(fixtures)('conserva coordenadas con signo en %s cuando se pide', (_, load) => {
    const placed = load({ preservePlacement: true });
    expect([...placed.positions]).toEqual(world);
    const onBed = load();
    expect([...onBed.positions]).toEqual(centered);
    expect(load({ preservePlacement: false })).toEqual(onBed);
    expect(placed.indices).toEqual(onBed.indices);
    expect(placed.normals).toEqual(onBed.normals);
  });
});

describe('lector STL', () => {
  it('conserva la altura de un STL elevado y lo reconoce como cerrado', () => {
    const model = readSTL(cubeStlBinary(10, [5, 5, 20]), 'elevado.stl');
    const [minX, minY, , maxX, maxY] = boundsOf(model.parts[0].mesh.positions);
    expect([minX, minY, maxX, maxY]).toEqual([5, 20, 15, 30]);
    expect(model.parts[0].openEdges).toBe(0);
    expect(model.parts[0].mesh.positions.length).toBe(8 * 3);
    expect(computeMeshStats(model.parts[0].mesh).volumeMm3).toBeCloseTo(1000, 3);
  });

  it('lee como binario un STL con bytes extra al final y cabecera que empieza con "solid"', () => {
    const padded = readSTL(cubeStlBinary(10, [0, 0, 0], 'kura', 37));
    expect(padded.parts[0].mesh.indices.length).toBe(36);
    const solidHeader = readSTL(cubeStlBinary(10, [0, 0, 0], 'solid exported by CAD'));
    expect(solidHeader.parts[0].mesh.indices.length).toBe(36);
  });

  it('lee STL ASCII', () => {
    const bytes = new TextEncoder().encode(cubeStlAscii(10));
    expect(computeMeshStats(readSTL(bytes.buffer as ArrayBuffer).parts[0].mesh).volumeMm3).toBeCloseTo(1000, 3);
  });

  it('rechaza STL truncados, con NaN o vacíos', () => {
    const full = new Uint8Array(cubeStlBinary(10));
    expect(codeOf(() => readSTL(full.slice(0, full.length - 20).buffer))).toBe('truncated');
    const nan = full.slice();
    new DataView(nan.buffer).setFloat32(96, Number.NaN, true);
    expect(codeOf(() => readSTL(nan.buffer))).toBe('non-finite');
    const asciiNan = new TextEncoder().encode('solid x\nfacet normal 0 0 1\nouter loop\nvertex nan 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x');
    expect(codeOf(() => readSTL(asciiNan.buffer as ArrayBuffer))).toBe('non-finite');
    const asciiCut = new TextEncoder().encode('solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\n');
    expect(codeOf(() => readSTL(asciiCut.buffer as ArrayBuffer))).toBe('truncated');
    expect(codeOf(() => readSTL(new ArrayBuffer(0)))).toBe('empty');
    expect(codeOf(() => readSTL(cubeStlBinary(), 'x.stl', { maxFileBytes: 100 }))).toBe('too-large');
    expect(codeOf(() => readSTL(cubeStlBinary(), 'x.stl', { maxTriangles: 5 }))).toBe('too-many-triangles');
  });

  it('marca una malla abierta con sus aristas libres', () => {
    const model = readSTL(new TextEncoder().encode('solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t').buffer as ArrayBuffer);
    expect(model.parts[0].openEdges).toBe(3);
  });
});

describe('lector OBJ', () => {
  it('separa objetos y toma colores de usemtl + MTL', () => {
    const text = [
      'mtllib piezas.mtl',
      'o Base', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'usemtl rojo', 'f 1 2 3',
      'o Tapa', 'v 0 0 5', 'v 1 0 5', 'v 0 1 5', 'usemtl azul', 'f 4 5 6',
    ].join('\n');
    const mtl = 'newmtl rojo\nKd 1 0 0\nnewmtl azul\nKd 0 0 1\n';
    const model = readOBJ(text, 'piezas.obj', { mtlText: mtl });
    expect(model.parts.map((p) => [p.name, p.color])).toEqual([['Base', '#ff0000'], ['Tapa', '#0000ff']]);
  });

  it('rechaza índices inexistentes y coordenadas inválidas', () => {
    expect(codeOf(() => readOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 9'))).toBe('invalid-index');
    expect(codeOf(() => readOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 0'))).toBe('invalid-index');
    expect(codeOf(() => readOBJ('v 0 nan 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'))).toBe('non-finite');
    expect(codeOf(() => readOBJ('# vacío\n'))).toBe('no-geometry');
  });
});

describe('lector PLY', () => {
  it('lee PLY ASCII con colores por cara (Z-up)', () => {
    const ply = [
      'ply', 'format ascii 1.0', 'element vertex 4', 'property float x', 'property float y', 'property float z',
      'element face 2', 'property list uchar int vertex_indices', 'property uchar red', 'property uchar green', 'property uchar blue', 'end_header',
      '0 0 0', '10 0 0', '10 10 0', '0 10 7',
      '3 0 1 2 255 0 0', '3 0 2 3 0 255 0',
    ].join('\n');
    const model = readPLY(new TextEncoder().encode(ply).buffer as ArrayBuffer, 'dos.ply');
    const [, minY, , , maxY] = boundsOf(model.parts[0].mesh.positions);
    expect([minY, maxY]).toEqual([0, 7]);
    expect(model.parts[0].mesh.faceColors).toEqual(['#ff0000', '#00ff00']);
  });

  it('rechaza índices fuera de rango y cabeceras rotas', () => {
    const bad = 'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 5\n';
    expect(codeOf(() => readPLY(new TextEncoder().encode(bad).buffer as ArrayBuffer))).toBe('invalid-index');
    expect(codeOf(() => readPLY(new TextEncoder().encode('ply\nformat ascii 1.0\n').buffer as ArrayBuffer))).toBe('corrupt');
  });
});

describe('detección de formato y soldado', () => {
  it('rechaza extensiones no soportadas nombrando el archivo', () => {
    try {
      parseModelFile('dibujo.step', new ArrayBuffer(10));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ModelImportError);
      expect((error as ModelImportError).code).toBe('unsupported');
      expect((error as ModelImportError).fileName).toBe('dibujo.step');
    }
  });

  it('suelda vértices coincidentes, elimina degenerados e informa el triángulo de origen', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
    const indices = new Uint32Array([0, 1, 2, 3, 5, 4, 6, 7, 8]);
    const welded = weldVertices(positions, indices, 1e-5);
    expect(welded.positions.length / 3).toBe(4);
    expect([...welded.indices]).toEqual([0, 1, 2, 1, 3, 2]);
    expect([...welded.triangleSource]).toEqual([0, 1]);
  });

  it('suelda 200 000 triángulos con un resultado coherente (el tiempo lo vigila importMeshLinearity.perf)', () => {
    // Sin medir tiempo: depende de la carga de la máquina. Datos deterministas (generador fijo).
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const n = 200_000;
    const positions = new Float32Array(n * 9);
    for (let i = 0; i < positions.length; i++) positions[i] = Math.floor(rnd() * 400) / 4;
    const indices = new Uint32Array(n * 3).map((_, i) => i);
    const unique = new Set<string>();
    for (let i = 0; i < positions.length; i += 3) unique.add(`${positions[i]},${positions[i + 1]},${positions[i + 2]}`);
    const welded = weldVertices(positions, indices, 1e-5);
    const vertexCount = welded.positions.length / 3;
    expect(vertexCount).toBeLessThanOrEqual(unique.size);
    expect(vertexCount).toBeGreaterThan(0);
    expect(welded.triangleSource.length).toBe(welded.indices.length / 3);
    expect(welded.indices.every((v) => v < vertexCount)).toBe(true);
  }, 60_000);
});
