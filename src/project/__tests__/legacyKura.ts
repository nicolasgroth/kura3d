/**
 * @file src/project/__tests__/legacyKura.ts
 * @description Utilidad de pruebas: reescribe un `.kura` actual como lo habría guardado una versión
 * anterior del formato (v1/v2: `isHole` en vez de `role`), con su CRC recalculado, para probar la
 * migración sin depender del escritor actual.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type StoredObject = Record<string, unknown>;
type Manifest = { current: { objects: StoredObject[] }; past: { objects: StoredObject[] }[]; future: { objects: StoredObject[] }[] };

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ~crc >>> 0;
}

/** Reescribe el manifiesto (`edit`) y la versión de la cabecera, recalculando longitud y CRC. */
export function repackKura(bytes: Uint8Array, version: number, edit: (manifest: Manifest) => void = () => {}): Uint8Array {
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + length))) as Manifest;
  const payload = bytes.slice(16 + length);
  edit(manifest);
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const out = new Uint8Array(16 + json.length + payload.length);
  out.set(bytes.subarray(0, 16));
  out.set(json, 16);
  out.set(payload, 16 + json.length);
  const header = new DataView(out.buffer);
  header.setUint32(4, version, true);
  header.setUint32(8, json.length, true);
  header.setUint32(12, crc32(out.subarray(16)), true);
  return out;
}

/** Como lo guardaba la versión `version` (< 3): cada objeto con `isHole` y sin `role`. */
export function toLegacyKura(bytes: Uint8Array, version: 1 | 2): Uint8Array {
  const legacy = (o: StoredObject) => {
    const { role, referenceOpacity: _drop, ...rest } = o;
    return { ...rest, isHole: role === 'negative' };
  };
  return repackKura(bytes, version, (m) => {
    m.current.objects = m.current.objects.map(legacy);
    for (const s of [...m.past, ...m.future]) s.objects = s.objects.map(legacy);
  });
}
