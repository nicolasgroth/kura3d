/**
 * @file src/engine/__tests__/importHardening.test.ts
 * @description Pruebas de endurecimiento de los lectores ante archivos hostiles: árboles 3MF de
 * componentes vacíos que explotan combinatoriamente, etiquetas XML sin cerrar (tiempo lineal),
 * cabeceras PLY que declaran más elementos de los que caben en el archivo y tiempo límite del
 * worker de importación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initManifoldEngine } from '../index';
import { ModelImportError, read3MF, readPLY } from '../ioFormats';
import { parseModelFileAsync } from '../io/modelImportClient';
import { cubeMeshXml, modelXml, pack3mf } from './ioFixtures';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof ModelImportError ? error.code : `other: ${String(error)}`;
  }
  return 'none';
};

const enc = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

beforeAll(async () => {
  await initManifoldEngine();
});

describe('3MF: presupuesto global de nodos visitados', () => {
  it('rechaza rápido un árbol de componentes vacíos con expansión exponencial', () => {
    // 8 niveles x 6 componentes = 1,7 millones de visitas sin ninguna malla.
    const depth = 8;
    let resources = `<object id="${depth}" name="vacío"/>`;
    for (let level = depth - 1; level >= 0; level--) {
      const comps = Array.from({ length: 6 }, () => `<component objectid="${level + 1}"/>`).join('');
      resources += `<object id="${level}"><components>${comps}</components></object>`;
    }
    const buffer = pack3mf({ '3D/3dmodel.model': modelXml(resources, '<item objectid="0"/>') });
    // Terminar es el criterio: una bomba sin presupuesto agotaría el tiempo de la prueba (sin umbral en ms).
    expect(codeOf(() => read3MF(buffer, 'bomba.3mf'))).toBe('too-many-parts');
  });

  it('acepta un árbol legítimo de componentes dentro del presupuesto', () => {
    const xml = modelXml(
      `<object id="1">${cubeMeshXml(5)}</object>` +
      `<object id="2"><components><component objectid="1"/><component objectid="1" transform="1 0 0 0 1 0 0 0 1 10 0 0"/></components></object>`,
      '<item objectid="2"/>',
    );
    expect(read3MF(pack3mf({ '3D/3dmodel.model': xml })).parts).toHaveLength(2);
  });
});

describe('3MF: etiquetas sin cerrar se rechazan en tiempo lineal', () => {
  it('rechaza <object> sin cierre en vez de ignorarlo', () => {
    const xml = modelXml(`<object id="1">${cubeMeshXml(5)}</object>` + '<object id="9">'.repeat(2000), '<item objectid="1"/>');
    expect(codeOf(() => read3MF(pack3mf({ '3D/3dmodel.model': xml })))).toBe('corrupt');
  });

  it('procesa decenas de miles de aperturas sin cierre en poco tiempo', () => {
    const spam = '<object id="9">'.repeat(60_000) + '<vertex x="1"'.repeat(60_000);
    const xml = modelXml(`<object id="1">${cubeMeshXml(5)}</object>` + spam, '<item objectid="1"/>');
    const buffer = pack3mf({ '3D/3dmodel.model': xml });
    // Tiempo lineal: si fuera cuadrático, 60 mil aperturas agotarían el tiempo de la prueba.
    expect(codeOf(() => read3MF(buffer))).toBe('corrupt');
  });

  it('rechaza vértices sin cierre de etiqueta dentro de la malla', () => {
    const mesh = '<mesh><vertices>' + '<vertex x="0" y="0" z="0"'.repeat(50) + '</vertices><triangles></triangles></mesh>';
    const xml = modelXml(`<object id="1">${mesh}</object>`, '<item objectid="1"/>');
    expect(codeOf(() => read3MF(pack3mf({ '3D/3dmodel.model': xml })))).toBe('corrupt');
  });
});

describe('PLY: la cabecera no puede pedir más de lo que cabe en el archivo', () => {
  const header = (lines: string[], format = 'binary_little_endian') =>
    ['ply', `format ${format} 1.0`, ...lines, 'end_header', ''].join('\n');

  it('rechaza un conteo de vértices que no cabe en los bytes restantes, sin reservar memoria', () => {
    const binary = (count: number) => {
      const text = header([`element vertex ${count}`, 'property float x', 'property float y', 'property float z']);
      const bytes = new Uint8Array(new TextEncoder().encode(text).length + 12);
      bytes.set(new TextEncoder().encode(text));
      return bytes.buffer as ArrayBuffer;
    };
    // 2^40 vértices: antes reventaba con RangeError al reservar; ahora es un error tipado.
    expect(codeOf(() => readPLY(binary(2 ** 40)))).toBe('too-many-triangles');
    expect(codeOf(() => readPLY(binary(10_000_000)))).toBe('truncated');
  });

  it('rechaza conteos ASCII imposibles para el tamaño del texto', () => {
    const text = header(['element vertex 5000000', 'property float x', 'property float y', 'property float z'], 'ascii') + '0 0 0\n';
    expect(codeOf(() => readPLY(enc(text)))).toBe('truncated');
  });

  it('rechaza elementos sin propiedades', () => {
    const text = header(['element basura 1000000000', 'element vertex 0', 'property float x'], 'ascii');
    expect(codeOf(() => readPLY(enc(text)))).toBe('corrupt');
  });

  it('limita los vértices a 3 × maxTriangles', () => {
    const verts = Array.from({ length: 31 }, () => '0 0 0').join('\n');
    const text = header(['element vertex 31', 'property float x', 'property float y', 'property float z', 'element face 0', 'property list uchar int vertex_indices'], 'ascii') + verts + '\n';
    expect(codeOf(() => readPLY(enc(text), 'x.ply', { maxTriangles: 10 }))).toBe('too-many-triangles');
  });

  it('sigue leyendo un PLY binario válido', () => {
    const text = header([
      'element vertex 3', 'property float x', 'property float y', 'property float z',
      'element face 1', 'property list uchar int vertex_indices',
    ]);
    const head = new TextEncoder().encode(text);
    const out = new Uint8Array(head.length + 36 + 13);
    out.set(head);
    const view = new DataView(out.buffer);
    const pts = [0, 0, 0, 10, 0, 0, 0, 10, 0];
    pts.forEach((v, i) => view.setFloat32(head.length + i * 4, v, true));
    out[head.length + 36] = 3;
    [0, 1, 2].forEach((v, i) => view.setInt32(head.length + 37 + i * 4, v, true));
    const model = readPLY(out.buffer as ArrayBuffer, 'tri.ply');
    expect(model.parts[0].mesh.indices.length).toBe(3);
  });
});

describe('cliente del worker de importación: tiempo límite', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('termina el worker y rechaza con ModelImportError si no responde a tiempo', async () => {
    const terminate = vi.fn();
    class SilentWorker {
      onmessage: unknown = null;
      onerror: unknown = null;
      onmessageerror: unknown = null;
      postMessage() { /* nunca responde */ }
      terminate = terminate;
    }
    vi.stubGlobal('Worker', SilentWorker);
    const promise = parseModelFileAsync('lento.stl', new ArrayBuffer(8), undefined, 30);
    await expect(promise).rejects.toBeInstanceOf(ModelImportError);
    // Un Worker que no responde suele estar sin memoria: el mensaje lo dice y el Worker se termina.
    await expect(promise).rejects.toMatchObject({ code: 'out-of-memory', fileName: 'lento.stl' });
    expect(terminate).toHaveBeenCalled();
  });
});
