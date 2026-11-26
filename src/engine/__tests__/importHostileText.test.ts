/**
 * @file src/engine/__tests__/importHostileText.test.ts
 * @description Texto hostil en los lectores (revisión de seguridad): atributo XML largo sin `=`,
 * etiqueta enorme, geometría dentro de comentarios o CDATA (se salta, como en el laminador), `mtllib`
 * con mucho espacio en blanco y CSS de SVG sin cerrar. Las entradas son lo bastante grandes para que
 * un algoritmo cuadrático tarde minutos; el tope de la prueba (holgado, 10 s) solo atrapa ese caso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { objMaterialLibraries } from '../io/obj';
import { scanVertices } from '../io/threeMfMeshScan';
import { read3MF } from '../io/threeMfImport';
import { parseXmlAttrs } from '../io/xmlAttrs';
import { forEachLeaf } from '../io/xmlScan';
import { parseStyleSheet } from '../svg/svgDocument';

const SLOW = 10_000;
const TRI = '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh>';
const pack = (model: string) => {
  const z = zipSync({ '3D/3dmodel.model': strToU8(model) });
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
};
const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};

describe('atributos XML', () => {
  it('nombre de atributo largo sin `=`: lineal', () => {
    expect(parseXmlAttrs(' ' + 'a'.repeat(300_000))).toEqual({});
    expect(parseXmlAttrs(` id="7" name='a &amp; b' ${'z'.repeat(100_000)}`)).toEqual({ id: '7', name: 'a & b' });
  }, SLOW);

  it('`__proto__` como atributo no altera el objeto', () => {
    const attrs = parseXmlAttrs(' __proto__="x" id="1"');
    expect(Object.getPrototypeOf(attrs)).toBeNull();
    expect(attrs.id).toBe('1');
  });

  it('una etiqueta de más de 64 KiB es archivo dañado', () => {
    const model = `<?xml version="1.0"?><model unit="millimeter" ${'a'.repeat(200_000)}><resources><object id="1">${TRI}</object></resources><build><item objectid="1"/></build></model>`;
    expect(codeOf(() => read3MF(pack(model), 'x.3mf'))).toBe('corrupt');
  }, SLOW);
});

describe('comentarios y CDATA', () => {
  it('la geometría dentro de un comentario o CDATA no se lee', () => {
    const got: number[] = [];
    scanVertices('<vertex x="1" y="0" z="0"/><!-- <vertex x="99" y="0" z="0"/> --><![CDATA[<vertex x="98" y="0" z="0"/>]]><vertex x="2" y="0" z="0"/>', (x) => got.push(x));
    expect(got).toEqual([1, 2]);
    const items: string[] = [];
    forEachLeaf('<item objectid="1"/><!-- <item objectid="2"/> -->', 'item', (a) => { items.push(a); });
    expect(items).toHaveLength(1);
  });

  it('un objeto comentado no se importa', () => {
    const model = `<?xml version="1.0"?><model unit="millimeter"><resources><object id="1">${TRI}</object><!-- <object id="2">${TRI}</object> --></resources><build><item objectid="1"/></build></model>`;
    expect(read3MF(pack(model), 'x.3mf').parts).toHaveLength(1);
  });

  it('comentario sin cerrar: corrupt', () => {
    expect(codeOf(() => scanVertices('<vertex x="1" y="0" z="0"/><!-- sin cierre', () => {}))).toBe('corrupt');
  });
});

describe('otros textos', () => {
  it('mtllib con mucho espacio en blanco: lineal y mismo resultado', () => {
    expect(objMaterialLibraries('# c\n  mtllib  colores.mtl  \nv 0 0 0\nmtllibx no.mtl\n')).toEqual(['colores.mtl']);
    expect(objMaterialLibraries(`mtllib a${' '.repeat(200_000)}b\n${'\n'.repeat(200_000)}`)).toHaveLength(1);
  }, SLOW);

  it('CSS de SVG con `/*` sin cerrar y texto sin `{`: lineal y mismas reglas', () => {
    expect(parseStyleSheet('/* c */ .a, .b { fill: none; } @media x { .c { fill: red } }').cssRules.map((r) => r.selectorText)).toEqual(['.a, .b', '.c']);
    expect(parseStyleSheet('/*'.repeat(100_000)).cssRules).toEqual([]);
    expect(parseStyleSheet('a'.repeat(300_000)).cssRules).toEqual([]);
  }, SLOW);
});
