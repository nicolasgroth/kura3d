/**
 * @file src/utils/creasedShading.test.ts
 * @description Sombreado con pliegue precalculado fuera del hilo principal: el Worker entrega normales,
 * índices y el mapa de vértices de origen; el visor lo reutiliza sobre la malla ya trasladada sin
 * recalcular (misma salida que el cálculo directo).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { describe, expect, it } from 'vitest';
import { parseModelFile } from '../engine';
import { cubeMeshXml, modelXml, pack3mf, translate } from '../engine/__tests__/ioFixtures';
import { attachViewportShading } from '../engine/io/importShading';
import { computeCreasedMesh, computeCreasedShading, getCreasedMesh, primeCreasedMesh } from './creasedNormals';

const cube = () => ({
  p: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]),
  i: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]),
});

describe('sombreado con pliegue precalculado', () => {
  it('el mapa de origen reconstruye las posiciones del cálculo directo', () => {
    const { p, i } = cube();
    const shading = computeCreasedShading(p, i);
    const direct = computeCreasedMesh(p, i);
    expect(shading.indices).toEqual(direct.indices);
    expect(shading.normals).toEqual(direct.normals);
    expect(shading.source.length * 3).toBe(direct.positions.length);
    for (let v = 0; v < shading.source.length; v++) {
      for (let k = 0; k < 3; k++) expect(direct.positions[v * 3 + k]).toBe(p[shading.source[v] * 3 + k]);
    }
  });

  it('sembrado sobre la malla trasladada: getCreasedMesh lo devuelve sin recalcular y con las posiciones nuevas', () => {
    const { p, i } = cube();
    const shading = computeCreasedShading(p, i);
    const moved = p.map((v, k) => v + [10, -5, 3][k % 3]);
    primeCreasedMesh(moved, i, shading);
    const got = getCreasedMesh(moved, i);
    // Mismos buffers que el sembrado (no hubo cálculo nuevo).
    expect(got.normals).toBe(shading.normals);
    expect(got.indices).toBe(shading.indices);
    const fresh = computeCreasedMesh(moved, i);
    expect(got.positions).toEqual(fresh.positions);
    expect(got.normals).toEqual(fresh.normals);
  });

  it('un sombreado que no calza con la malla se ignora (se recalcula)', () => {
    const { p, i } = cube();
    const shading = computeCreasedShading(p, i);
    const other = new Uint32Array(i.subarray(0, 18));
    primeCreasedMesh(p, other, shading);
    expect(getCreasedMesh(p, other).indices.length).toBe(18);
  });

  it('el Worker lo adjunta una vez por malla única y entrega sus buffers para transferir', () => {
    const file = pack3mf({
      '3D/3dmodel.model': modelXml(
        `<object id="1" name="A">${cubeMeshXml(5)}</object>`,
        `<item objectid="1" transform="${translate(0, 0, 0)}"/><item objectid="1" transform="${translate(20, 0, 0)}"/>`,
      ),
    });
    const model = parseModelFile('p.3mf', file);
    const transfer = attachViewportShading(model);
    const shadings = model.parts.map((part) => part.analysis?.shading);
    expect(shadings.every(Boolean)).toBe(true);
    if (model.parts[0].mesh === model.parts[1].mesh) expect(shadings[0]).toBe(shadings[1]);
    expect(shadings[0]!.indices.length).toBe(model.parts[0].mesh.indices.length);
    expect(transfer).toContain(shadings[0]!.normals.buffer);
    expect(new Set(transfer).size).toBe(transfer.length);
  });
});
