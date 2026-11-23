/**
 * @file src/engine/io/zipCentralDirectory.ts
 * @description Lectura del directorio central de un ZIP (incluido zip64): por cada entrada, nombre,
 * método, tamaños comprimido/descomprimido y posición exacta de sus datos, validados contra la cabecera
 * local. Con esto cada entrada se descomprime con su tamaño real, sin buscar la firma del descriptor de
 * datos (que puede aparecer por azar dentro de los datos comprimidos). Un directorio ausente o
 * inconsistente es `ModelImportError('corrupt')`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ModelImportError } from './importErrors';

/** Entrada del directorio central, con la posición de sus datos ya resuelta. */
export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Offset del primer byte de datos (tras la cabecera local). */
  dataOffset: number;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_COMMENT = 0xffff;

const corrupt = (detail: string) => new ModelImportError('corrupt', `ZIP: ${detail}`);

function u64(view: DataView, at: number): number {
  const value = view.getUint32(at, true) + view.getUint32(at + 4, true) * 4294967296;
  if (!Number.isSafeInteger(value)) throw corrupt('tamaño zip64 fuera de rango');
  return value;
}

/** Busca el registro final (EOCD) cuyo comentario declarado termina justo al final del archivo. */
function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - MAX_COMMENT);
  for (let at = view.byteLength - 22; at >= min; at--) {
    if (view.getUint32(at, true) === SIG_EOCD && at + 22 + view.getUint16(at + 20, true) === view.byteLength) return at;
  }
  // El registro final debe terminar exactamente al final del archivo (con su comentario): bytes de más
  // tras él, o una firma suelta, son un archivo ambiguo y se rechazan.
  throw corrupt('falta el directorio central o hay bytes tras su registro final');
}

/** Ruta insegura o ambigua: absoluta, con unidad, con `..` o con caracteres de control. */
export function isUnsafeEntryName(name: string): boolean {
  if (name.length === 0 || /[\u0000-\u001f]/.test(name)) return true;
  const norm = name.replace(/\\/g, '/');
  if (norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) return true;
  return norm.split('/').some((seg) => seg === '..');
}

/**
 * Lee el directorio central. Las entradas con nombre inseguro se omiten; los directorios (nombre que
 * termina en `/`) también. Lanza `too-many-parts` si hay más de `maxEntries` entradas.
 */
export function readZipDirectory(bytes: Uint8Array, maxEntries: number): ZipEntry[] {
  if (bytes.length < 22) throw corrupt('archivo demasiado corto');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  let count = view.getUint16(eocd + 10, true);
  let cdSize = view.getUint32(eocd + 12, true);
  let cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc < 0 || view.getUint32(loc, true) !== SIG_ZIP64_LOCATOR) throw corrupt('falta el registro zip64');
    const z64 = u64(view, loc + 8);
    if (z64 + 56 > bytes.length || view.getUint32(z64, true) !== SIG_ZIP64_EOCD) throw corrupt('registro zip64 inválido');
    count = u64(view, z64 + 32);
    cdSize = u64(view, z64 + 40);
    cdOffset = u64(view, z64 + 48);
  }
  if (count > maxEntries) throw new ModelImportError('too-many-parts', `${count} entradas en el ZIP`);
  if (cdOffset + cdSize > bytes.length) throw corrupt('directorio central fuera del archivo');

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let at = cdOffset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > cdOffset + cdSize || view.getUint32(at, true) !== SIG_CENTRAL) throw corrupt(`entrada ${i + 1} del directorio central`);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    let compressedSize = view.getUint32(at + 20, true);
    let uncompressedSize = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    let localOffset = view.getUint32(at + 42, true);
    const next = at + 46 + nameLen + extraLen + commentLen;
    if (next > cdOffset + cdSize) throw corrupt(`entrada ${i + 1} sale del directorio central`);
    const rawName = bytes.subarray(at + 46, at + 46 + nameLen);
    // Sin la bandera UTF-8 (bit 11), la especificación ZIP manda CP437, no latin1.
    const name = flags & 0x800 ? new TextDecoder('utf-8').decode(rawName) : decodeCp437(rawName);
    // Campo extra zip64: solo trae los valores que en la cabecera valen 0xFFFFFFFF, en este orden.
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      let e = at + 46 + nameLen;
      const end = e + extraLen;
      let found = false;
      while (e + 4 <= end) {
        const id = view.getUint16(e, true);
        const size = view.getUint16(e + 2, true);
        if (id === 0x0001) {
          let p = e + 4;
          const take = () => {
            if (p + 8 > e + 4 + size) throw corrupt('campo zip64 incompleto');
            const v = u64(view, p);
            p += 8;
            return v;
          };
          if (uncompressedSize === 0xffffffff) uncompressedSize = take();
          if (compressedSize === 0xffffffff) compressedSize = take();
          if (localOffset === 0xffffffff) localOffset = take();
          found = true;
          break;
        }
        e += 4 + size;
      }
      if (!found) throw corrupt(`entrada ${name.slice(0, 60)} sin campo zip64`);
    }
    at = next;
    if (name.endsWith('/') || isUnsafeEntryName(name)) continue;
    // Repetidas sin distinguir mayúsculas: el paquete se busca así, y ganaría una al azar.
    const key = name.toLowerCase();
    if (names.has(key)) throw corrupt(`entrada repetida ${name.slice(0, 60)}`);
    names.add(key);
    if (flags & 1) throw corrupt(`entrada cifrada ${name.slice(0, 60)}`);

    // Cabecera local: misma firma, mismo nombre y mismo método; sus datos terminan antes del directorio.
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== SIG_LOCAL) throw corrupt(`cabecera local de ${name.slice(0, 60)}`);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLen);
    if (view.getUint16(localOffset + 8, true) !== method || !sameBytes(localName, rawName)) {
      throw corrupt(`la cabecera local de ${name.slice(0, 60)} no calza con el directorio central`);
    }
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
    if (dataOffset + compressedSize > cdOffset) throw corrupt(`datos de ${name.slice(0, 60)} fuera de rango`);
    entries.push({ name, method, compressedSize, uncompressedSize, dataOffset });
  }
  return entries;
}

/** Mitad alta de la página de códigos 437 (0x80–0xFF); la baja es ASCII. */
const CP437_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';

/** Decodifica un nombre en CP437. */
export function decodeCp437(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i] < 128 ? String.fromCharCode(bytes[i]) : CP437_HIGH[bytes[i] - 128];
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
