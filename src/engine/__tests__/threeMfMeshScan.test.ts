/**
 * @file src/engine/__tests__/threeMfMeshScan.test.ts
 * @description Escáner rápido de vértices/triángulos 3MF: lee comillas simples o dobles y entidades,
 * rechaza etiquetas con `<` dentro, y con miles de atributos sin comilla de cierre sigue siendo lineal
 * (la comilla se busca solo dentro de la etiqueta; con N y 2N etiquetas el tiempo crece < 3×).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { scanTriangles, scanVertices } from '../io/threeMfMeshScan';

describe('scanVertices / scanTriangles', () => {
  it('lee coordenadas e índices con comillas simples, dobles y prefijo', () => {
    const got: number[][] = [];
    expect(scanVertices(`<vertex x="1" y='2.5' z="-3"/><!-- c --><m:vertex z="6" y="5" x="4"/>`, (x, y, z) => got.push([x, y, z]))).toBe(2);
    expect(got).toEqual([[1, 2.5, -3], [4, 5, 6]]);
    const tris: string[] = [];
    scanTriangles('<triangle v1="0" v2="1" v3="2" pid="&#49;" p1="3"/><triangle v1="2" v2="1" v3="0"/>', (a) => tris.push(`${a.v1},${a.v2},${a.v3},${a.pid},${a.p1}`));
    expect(tris).toEqual(['0,1,2,1,3', '2,1,0,undefined,undefined']);
  });

  it('un atributo sin comilla de cierre se ignora (coordenada NaN)', () => {
    const got: number[][] = [];
    scanVertices(`<vertex x='1 y="2" z="3"/>`, (x, y, z) => got.push([x, y, z]));
    expect(Number.isNaN(got[0][0])).toBe(true);
  });

  it('una etiqueta con < dentro es archivo dañado', () => {
    expect(() => scanVertices('<vertex x="1" <vertex/>', () => {})).toThrow(expect.objectContaining({ code: 'corrupt' }));
  });

  it('miles de atributos sin comilla de cierre: tiempo lineal', () => {
    const doc = (n: number) => `<vertex x='1 y="2" z="3"/>\n`.repeat(n);
    const time = (xml: string) => {
      let best = Infinity;
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        scanVertices(xml, () => {});
        best = Math.min(best, performance.now() - t0);
      }
      return best;
    };
    const small = doc(40_000); // ~1 MB
    const large = doc(80_000);
    time(small); // calentamiento
    const ratio = time(large) / Math.max(time(small), 0.5);
    expect(ratio).toBeLessThan(3);
  });
});
