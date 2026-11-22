/**
 * @file src/engine/__tests__/importHostileFiles.test.ts
 * @description Importador ante archivos hostiles: 3MF con miles de componentes vacíos, cadenas profundas, XML sin cerrar,
 * ZIP con tamaño declarado falso (bomba), PLY con cabecera mentirosa, STL truncado y OBJ con índices fuera de rango.
 * Exige error tipado (`ModelImportError`) que nombra el archivo en cada caso. El tope de tiempo
 * (< 3 s) vive en `importHostileTiming.perf.test.ts` (`npm run test:perf`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../index';
import { ModelImportError } from '../ioFormats';
import { parseModelFile } from '../io/modelImport';
import { cubeMeshXml, modelXml, pack3mf } from './ioFixtures';

const enc = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
beforeAll(async () => { await initManifoldEngine(); });

function attack(name: string, buffer: ArrayBuffer, limits?: Record<string, number>) {
  let err: unknown = null;
  let ok = false;
  try {
    parseModelFile(name, buffer, limits ? { limits } : {});
    ok = true;
  } catch (e) {
    err = e;
  }
  return { err, ok };
}

function expectTyped(name: string, r: ReturnType<typeof attack>) {
  expect(r.ok, `${name}: se aceptó un archivo hostil`).toBe(false);
  expect(r.err, `${name}: error no tipado: ${String(r.err)}`).toBeInstanceOf(ModelImportError);
  expect((r.err as ModelImportError).fileName, `${name}: el error no nombra el archivo`).toBe(name);
}

describe('importador hostil: 3MF', () => {
  it('miles de componentes vacíos en una sola lista', () => {
    const comps = Array.from({ length: 20_000 }, () => '<component objectid="1"/>').join('');
    const xml = modelXml(`<object id="1"/><object id="2"><components>${comps}</components></object>`, '<item objectid="2"/>');
    expectTyped('miles.3mf', attack('miles.3mf', pack3mf({ '3D/3dmodel.model': xml })));
  });

  it('cadena de 5000 niveles de componentes anidados vacíos', () => {
    let res = '<object id="5000"/>';
    for (let i = 4999; i >= 0; i--) res += `<object id="${i}"><components><component objectid="${i + 1}"/></components></object>`;
    expectTyped('cadena.3mf', attack('cadena.3mf', pack3mf({ '3D/3dmodel.model': modelXml(res, '<item objectid="0"/>') })));
  });

  it('autoreferencia y ciclo A→B→A', () => {
    const res = '<object id="1"><components><component objectid="2"/></components></object><object id="2"><components><component objectid="1"/></components></object>';
    expectTyped('ciclo.3mf', attack('ciclo.3mf', pack3mf({ '3D/3dmodel.model': modelXml(res, '<item objectid="1"/>') })));
  });

  it('etiquetas sin cerrar (4 MB de "<a " y de "<object") dan error tipado', () => {
    for (const filler of ['<a '.repeat(1_400_000), '<object id="1" '.repeat(250_000), '<vertex x="1" '.repeat(300_000)]) {
      const xml = `<?xml version="1.0"?><model unit="millimeter"><resources>${filler}`;
      expectTyped('sincerrar.3mf', attack('sincerrar.3mf', pack3mf({ '3D/3dmodel.model': xml })));
    }
  });

  it('paquete sin modelo y paquete que no es ZIP', () => {
    expectTyped('vacio.3mf', attack('vacio.3mf', pack3mf({ 'otro.txt': 'hola' })));
    expectTyped('noZip.3mf', attack('noZip.3mf', enc('PK\u0003\u0004 esto no es un zip'.repeat(50))));
  });

  it('ZIP con tamaño descomprimido declarado falso (declara 1 KB, contiene 40 MB) con límite de 4 MB', () => {
    const big = new Uint8Array(40 * 1024 * 1024);
    big.fill(32);
    const zipped = zipSync({ '3D/3dmodel.model': big }, { level: 6 });
    expect(zipped.length, 'la bomba debe comprimir mucho').toBeLessThan(200_000);
    // Falsea el tamaño no comprimido: cabecera local (offset 22) y directorio central
    const u8 = new Uint8Array(zipped);
    const dv = new DataView(u8.buffer);
    for (let i = 0; i < u8.length - 4; i++) {
      if (dv.getUint32(i, true) === 0x04034b50) dv.setUint32(i + 22, 1024, true);
      if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 24, 1024, true);
    }
    const r = attack('mentira.3mf', u8.buffer as ArrayBuffer, { maxUncompressedBytes: 4 * 1024 * 1024 });
    expectTyped('mentira.3mf', r);
    expect(['archive-too-large', 'too-large', 'corrupt']).toContain((r.err as ModelImportError).code);
  });

  it('ZIP que declara 3 GB descomprimidos', () => {
    const zipped = zipSync({ '3D/3dmodel.model': new Uint8Array(100) });
    const u8 = new Uint8Array(zipped);
    const dv = new DataView(u8.buffer);
    for (let i = 0; i < u8.length - 4; i++) {
      if (dv.getUint32(i, true) === 0x04034b50) dv.setUint32(i + 22, 0xc0000000, true);
      if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 24, 0xc0000000, true);
    }
    expectTyped('declara3gb.3mf', attack('declara3gb.3mf', u8.buffer as ArrayBuffer));
  });

  it('un 3MF legítimo sigue funcionando después de los ataques', () => {
    const xml = modelXml(`<object id="1">${cubeMeshXml(10)}</object>`, '<item objectid="1"/>');
    const r = attack('ok.3mf', pack3mf({ '3D/3dmodel.model': xml }));
    expect(r.ok).toBe(true);
  });
});

describe('importador hostil: PLY, STL, OBJ', () => {
  it('PLY ascii con cabecera que declara millones de vértices/caras en 1 KB', () => {
    const h = 'ply\nformat ascii 1.0\nelement vertex 2000000000\nproperty float x\nproperty float y\nproperty float z\nelement face 2000000000\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n';
    expectTyped('mentiroso.ply', attack('mentiroso.ply', enc(h)));
  });

  it('PLY binario con cabecera que declara 4e9 elementos', () => {
    const head = 'ply\nformat binary_little_endian 1.0\nelement vertex 4294967295\nproperty float x\nproperty float y\nproperty float z\nelement face 4294967295\nproperty list uchar uint vertex_indices\nend_header\n';
    const bytes = new Uint8Array(1024);
    bytes.set(new TextEncoder().encode(head));
    expectTyped('mentiroso-bin.ply', attack('mentiroso-bin.ply', bytes.buffer as ArrayBuffer));
  });

  it('PLY con propiedades de lista de longitud absurda y sin end_header', () => {
    expectTyped('sinend.ply', attack('sinend.ply', enc('ply\nformat ascii 1.0\nelement vertex 3\n' + 'property float x\n'.repeat(1000))));
    const h = 'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n255 0 1 2\n';
    expectTyped('lista.ply', attack('lista.ply', enc(h)));
  });

  it('STL binario truncado (declara 1e6 triángulos, trae 10) y STL ASCII truncado', () => {
    const buf = new ArrayBuffer(84 + 10 * 50);
    new DataView(buf).setUint32(80, 1_000_000, true);
    expectTyped('truncado.stl', attack('truncado.stl', buf));
    expectTyped('truncado-ascii.stl', attack('truncado-ascii.stl', enc('solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\n')));
    const huge = new ArrayBuffer(84);
    new DataView(huge).setUint32(80, 0xffffffff, true);
    expectTyped('declara4e9.stl', attack('declara4e9.stl', huge));
    expectTyped('cabecera.stl', attack('cabecera.stl', new ArrayBuffer(40)));
  });

  it('STL con NaN/Infinito en coordenadas', () => {
    const buf = new ArrayBuffer(84 + 50);
    const dv = new DataView(buf);
    dv.setUint32(80, 1, true);
    dv.setFloat32(96, Number.NaN, true);
    dv.setFloat32(108, Number.POSITIVE_INFINITY, true);
    expectTyped('nan.stl', attack('nan.stl', buf));
  });

  it('OBJ con índices fuera de rango, cero, negativos excesivos y vértices no finitos', () => {
    const v = 'v 0 0 0\nv 1 0 0\nv 0 1 0\n';
    for (const [n, f] of [['alto', 'f 1 2 99999999'], ['cero', 'f 0 1 2'], ['neg', 'f -9 -8 -7'], ['txt', 'f a b c'], ['cuatro-mil-millones', 'f 1 2 4294967297']]) {
      expectTyped(`${n}.obj`, attack(`${n}.obj`, enc(v + f + '\n')));
    }
    expectTyped('nan.obj', attack('nan.obj', enc('v nan 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')));
    expectTyped('inf.obj', attack('inf.obj', enc('v 1e999 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')));
    expectTyped('vacio.obj', attack('vacio.obj', enc('# nada\n')));
  });

  it('OBJ con una cara de 200000 vértices y con millones de vértices sin caras', () => {
    const face = 'f ' + Array.from({ length: 200_000 }, (_, i) => String((i % 3) + 1)).join(' ') + '\n';
    const r1 = attack('cara-enorme.obj', enc('v 0 0 0\nv 1 0 0\nv 0 1 0\n' + face));
    if (!r1.ok) expect(r1.err).toBeInstanceOf(ModelImportError);
    const verts = 'v 1 2 3\n'.repeat(1_500_000);
    expectTyped('solo-vertices.obj', attack('solo-vertices.obj', enc(verts)));
  });
});
