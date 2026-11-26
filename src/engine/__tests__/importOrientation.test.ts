/**
 * @file src/engine/__tests__/importOrientation.test.ts
 * @description Orientación al importar: STL y OBJ con normales invertidas (volumen −4095 mm³) se
 * reorientan con aviso `IMPORT_NORMALS_FLIPPED` que nombra el archivo; una orientación mezclada
 * solo avisa y no modifica la malla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { localizeEngineWarning, parseModelFile, signedVolumeMm3 } from '../index';
import { computeMeshStats } from '../primitives';
import { toBuffer } from './ioFixtures';

/** Caja [0..w]×[0..h]×[0..d] con triángulos hacia afuera; `flip` decide qué triángulos invertir. */
function boxTriangles(w: number, h: number, d: number, flip: (i: number) => boolean) {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0],
    [0, 0, d], [w, 0, d], [w, h, d], [0, h, d],
  ];
  const t: Array<[number, number, number]> = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ].map((tri, i) => (flip(i) ? [tri[0], tri[2], tri[1]] : tri) as [number, number, number]);
  return { v, t };
}

function asciiStl(w: number, h: number, d: number, flip: (i: number) => boolean): ArrayBuffer {
  const { v, t } = boxTriangles(w, h, d, flip);
  const facets = t.map((tri) => `facet normal 0 0 0\nouter loop\n${tri.map((i) => `vertex ${v[i].join(' ')}`).join('\n')}\nendloop\nendfacet`);
  return toBuffer(strToU8(`solid caja\n${facets.join('\n')}\nendsolid caja\n`));
}

function objText(w: number, h: number, d: number, flip: (i: number) => boolean): ArrayBuffer {
  const { v, t } = boxTriangles(w, h, d, flip);
  const lines = [...v.map((p) => `v ${p.join(' ')}`), ...t.map((tri) => `f ${tri.map((i) => i + 1).join(' ')}`)];
  return toBuffer(strToU8(lines.join('\n') + '\n'));
}

// 13 × 15 × 21 = 4095 mm³, el caso medido por el evaluador.
const all = () => true;
const none = () => false;

describe('importación: orientación de normales', () => {
  it('STL invertido (−4095 mm³): se reorienta y avisa nombrando el archivo', () => {
    const model = parseModelFile('invertido.stl', asciiStl(13, 15, 21, all));
    expect(model.parts).toHaveLength(1);
    expect(signedVolumeMm3(model.parts[0].mesh)).toBeCloseTo(4095, 3);
    expect(computeMeshStats(model.parts[0].mesh).isManifold).toBe(true);
    expect(model.warnings).toEqual([{ code: 'IMPORT_NORMALS_FLIPPED', params: { name: 'invertido.stl' } }]);
    const text = localizeEngineWarning('es', model.warnings![0]);
    expect(text).toContain('invertido.stl');
    expect(localizeEngineWarning('en', model.warnings![0])).toContain('invertido.stl');
  });

  it('OBJ invertido: se reorienta con el mismo aviso', () => {
    const model = parseModelFile('invertido.obj', objText(13, 15, 21, all));
    expect(signedVolumeMm3(model.parts[0].mesh)).toBeCloseTo(4095, 3);
    expect(model.warnings?.map((w) => w.code)).toEqual(['IMPORT_NORMALS_FLIPPED']);
  });

  it('bien orientado: sin aviso y sin cambios', () => {
    const model = parseModelFile('bien.stl', asciiStl(13, 15, 21, none));
    expect(signedVolumeMm3(model.parts[0].mesh)).toBeCloseTo(4095, 3);
    expect(model.warnings ?? []).toEqual([]);
  });

  it('orientación mezclada: avisa sin modificar la malla', () => {
    const buffer = objText(13, 15, 21, (i) => i === 3);
    const before = parseModelFile('mezcla.obj', buffer.slice(0));
    expect(before.warnings).toEqual([{ code: 'IMPORT_NORMALS_INCONSISTENT', params: { name: 'mezcla.obj' } }]);
    // Los índices quedan tal como venían en el archivo (triángulo 3 invertido).
    const idx = Array.from(before.parts[0].mesh.indices.slice(9, 12));
    const pos = before.parts[0].mesh.positions;
    const corners = idx.map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const reference = parseModelFile('ref.obj', objText(13, 15, 21, none)).parts[0].mesh;
    const refIdx = Array.from(reference.indices.slice(9, 12));
    const refCorners = refIdx.map((i) => [reference.positions[i * 3], reference.positions[i * 3 + 1], reference.positions[i * 3 + 2]]);
    expect(corners).toEqual([refCorners[0], refCorners[2], refCorners[1]]);
    expect(localizeEngineWarning('es', before.warnings![0])).toContain('mezcla.obj');
  });
});
