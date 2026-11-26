/**
 * @file src/engine/svg/__tests__/svgQuery.test.ts
 * @description `querySelectorAll`/`querySelector` mínimos sobre el árbol de xmldom: listas de
 * etiquetas separadas por coma, `#id` y `*`, en orden de documento y solo descendientes; selectores
 * no soportados o demasiado largos no encuentran nada (no lanzan), y un árbol muy profundo no
 * desborda la pila.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { querySelectorAllIn, querySelectorIn, type QueryNode } from '../svgQuery';
import { withSvgDomParser } from '../svgDocument';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="a"><stop offset="0"/><stop offset="1"/></linearGradient>
    <g><radialGradient id="b"><stop offset="0.5"/></radialGradient></g>
  </defs>
  <svg:linearGradient id="c"/>
  <rect id="r" width="1" height="1"/>
</svg>`;

function parse(text: string): QueryNode {
  return new XmlDomParser({ onError: () => undefined }).parseFromString(text, 'image/svg+xml') as unknown as QueryNode;
}

const ids = (nodes: QueryNode[]) => nodes.map((n) => n.getAttribute?.('id') ?? n.getAttribute?.('offset'));

describe('svgQuery', () => {
  it('lista de etiquetas separadas por coma en orden de documento (también con prefijo)', () => {
    const doc = parse(SVG);
    expect(ids(querySelectorAllIn(doc, 'linearGradient, radialGradient'))).toEqual(['a', 'b', 'c']);
  });

  it('solo descendientes del nodo, no el propio nodo', () => {
    const doc = parse(SVG);
    const [a] = querySelectorAllIn(doc, 'linearGradient');
    expect(ids(querySelectorAllIn(a, 'stop'))).toEqual(['0', '1']);
    expect(querySelectorAllIn(a, 'linearGradient')).toEqual([]);
  });

  it('#id, * y querySelector (primero o null)', () => {
    const doc = parse(SVG);
    expect(ids(querySelectorAllIn(doc, '#r'))).toEqual(['r']);
    expect(querySelectorIn(doc, '#b')?.getAttribute?.('id')).toBe('b');
    expect(querySelectorIn(doc, '#nada')).toBeNull();
    expect(querySelectorAllIn(doc, '*').length).toBe(10);
  });

  it('selectores no soportados, vacíos o enormes no encuentran nada', () => {
    const doc = parse(SVG);
    for (const sel of ['', ' , ', 'g > stop', '.clase', '[id=a]', 'stop:first-child', `${'a,'.repeat(5000)}stop`]) {
      expect(querySelectorAllIn(doc, sel)).toEqual([]);
    }
  });

  it('un árbol de 20 000 niveles se recorre sin desbordar la pila', () => {
    const depth = 20_000;
    const doc = parse(`<svg>${'<g>'.repeat(depth)}<stop/>${'</g>'.repeat(depth)}</svg>`);
    expect(querySelectorAllIn(doc, 'stop').length).toBe(1);
  });

  it('el documento decorado los expone para SVGLoader (gradiente con stops)', () => {
    const parsed = withSvgDomParser(() => new (globalThis as unknown as { DOMParser: new () => { parseFromString(t: string): QueryNode } }).DOMParser().parseFromString(SVG));
    const doc = parsed as QueryNode & { querySelectorAll(s: string): QueryNode[] };
    const grads = doc.querySelectorAll('linearGradient, radialGradient');
    expect(grads.length).toBe(3);
    const g0 = grads[0] as QueryNode & { querySelectorAll(s: string): QueryNode[] };
    expect(g0.querySelectorAll('stop').length).toBe(2);
  });
});
