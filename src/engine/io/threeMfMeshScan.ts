/**
 * @file src/engine/io/threeMfMeshScan.ts
 * @description Lectura rápida de `<vertex>` y `<triangle>` de una malla 3MF: un solo recorrido lineal con
 * `indexOf` y lectura de atributos sin expresiones regulares ni objetos intermedios por elemento (en un
 * 3MF de 3 M triángulos era la mayor parte del tiempo de importación). Mismas reglas que `xmlScan`:
 * etiqueta sin `>` o con `<` dentro es archivo dañado, y el coste es O(n) sobre el texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError } from './importErrors';
import { decodeXmlEntities } from './threeMfPackage';
import { MAX_XML_TAG_LENGTH } from './xmlScan';

const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
const isNameEnd = (c: number) => isSpace(c) || c === 47 || c === 62;

/**
 * Llama a `visit(name, value)` por cada atributo de la etiqueta `xml[from..to)`. `value` viene sin
 * decodificar (el llamador decide si le hacen falta entidades).
 */
function eachAttr(xml: string, from: number, to: number, visit: (name: string, value: string) => void): void {
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
    const close = xml.indexOf(quote === 34 ? '"' : "'", i + 1);
    if (close < 0 || close >= to) return;
    visit(name, xml.slice(i + 1, close));
    i = close + 1;
  }
}

/**
 * Recorre los elementos hoja con nombre local `local` (en minúsculas) y entrega el rango de sus
 * atributos. Devuelve la cantidad visitada.
 */
function eachLeaf(xml: string, local: string, visit: (from: number, to: number) => void): number {
  const n = xml.length;
  let pos = 0;
  let count = 0;
  while (pos < n) {
    const lt = xml.indexOf('<', pos);
    if (lt < 0) break;
    const first = xml.charCodeAt(lt + 1);
    if (first === 47 || first === 33 || first === 63) {
      pos = lt + 1;
      continue;
    }
    let nameEnd = lt + 1;
    while (nameEnd < n && !isNameEnd(xml.charCodeAt(nameEnd)) && xml.charCodeAt(nameEnd) !== 60) nameEnd++;
    let nameStart = lt + 1;
    for (let k = nameStart; k < nameEnd; k++) if (xml.charCodeAt(k) === 58) nameStart = k + 1;
    if (nameEnd - nameStart !== local.length || xml.slice(nameStart, nameEnd).toLowerCase() !== local) {
      pos = nameEnd;
      continue;
    }
    const gt = xml.indexOf('>', nameEnd);
    if (gt < 0 || gt - lt > MAX_XML_TAG_LENGTH) throw new ModelImportError('corrupt', `etiqueta <${local}> sin cerrar`);
    const lt2 = xml.indexOf('<', nameEnd);
    if (lt2 >= 0 && lt2 < gt) throw new ModelImportError('corrupt', `etiqueta <${local}> sin cerrar`);
    visit(nameEnd, xml.charCodeAt(gt - 1) === 47 ? gt - 1 : gt);
    count++;
    pos = gt + 1;
  }
  return count;
}

/** Recorre `<vertex x y z/>` y entrega sus coordenadas (NaN si falta o no es un número). */
export function scanVertices(block: string, visit: (x: number, y: number, z: number, index: number) => void): number {
  let index = 0;
  return eachLeaf(block, 'vertex', (from, to) => {
    let x = NaN, y = NaN, z = NaN;
    eachAttr(block, from, to, (name, value) => {
      if (name === 'x') x = Number(value);
      else if (name === 'y') y = Number(value);
      else if (name === 'z') z = Number(value);
    });
    visit(x, y, z, index++);
  });
}

/** Atributos de un `<triangle>`: índices crudos y propiedades opcionales. */
export interface TriangleAttrs {
  v1: string;
  v2: string;
  v3: string;
  pid?: string;
  p1?: string;
}

/** Recorre `<triangle v1 v2 v3 [pid] [p1]/>`; el objeto entregado se reutiliza entre llamadas. */
export function scanTriangles(block: string, visit: (attrs: TriangleAttrs) => void): number {
  const attrs: TriangleAttrs = { v1: '', v2: '', v3: '' };
  return eachLeaf(block, 'triangle', (from, to) => {
    attrs.v1 = attrs.v2 = attrs.v3 = '';
    attrs.pid = attrs.p1 = undefined;
    eachAttr(block, from, to, (name, raw) => {
      const value = raw.includes('&') ? decodeXmlEntities(raw) : raw;
      if (name === 'v1') attrs.v1 = value;
      else if (name === 'v2') attrs.v2 = value;
      else if (name === 'v3') attrs.v3 = value;
      else if (name === 'pid') attrs.pid = value;
      else if (name === 'p1') attrs.p1 = value;
    });
    visit(attrs);
  });
}
