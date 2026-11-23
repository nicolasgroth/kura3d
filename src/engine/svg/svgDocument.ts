/**
 * @file src/engine/svg/svgDocument.ts
 * @description Lectura del XML de un SVG con `@xmldom/xmldom` (MIT), igual en navegador, Worker y
 * Node, y adaptación mínima del árbol a lo que `THREE.SVGLoader` espera de un DOM de navegador:
 * `viewportElement.getElementById` para `<use>` (también con `href` de SVG 2), `style` en línea consultable por propiedad y
 * `sheet.cssRules` para bloques `<style>` con selectores simples, y `querySelectorAll`/`querySelector`
 * mínimos (`svgQuery.ts`) que `parseGradients` usa sobre el documento y los gradientes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { queryMethods } from './svgQuery';

type AnyNode = {
  nodeType: number;
  nodeName: string;
  childNodes: ArrayLike<AnyNode>;
  textContent: string | null;
  getAttribute(name: string): string | null;
  [extra: string]: unknown;
};

/** Declaraciones `prop: valor` de un texto CSS; las claves quedan como en SVG (`fill-rule`). */
function parseDeclarations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(';')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).replace(/!important/i, '').trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/**
 * Igual que `CSSStyleDeclaration` en lo que lee `SVGLoader`: una propiedad ausente vale `''` (no
 * `undefined`), `length` y `style[i]` enumeran los nombres, y `getPropertyValue(nombre)` (r18x recorre
 * así las reglas de `<style>`).
 */
function styleDeclaration(decls: Record<string, string>): Record<string, string> {
  const names = Object.keys(decls);
  const getPropertyValue = (name: string) => decls[name] ?? '';
  return new Proxy(decls, {
    get: (target, prop) => {
      if (typeof prop !== 'string') return undefined;
      if (prop === 'length') return names.length;
      if (prop === 'getPropertyValue') return getPropertyValue;
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      const index = Number(prop);
      if (Number.isInteger(index) && index >= 0 && String(index) === prop) return names[index] ?? '';
      return '';
    },
  });
}

/** Reglas `selector { … }` de un bloque `<style>` en la forma que lee `SVGLoader` (`type 1`). */
export function parseStyleSheet(css: string): { cssRules: { type: number; selectorText: string; style: Record<string, string> }[] } {
  // Recorrido lineal (las regex anteriores eran cuadráticas con `/*` sin cerrar o texto sin `{`).
  let clean = '';
  for (let at = 0; at < css.length;) {
    const open = css.indexOf('/*', at);
    if (open < 0) {
      clean += css.slice(at);
      break;
    }
    clean += css.slice(at, open);
    const close = css.indexOf('*/', open + 2);
    if (close < 0) break; // comentario sin cerrar: el resto se descarta
    at = close + 2;
  }
  const cssRules: { type: number; selectorText: string; style: Record<string, string> }[] = [];
  // Regla = texto sin `{`, `}` ni `@` justo antes de `{`, y cuerpo sin llaves hasta `}`.
  let boundary = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '}' || c === '@') boundary = i + 1;
    if (c !== '{') continue;
    const selectorText = clean.slice(boundary, i).trim();
    let end = i + 1;
    while (end < clean.length && clean[end] !== '{' && clean[end] !== '}') end++;
    if (end < clean.length && clean[end] === '}' && selectorText) {
      cssRules.push({ type: 1, selectorText, style: styleDeclaration(parseDeclarations(clean.slice(i + 1, end))) });
      i = end;
      boundary = end + 1;
    } else {
      boundary = i + 1;
      i = end - 1;
    }
  }
  return { cssRules };
}

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * SVG 2 escribe `<use href="#id">` sin `xlink:`; `SVGLoader` solo lee `xlink:href`. Se copia `href`
 * al atributo con espacio de nombres xlink (si no lo tiene ya).
 */
function normalizeHref(node: AnyNode): void {
  const el = node as AnyNode & { getAttributeNS?(ns: string, name: string): string | null; setAttributeNS?(ns: string, name: string, value: string): void };
  if (node.nodeName !== 'use' || !el.getAttributeNS || !el.setAttributeNS) return;
  const plain = node.getAttribute('href');
  if (plain && !el.getAttributeNS(XLINK_NS, 'href')) el.setAttributeNS(XLINK_NS, 'xlink:href', plain);
}

/** Recorre el árbol y le agrega lo que `SVGLoader` lee de un DOM de navegador. */
function decorate(node: AnyNode, doc: AnyNode): void {
  if (node.nodeType !== 1) return;
  node.viewportElement = doc;
  node.querySelectorAll = queryMethods.querySelectorAll;
  node.querySelector = queryMethods.querySelector;
  normalizeHref(node);
  const inline = node.getAttribute('style');
  node.style = styleDeclaration(inline ? parseDeclarations(inline) : {});
  if (node.nodeName === 'style') node.sheet = parseStyleSheet(node.textContent ?? '');
  for (let i = 0; i < node.childNodes.length; i++) decorate(node.childNodes[i], doc);
}

/** Error de XML mal formado: el llamador lo convierte en el error tipado que corresponda. */
export class SvgSyntaxError extends Error {}

/**
 * `DOMParser` compatible con la llamada de `SVGLoader.parse`: lee con xmldom (sin avisos por
 * consola; un error fatal lanza `SvgSyntaxError`) y decora el documento.
 */
class SvgDomParser {
  parseFromString(text: string): unknown {
    let doc: AnyNode;
    try {
      doc = new XmlDomParser({ onError: () => undefined }).parseFromString(text, 'image/svg+xml') as unknown as AnyNode;
    } catch (err) {
      throw new SvgSyntaxError(err instanceof Error ? err.message : String(err));
    }
    const root = doc.documentElement as AnyNode | null;
    if (!root) throw new SvgSyntaxError('SVG without root element');
    doc.querySelectorAll = queryMethods.querySelectorAll;
    doc.querySelector = queryMethods.querySelector;
    decorate(root, doc);
    return doc;
  }
}

const scope = globalThis as { DOMParser?: unknown };

/**
 * Ejecuta `fn` (síncrona) con `SvgDomParser` como `DOMParser` global y restaura el original.
 * `SVGLoader.parse` crea su `DOMParser` internamente; así lee el mismo árbol en todo entorno.
 */
export function withSvgDomParser<T>(fn: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(scope, 'DOMParser');
  const previous = scope.DOMParser;
  scope.DOMParser = SvgDomParser;
  try {
    return fn();
  } finally {
    if (had) scope.DOMParser = previous;
    else delete scope.DOMParser;
  }
}
