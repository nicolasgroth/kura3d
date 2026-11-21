/**
 * @file src/engine/__tests__/ioFixtures.ts
 * @description Generadores de archivos sintéticos para las pruebas de importación: cubos cerrados
 * en STL binario/ASCII y paquetes 3MF con componentes anidados, instancias, transformaciones,
 * extensión de producción (`p:path`) y configuración tipo Bambu Studio / OrcaSlicer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';

/** Vértices y triángulos (orientados hacia afuera) de un cubo [x0..x0+s]³ en Z-up. */
export function cubeGeometry(s = 10, [ox, oy, oz] = [0, 0, 0]) {
  const v: Array<[number, number, number]> = [
    [0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0],
    [0, 0, s], [s, 0, s], [s, s, s], [0, s, s],
  ].map(([x, y, z]) => [x + ox, y + oy, z + oz]);
  const t: Array<[number, number, number]> = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  return { v, t };
}

/** Bloque `<mesh>` 3MF de un cubo; `triAttrs` agrega atributos por triángulo. */
export function cubeMeshXml(s = 10, offset: [number, number, number] = [0, 0, 0], triAttrs = (_i: number) => '') {
  const { v, t } = cubeGeometry(s, offset);
  return (
    '<mesh><vertices>' +
    v.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('') +
    '</vertices><triangles>' +
    t.map(([a, b, c], i) => `<triangle v1="${a}" v2="${b}" v3="${c}"${triAttrs(i)}/>`).join('') +
    '</triangles></mesh>'
  );
}

/** Traslación 3MF (matriz identidad + desplazamiento). */
export const translate = (x: number, y: number, z: number) => `1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;

const NS = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"';

/** Envuelve recursos y build en un documento `<model>`. */
export function modelXml(resources: string, build = '', unit = 'millimeter') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="${unit}" ${NS}><resources>${resources}</resources><build>${build}</build></model>`;
}

const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

/** Empaqueta archivos (texto o bytes) como 3MF, agregando `_rels/.rels` si falta. */
export function pack3mf(files: Record<string, string | Uint8Array>): ArrayBuffer {
  const entries: Record<string, Uint8Array> = { '_rels/.rels': strToU8(RELS) };
  for (const [name, content] of Object.entries(files)) {
    entries[name] = typeof content === 'string' ? strToU8(content) : content;
  }
  const zipped = zipSync(entries);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

/** STL binario de un cubo (Z-up) con cabecera y bytes extra opcionales. */
export function cubeStlBinary(s = 10, offset: [number, number, number] = [0, 0, 0], header = 'kura test', extraBytes = 0): ArrayBuffer {
  const { v, t } = cubeGeometry(s, offset);
  const buffer = new ArrayBuffer(84 + t.length * 50 + extraBytes);
  const bytes = new Uint8Array(buffer);
  bytes.set(strToU8(header).subarray(0, 80), 0);
  const view = new DataView(buffer);
  view.setUint32(80, t.length, true);
  let o = 84;
  for (const tri of t) {
    o += 12;
    for (const idx of tri) {
      view.setFloat32(o, v[idx][0], true);
      view.setFloat32(o + 4, v[idx][1], true);
      view.setFloat32(o + 8, v[idx][2], true);
      o += 12;
    }
    o += 2;
  }
  return buffer;
}

/** STL ASCII de un cubo (Z-up). */
export function cubeStlAscii(s = 10, offset: [number, number, number] = [0, 0, 0]): string {
  const { v, t } = cubeGeometry(s, offset);
  const facets = t.map((tri) =>
    `facet normal 0 0 0\nouter loop\n${tri.map((i) => `vertex ${v[i].join(' ')}`).join('\n')}\nendloop\nendfacet`,
  );
  return `solid cube\n${facets.join('\n')}\nendsolid cube\n`;
}

/** Convierte un ArrayBuffer cualquiera a uno propio (evita compartir buffers entre pruebas). */
export const toBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
