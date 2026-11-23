/**
 * @file src/engine/__tests__/zipFixtures.ts
 * @description Constructor de ZIP a mano para las pruebas del lector acotado: entradas deflate
 * "stored" (los bytes quedan literales dentro del flujo), descriptor de datos (bit 3, como Bambu
 * Studio y OrcaSlicer), zip64 y defectos a pedido (cabecera local que no calza, sin directorio central).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Deflate "stored" (sin compresión): los bytes originales quedan literales dentro del flujo. */
export function deflateStored(data: Uint8Array): Uint8Array {
  const MAX = 0xffff;
  const blocks = Math.max(1, Math.ceil(data.length / MAX));
  const out = new Uint8Array(data.length + blocks * 5);
  let w = 0;
  for (let b = 0; b < blocks; b++) {
    const chunk = data.subarray(b * MAX, Math.min(data.length, (b + 1) * MAX));
    out[w++] = b === blocks - 1 ? 1 : 0;
    out[w++] = chunk.length & 255;
    out[w++] = chunk.length >> 8;
    out[w++] = ~chunk.length & 255;
    out[w++] = (~chunk.length >> 8) & 255;
    out.set(chunk, w);
    w += chunk.length;
  }
  return out;
}

export interface FixtureEntry {
  name: string;
  data: Uint8Array;
  /** Tamaño descomprimido que declara el directorio central (por defecto, el real). */
  declaredSize?: number;
  /** Nombre que lleva la cabecera local (por defecto, el mismo). */
  localName?: string;
  /** Flujo deflate ya comprimido (por defecto, `deflateStored(data)`). */
  compressed?: Uint8Array;
}

export interface FixtureOptions {
  /** Escribe tamaños y CRC en el descriptor tras los datos (bit 3). */
  descriptor?: boolean;
  /** Usa registros zip64 (tamaños y offset en el campo extra 0x0001). */
  zip64?: boolean;
  /** Omite el directorio central y el registro final. */
  noCentral?: boolean;
}

const u16 = (n: number) => [n & 255, (n >> 8) & 255];
const u32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const u64 = (n: number) => [...u32(n >>> 0), ...u32(Math.floor(n / 4294967296))];

/** ZIP con entradas deflate stored. */
export function buildZip(entries: FixtureEntry[], options: FixtureOptions = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;
  const flag = options.descriptor ? 0x0808 : 0x0800;
  for (const entry of entries) {
    const enc = new TextEncoder().encode(entry.name);
    const localEnc = new TextEncoder().encode(entry.localName ?? entry.name);
    const comp = entry.compressed ?? deflateStored(entry.data);
    const crc = crc32(entry.data);
    const size = entry.declaredSize ?? entry.data.length;
    const inLocal = options.descriptor ? [0, 0, 0] : [crc, comp.length, entry.data.length];
    const local = [...u32(0x04034b50), ...u16(45), ...u16(flag), ...u16(8), ...u16(0), ...u16(0x21),
      ...u32(inLocal[0]), ...u32(inLocal[1]), ...u32(inLocal[2]), ...u16(localEnc.length), ...u16(0), ...localEnc];
    const desc = options.descriptor ? [...u32(0x08074b50), ...u32(crc), ...u32(comp.length), ...u32(entry.data.length)] : [];
    parts.push(Uint8Array.from(local), comp, Uint8Array.from(desc));
    const extra = options.zip64 ? [...u16(1), ...u16(24), ...u64(size), ...u64(comp.length), ...u64(offset)] : [];
    const big = options.zip64 ? 0xffffffff : -1;
    central.push(...u32(0x02014b50), ...u16(45), ...u16(45), ...u16(flag), ...u16(8), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(big >= 0 ? big : comp.length), ...u32(big >= 0 ? big : size), ...u16(enc.length), ...u16(extra.length),
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(big >= 0 ? big : offset), ...enc, ...extra);
    offset += local.length + comp.length + desc.length;
  }
  if (!options.noCentral) {
    const cdOffset = offset;
    parts.push(Uint8Array.from(central));
    if (options.zip64) {
      const z64Offset = cdOffset + central.length;
      parts.push(Uint8Array.from([...u32(0x06064b50), ...u64(44), ...u16(45), ...u16(45), ...u32(0), ...u32(0),
        ...u64(entries.length), ...u64(entries.length), ...u64(central.length), ...u64(cdOffset)]));
      parts.push(Uint8Array.from([...u32(0x07064b50), ...u32(0), ...u64(z64Offset), ...u32(1)]));
      parts.push(Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(0xffff), ...u16(0xffff), ...u32(0xffffffff), ...u32(0xffffffff), ...u16(0)]));
    } else {
      parts.push(Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
        ...u32(central.length), ...u32(cdOffset), ...u16(0)]));
    }
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let w = 0;
  for (const p of parts) {
    out.set(p, w);
    w += p.length;
  }
  return out;
}

/** ZIP de una entrada deflate con descriptor de datos (bit 3). */
export function zipWithDataDescriptor(name: string, payload: Uint8Array): Uint8Array {
  return buildZip([{ name, data: payload }], { descriptor: true });
}
