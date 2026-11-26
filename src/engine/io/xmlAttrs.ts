/**
 * @file src/engine/io/xmlAttrs.ts
 * @description Lectura lineal de atributos XML para los lectores 3MF (sin expresiones regulares con
 * retroceso: un nombre de atributo largo sin `=` ya no bloquea el Worker) y decodificación de
 * entidades básicas y numéricas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;

/**
 * Llama a `visit(name, value)` por cada atributo de la etiqueta `xml[from..to)`. `value` viene sin
 * decodificar (el llamador decide si le hacen falta entidades).
 */
export function eachAttr(xml: string, from: number, to: number, visit: (name: string, value: string) => void): void {
  let i = from;
  while (i < to) {
    while (i < to && isSpace(xml.charCodeAt(i))) i++;
    const nameStart = i;
    while (i < to && xml.charCodeAt(i) !== 61 && !isSpace(xml.charCodeAt(i)) && xml.charCodeAt(i) !== 47) i++;
    if (i === nameStart) {
      i++;
      continue;
    }
    const name = xml.slice(nameStart, i);
    while (i < to && isSpace(xml.charCodeAt(i))) i++;
    if (xml.charCodeAt(i) !== 61) continue; // atributo sin valor: se ignora
    i++;
    while (i < to && isSpace(xml.charCodeAt(i))) i++;
    const quote = xml.charCodeAt(i);
    if (quote !== 34 && quote !== 39) continue;
    // La comilla de cierre se busca solo dentro de la etiqueta: buscarla en el resto del documento haría
    // el recorrido cuadrático con atributos sin cerrar.
    let close = i + 1;
    while (close < to && xml.charCodeAt(close) !== quote) close++;
    if (close >= to) return;
    visit(name, xml.slice(i + 1, close));
    i = close + 1;
  }
}

/** Atributos de una etiqueta cruda (`nombre="valor"`), con entidades decodificadas. O(n). */
export function parseXmlAttrs(attrString: string): Record<string, string> {
  // Sin prototipo: un atributo llamado `__proto__` no altera el objeto.
  const result = Object.create(null) as Record<string, string>;
  eachAttr(attrString, 0, attrString.length, (name, value) => {
    result[name] = decodeXmlEntities(value);
  });
  return result;
}

/** Decodifica las entidades XML básicas y numéricas. */
export function decodeXmlEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const lower = e.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
  });
}

