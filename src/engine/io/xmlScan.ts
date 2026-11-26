/**
 * @file src/engine/io/xmlScan.ts
 * @description Escáner XML lineal (indexOf) para los lectores 3MF: recorre elementos por nombre local
 * sin expresiones regulares con retroceso, de modo que etiquetas sin cerrar o sin `>` no provoquen
 * tiempo cuadrático. Las etiquetas contenedoras sin cierre y las aperturas sin `>` se rechazan como
 * archivo dañado. En las pasadas de metadatos (`skipOversized`), una etiqueta legítima de más de
 * 64 KiB (p. ej. una miniatura en base64 dentro de un atributo) se salta sin reservar su contenido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { ModelImportError } from './importErrors';

/**
 * Longitud máxima de una etiqueta de apertura (atributos incluidos). Medido en 3MF reales de Bambu
 * Studio/OrcaSlicer/PrusaSlicer: la más larga ronda 0,5 KB (`<model>` con sus espacios de nombres);
 * las miniaturas van como PNG aparte y las descripciones como texto, no como atributo.
 */
export const MAX_XML_TAG_LENGTH = 64 * 1024;

/**
 * Si en `lt` empieza un comentario `<!-- … -->` o una sección `<![CDATA[ … ]]>`, devuelve el índice
 * siguiente a su cierre (se saltan enteros: lo que haya dentro no es geometría); si no, -1. Sin cierre
 * es archivo dañado. Cada carácter se examina una vez.
 */
export function skipCommentOrCdata(xml: string, lt: number): number {
  const open = xml.startsWith('<!--', lt) ? '-->' : xml.startsWith('<![CDATA[', lt) ? ']]>' : null;
  if (!open) return -1;
  const close = xml.indexOf(open, lt + 4);
  if (close < 0) throw new ModelImportError('corrupt', open === '-->' ? 'comentario sin cerrar' : 'CDATA sin cerrar');
  return close + open.length;
}

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
  /**
   * true: una apertura bien cerrada de más de `MAX_XML_TAG_LENGTH` se salta (no se visita ni se copia)
   * en vez de rechazar el archivo. Solo para pasadas de metadatos; la geometría nunca se salta.
   */
  skipOversized?: boolean;
}

function isNameEnd(code: number): boolean {
  // espacio, tab, CR, LF, '/', '>'
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 47 || code === 62;
}

/** true si el nombre local (tras el último `:`) de `xml[from..to)` es `target` (ASCII, minúsculas). */
function localNameIs(xml: string, from: number, to: number, target: string): boolean {
  let start = from;
  for (let k = to - 1; k >= from; k--) {
    if (xml.charCodeAt(k) === 58) {
      start = k + 1;
      break;
    }
  }
  if (to - start !== target.length) return false;
  for (let k = 0; k < target.length; k++) {
    let c = xml.charCodeAt(start + k);
    if (c >= 65 && c <= 90) c += 32;
    if (c !== target.charCodeAt(k)) return false;
  }
  return true;
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
    if (first === 33) {
      const after = skipCommentOrCdata(xml, lt);
      if (after >= 0) {
        pos = after;
        continue;
      }
    }
    // Cierres, declaraciones e instrucciones de proceso no son aperturas.
    if (first === 47 || first === 33 || first === 63) {
      pos = lt + 1;
      continue;
    }
    let nameEnd = lt + 1;
    while (nameEnd < n && !isNameEnd(xml.charCodeAt(nameEnd)) && xml.charCodeAt(nameEnd) !== 60) nameEnd++;
    // Comparación sin cortar la cadena: en un 3MF grande se recorren millones de etiquetas por pasada.
    if (!localNameIs(xml, lt + 1, nameEnd, target)) {
      pos = nameEnd;
      continue;
    }
    const qname = xml.slice(lt + 1, nameEnd);
    const gt = xml.indexOf('>', nameEnd);
    if (gt < 0) throw new ModelImportError('corrupt', `etiqueta <${qname.slice(0, 40)}> sin cerrar`);
    if (gt - lt > MAX_XML_TAG_LENGTH) {
      // Un `<` antes del `>` es una apertura sin cerrar: dañado. Si no, es una etiqueta larga legítima.
      const nextLt = xml.indexOf('<', nameEnd);
      if (!options.skipOversized || (nextLt >= 0 && nextLt < gt)) {
        throw new ModelImportError('corrupt', `etiqueta <${qname.slice(0, 40)}> sin cerrar`);
      }
      pos = gt + 1;
      continue;
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

/** Atributos crudos de cada elemento hoja con ese nombre local (`skipOversized`: ver `ScanOptions`). */
export function forEachLeaf(
  xml: string,
  local: string,
  visit: (attrs: string) => void | boolean,
  options: { skipOversized?: boolean } = {},
): void {
  forEachElement(xml, local, (match) => visit(match.attrs), { leaf: true, skipOversized: options.skipOversized });
}
