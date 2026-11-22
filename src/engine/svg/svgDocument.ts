/**
 * @file src/engine/svg/svgDocument.ts
 * @description Lectura del XML de un SVG con `@xmldom/xmldom` (MIT), igual en navegador, Worker y
 * Node, y adaptación mínima del árbol a lo que `THREE.SVGLoader` espera de un DOM de navegador:
 * `viewportElement.getElementById` para `<use>`, `style` en línea consultable por propiedad y
 * `sheet.cssRules` para bloques `<style>` con selectores simples.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { DOMParser as XmlDomParser } from '@xmldom/xmldom';

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

/** Igual que `CSSStyleDeclaration`: una propiedad ausente vale `''`, no `undefined`. */
function styleDeclaration(decls: Record<string, string>): Record<string, string> {
  return new Proxy(decls, {
    get: (target, prop) => (typeof prop === 'string' ? (target[prop] ?? '') : undefined),
  });
}

/** Reglas `selector { … }` de un bloque `<style>` en la forma que lee `SVGLoader` (`type 1`). */
function parseStyleSheet(css: string): { cssRules: { type: number; selectorText: string; style: Record<string, string> }[] } {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const cssRules: { type: number; selectorText: string; style: Record<string, string> }[] = [];
  const ruleRegex = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRegex.exec(clean)) !== null) {
    const selectorText = m[1].trim();
    if (selectorText) cssRules.push({ type: 1, selectorText, style: parseDeclarations(m[2]) });
  }
  return { cssRules };
}

/** Recorre el árbol y le agrega lo que `SVGLoader` lee de un DOM de navegador. */
function decorate(node: AnyNode, doc: AnyNode): void {
  if (node.nodeType !== 1) return;
  node.viewportElement = doc;
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
