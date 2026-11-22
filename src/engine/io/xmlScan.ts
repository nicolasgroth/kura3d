/**
 * @file src/engine/io/xmlScan.ts
 * @description Escáner XML lineal (indexOf) para los lectores 3MF: recorre elementos por nombre local
 * sin expresiones regulares con retroceso, de modo que etiquetas sin cerrar o sin `>` no provoquen
 * tiempo cuadrático. Las etiquetas contenedoras sin cierre y las aperturas sin `>` se rechazan como
 * archivo dañado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError } from './importErrors';

/** Longitud máxima de una etiqueta de apertura (atributos incluidos). */
export const MAX_XML_TAG_LENGTH = 1 << 20;

/** Elemento encontrado: atributos crudos y cuerpo (null en hojas o etiquetas autocerradas). */
export interface XmlElementMatch {
  attrs: string;
  body: string | null;
  /** Índice del `<` de apertura. */
  start: number;
  /** Índice siguiente al `>` final del elemento. */
  end: number;
}

interface ScanOptions {
  /** true: elemento hoja (no se busca el cierre ni se devuelve cuerpo). */
  leaf?: boolean;
}

function isNameEnd(code: number): boolean {
  // espacio, tab, CR, LF, '/', '>'
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 47 || code === 62;
}

/**
 * Visita cada elemento cuyo nombre local (sin prefijo de espacio de nombres) coincide con `local`
 * (sin distinguir mayúsculas). `visit` puede devolver `false` para detener el recorrido.
 * Coste O(n) sobre el texto: cada carácter se examina un número acotado de veces.
 */
export function forEachElement(
  xml: string,
  local: string,
  visit: (match: XmlElementMatch) => void | boolean,
  options: ScanOptions = {},
): void {
  const target = local.toLowerCase();
  const n = xml.length;
  let pos = 0;
  while (pos < n) {
    const lt = xml.indexOf('<', pos);
    if (lt < 0) return;
    const first = xml.charCodeAt(lt + 1);
    // Cierres, comentarios, declaraciones e instrucciones de proceso no son aperturas.
    if (first === 47 || first === 33 || first === 63) {
      pos = lt + 1;
      continue;
    }
    let nameEnd = lt + 1;
    while (nameEnd < n && !isNameEnd(xml.charCodeAt(nameEnd)) && xml.charCodeAt(nameEnd) !== 60) nameEnd++;
    const qname = xml.slice(lt + 1, nameEnd);
    const colon = qname.lastIndexOf(':');
    const name = (colon >= 0 ? qname.slice(colon + 1) : qname).toLowerCase();
    if (name !== target) {
      pos = nameEnd;
      continue;
    }
    const gt = xml.indexOf('>', nameEnd);
    if (gt < 0 || gt - lt > MAX_XML_TAG_LENGTH) {
      throw new ModelImportError('corrupt', `etiqueta <${qname.slice(0, 40)}> sin cerrar`);
    }
    const selfClosing = xml.charCodeAt(gt - 1) === 47;
    const attrs = xml.slice(nameEnd, selfClosing ? gt - 1 : gt);
    if (attrs.includes('<')) {
      throw new ModelImportError('corrupt', `etiqueta <${qname.slice(0, 40)}> sin cerrar`);
    }
    if (options.leaf || selfClosing) {
      if (visit({ attrs, body: options.leaf ? null : '', start: lt, end: gt + 1 }) === false) return;
      pos = gt + 1;
      continue;
    }
    const closeTag = `</${qname}`;
    let close = xml.indexOf(closeTag, gt + 1);
    while (close >= 0 && !isNameEnd(xml.charCodeAt(close + closeTag.length))) {
      close = xml.indexOf(closeTag, close + closeTag.length);
    }
    if (close < 0) throw new ModelImportError('corrupt', `falta </${qname.slice(0, 40)}>`);
    const closeEnd = xml.indexOf('>', close + closeTag.length);
    if (closeEnd < 0) throw new ModelImportError('corrupt', `falta </${qname.slice(0, 40)}>`);
    if (visit({ attrs, body: xml.slice(gt + 1, close), start: lt, end: closeEnd + 1 }) === false) return;
    pos = closeEnd + 1;
  }
}

/** Primer elemento con ese nombre local, o null. */
export function findElement(xml: string, local: string): XmlElementMatch | null {
  let found: XmlElementMatch | null = null;
  forEachElement(xml, local, (match) => {
    found = match;
    return false;
  });
  return found;
}

/** Atributos crudos de cada elemento hoja con ese nombre local. */
export function forEachLeaf(xml: string, local: string, visit: (attrs: string) => void | boolean): void {
  forEachElement(xml, local, (match) => visit(match.attrs), { leaf: true });
}
