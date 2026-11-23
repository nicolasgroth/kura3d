/**
 * @file src/engine/__tests__/importHostileReal.test.ts
 * @description Archivos hostiles contra la importación de modelos reales (revisión de seguridad):
 * placas que repiten la misma instancia no multiplican la malla, OBJ con miles de `o` respeta
 * `maxParts`, conjuntos por barrido ordenado, PLY ASCII con cola enorme sin tokenizarla, caras con
 * demasiados vértices cortadas antes del abanico, PLY sin x/y/z escalares y nombres recortados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { findImportClusters } from '../io/importClusters';
import { MAX_PART_NAME } from '../io/importErrors';
import { placeImportedModels } from '../io/importPlacement';
import { parseModelFile } from '../io/modelImport';
import { readOBJ } from '../io/obj';
import { readPLY } from '../io/ply';
import { read3MF } from '../io/threeMfImport';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};
const buf = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
const TETRA = '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices>' +
  '<triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh>';

describe('placas hostiles', () => {
  it('2000 placas que apuntan a la misma instancia: una sola pieza, una sola vez', () => {
    const model = `<?xml version="1.0"?><model unit="millimeter"><resources><object id="1" type="model">${TETRA}</object><object id="2" type="model">${TETRA}</object></resources>` +
      '<build><item objectid="1"/><item objectid="2" transform="1 0 0 0 1 0 0 0 1 50 0 0"/></build></model>';
    const plate = (o: string) => `<plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="${o}"/><metadata key="instance_id" value="0"/></model_instance></plate>`;
    const cfg = `<config>${plate('1').repeat(2000)}${plate('2')}</config>`;
    const m = read3MF(buf(zipSync({ '3D/3dmodel.model': strToU8(model), 'Metadata/model_settings.config': strToU8(cfg) })), 'p.3mf');
    expect(m.plates).toEqual([{ name: undefined, groups: [0] }, { name: undefined, groups: [1] }]);
    expect(placeImportedModels([m], 'bed')).toHaveLength(2);
  });

  it('conjuntos repetidos en un modelo manipulado no colocan dos veces la misma pieza', () => {
    const m = parseModelFile('a.obj', buf(strToU8('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4\n')));
    const forged = { ...m, clusters: [{ kind: 'assembly' as const, parts: [0, 0, 0] }, { kind: 'assembly' as const, parts: [0] }] };
    expect(placeImportedModels([forged], 'bed')).toHaveLength(1);
  });
});

describe('OBJ con miles de objetos', () => {
  it('respeta maxParts', () => {
    let s = '';
    for (let i = 0; i < 3000; i++) s += `v ${i} 0 0\nv ${i} 1 0\nv ${i} 0 1\no p\nf -3 -2 -1\n`;
    expect(codeOf(() => readOBJ(s, 'x.obj'))).toBe('too-many-parts');
  });

  it('los conjuntos se calculan por barrido: 2000 piezas separadas en poco tiempo y sin montajes', () => {
    let s = '';
    for (let i = 0; i < 1999; i++) s += `o p${i}\nv ${i * 3} 0 0\nv ${i * 3 + 1} 0 0\nv ${i * 3} 1 0\nf -3 -2 -1\n`;
    const model = readOBJ(s, 'x.obj');
    expect(model.parts).toHaveLength(1999);
    expect(findImportClusters(model)).toEqual([]);
  });

  it('una cara con más vértices que el máximo de triángulos se corta antes del abanico', () => {
    const n = 50;
    const obj = Array.from({ length: n }, (_, i) => `v ${Math.cos(i)} ${Math.sin(i)} 0`).join('\n') + `\nf ${Array.from({ length: n }, (_, i) => i + 1).join(' ')}\n`;
    expect(codeOf(() => readOBJ(obj, 'cara.obj', { limits: { maxTriangles: 10 } }))).toBe('too-many-triangles');
  });

  it('los nombres se recortan al largo máximo', () => {
    const obj = `o ${'n'.repeat(5000)}\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`;
    expect(readOBJ(obj, 'x.obj').parts[0].name).toHaveLength(MAX_PART_NAME);
  });
});

describe('PLY hostiles', () => {
  const header = (body: string, extra = '') =>
    `ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\n${extra}element face 1\nproperty list uchar int vertex_indices\nend_header\n${body}`;

  it('ASCII con una cola enorme: lee lo declarado e ignora el resto', () => {
    const body = '0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n' + 'basura '.repeat(500_000);
    const m = readPLY(buf(strToU8(header(body))), 'cola.ply');
    expect(m.parts[0].mesh.indices).toHaveLength(3);
  });

  it('cara con más vértices que el máximo de triángulos: se corta antes de leerla', () => {
    const body = '0 0 0\n1 0 0\n0 1 0\n200 ' + '0 1 2 '.repeat(67) + '\n';
    expect(codeOf(() => readPLY(buf(strToU8(header(body))), 'cara.ply', { maxTriangles: 10 }))).toBe('too-many-triangles');
  });

  it('vértice sin x/y/z escalares: corrupt antes de reservar', () => {
    const ply = 'ply\nformat ascii 1.0\nelement vertex 2\nproperty list uchar float x\nproperty float y\nproperty float z\nend_header\n1 0 0 0\n1 0 0 0\n';
    expect(codeOf(() => readPLY(buf(strToU8(ply)), 'x.ply'))).toBe('corrupt');
  });
});
