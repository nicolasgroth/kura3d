/**
 * @file src/engine/io/ply.ts
 * @description Lectura y escritura PLY (Stanford). Lector ASCII y binario (little/big endian) con
 * colores por vértice o por cara; escritor binario little endian con color por cara y también por
 * vértice para lectores que solo leen ese (los vértices compartidos por caras de distinto color se
 * duplican). PLY se trata como Z-up, igual que STL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import { weldVertices } from '../manifoldKernel';
import { applyTransformToMesh } from '../primitives';
import { MAX_PART_NAME, ModelImportError, checkInputSize, resolveLimits, type ModelImportLimits } from './importErrors';
import type { ImportedModel } from './importTypes';
import { GrowableUint32, finishMesh, hexToRgb01, normalizeHexColor, rgbToHex } from './meshBuffers';
import { exportableObjects } from './stl';
import { brandSignature, type ExportBrand } from './exportBrand';

type ScalarType = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64';

const TYPE_ALIASES: Record<string, ScalarType> = {
  char: 'int8', int8: 'int8', uchar: 'uint8', uint8: 'uint8',
  short: 'int16', int16: 'int16', ushort: 'uint16', uint16: 'uint16',
  int: 'int32', int32: 'int32', uint: 'uint32', uint32: 'uint32',
  float: 'float32', float32: 'float32', double: 'float64', float64: 'float64',
};
const TYPE_SIZE: Record<ScalarType, number> = {
  int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4, float32: 4, float64: 8,
};

interface PlyProperty {
  name: string;
  type: ScalarType;
  /** Tipo del contador si es una lista. */
  countType?: ScalarType;
}
interface PlyElement {
  name: string;
  count: number;
  properties: PlyProperty[];
}

function parseHeader(bytes: Uint8Array): { format: string; elements: PlyElement[]; bodyStart: number } {
  const probe = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
  const endMatch = /end_header\r?\n/.exec(probe);
  if (!probe.startsWith('ply') || !endMatch) throw new ModelImportError('corrupt', 'cabecera PLY');
  const lines = probe.slice(0, endMatch.index).split(/\r?\n/);
  let format = '';
  const elements: PlyElement[] = [];
  for (const raw of lines) {
    const parts = raw.trim().split(/\s+/);
    if (parts[0] === 'format') format = parts[1];
    else if (parts[0] === 'element') {
      const count = Number(parts[2]);
      if (!Number.isSafeInteger(count) || count < 0) throw new ModelImportError('corrupt', 'element');
      elements.push({ name: parts[1], count, properties: [] });
    } else if (parts[0] === 'property' && elements.length > 0) {
      const element = elements[elements.length - 1];
      if (parts[1] === 'list') {
        const countType = TYPE_ALIASES[parts[2]];
        const type = TYPE_ALIASES[parts[3]];
        if (!countType || !type) throw new ModelImportError('corrupt', 'property list');
        element.properties.push({ name: parts[4], type, countType });
      } else {
        const type = TYPE_ALIASES[parts[1]];
        if (!type) throw new ModelImportError('corrupt', `property ${parts[1]}`);
        element.properties.push({ name: parts[2], type });
      }
    }
  }
  if (!['ascii', 'binary_little_endian', 'binary_big_endian'].includes(format)) {
    throw new ModelImportError('unsupported', `PLY ${format}`);
  }
  return { format, elements, bodyStart: endMatch.index + endMatch[0].length };
}

/**
 * Valida los conteos de la cabecera antes de reservar memoria o iterar: cada elemento debe tener
 * propiedades, la suma `count × tamaño mínimo` debe caber en los bytes restantes y los vértices y
 * caras quedan acotados por `maxTriangles`.
 */
function checkDeclaredCounts(elements: PlyElement[], format: string, bodyBytes: number, limits: ModelImportLimits): void {
  let minimum = 0;
  for (const element of elements) {
    if (element.count === 0) continue;
    if (element.properties.length === 0) throw new ModelImportError('corrupt', `elemento ${element.name} sin propiedades`);
    if (element.name === 'vertex' && element.count > 3 * limits.maxTriangles) {
      throw new ModelImportError('too-many-triangles', `${element.count} vértices declarados`);
    }
    if (element.name === 'face' && element.count > limits.maxTriangles) {
      throw new ModelImportError('too-many-triangles', `${element.count} caras declaradas`);
    }
    // Binario: escalares completos y, en listas, al menos el contador. ASCII: un token y un separador.
    const perElement = format === 'ascii'
      ? element.properties.length * 2
      : element.properties.reduce((sum, p) => sum + TYPE_SIZE[p.countType ?? p.type], 0);
    minimum += element.count * perElement;
  }
  // En ASCII el último token puede no llevar separador.
  if (minimum - (format === 'ascii' ? 1 : 0) > bodyBytes) {
    throw new ModelImportError('truncated', `la cabecera declara al menos ${minimum} bytes y quedan ${bodyBytes}`);
  }
}

/** Lector secuencial de valores escalares (binario o tokens ASCII). */
interface ValueReader {
  read(type: ScalarType): number;
}

function binaryReader(view: DataView, start: number, little: boolean): ValueReader {
  let offset = start;
  return {
    read(type) {
      const size = TYPE_SIZE[type];
      if (offset + size > view.byteLength) throw new ModelImportError('truncated');
      let v: number;
      switch (type) {
        case 'int8': v = view.getInt8(offset); break;
        case 'uint8': v = view.getUint8(offset); break;
        case 'int16': v = view.getInt16(offset, little); break;
        case 'uint16': v = view.getUint16(offset, little); break;
        case 'int32': v = view.getInt32(offset, little); break;
        case 'uint32': v = view.getUint32(offset, little); break;
        case 'float32': v = view.getFloat32(offset, little); break;
        default: v = view.getFloat64(offset, little);
      }
      offset += size;
      return v;
    },
  };
}

/**
 * Tokens ASCII leídos de a uno por índice (sin arreglo intermedio): solo se recorre hasta el último
 * valor que piden los elementos declarados; lo que sobre al final no se lee.
 */
function asciiReader(text: string): ValueReader {
  let i = 0;
  const n = text.length;
  const isSpace = (c: number) => c === 32 || (c >= 9 && c <= 13);
  return {
    read() {
      while (i < n && isSpace(text.charCodeAt(i))) i++;
      if (i >= n) throw new ModelImportError('truncated');
      const start = i;
      while (i < n && !isSpace(text.charCodeAt(i))) i++;
      return Number(text.slice(start, i));
    },
  };
}

/** Lee un PLY en una pieza en coordenadas de escena (mm, Y-up) sin recentrar. */
export function readPLY(buffer: ArrayBuffer, fileName = 'model.ply', limitsInput?: Partial<ModelImportLimits>): ImportedModel {
  const limits = resolveLimits(limitsInput);
  checkInputSize(buffer.byteLength, limits);
  const bytes = new Uint8Array(buffer);
  const { format, elements, bodyStart } = parseHeader(bytes);
  checkDeclaredCounts(elements, format, bytes.length - bodyStart, limits);
  const reader = format === 'ascii'
    ? asciiReader(new TextDecoder('utf-8').decode(bytes.subarray(bodyStart)))
    : binaryReader(new DataView(buffer), bodyStart, format === 'binary_little_endian');

  let positions = new Float32Array(0);
  let vertexColors: string[] | null = null;
  const faces = new GrowableUint32(4096);
  const faceColors: string[] = [];
  let hasFaceColors = false;

  for (const element of elements) {
    if (element.name === 'vertex') {
      // x, y, z deben ser escalares antes de reservar `count * 3` floats.
      for (const axis of ['x', 'y', 'z']) {
        const prop = element.properties.find((p) => p.name === axis);
        if (!prop || prop.countType) throw new ModelImportError('corrupt', `propiedad ${axis} del vértice ausente o no escalar`);
      }
      positions = new Float32Array(element.count * 3);
      const names = element.properties.map((p) => p.name);
      const hasColor = ['red', 'green', 'blue'].every((n) => names.includes(n));
      if (hasColor) vertexColors = new Array<string>(element.count);
      for (let v = 0; v < element.count; v++) {
        const values: Record<string, number> = {};
        let colorScale = 255;
        for (const prop of element.properties) {
          if (prop.countType) {
            const n = reader.read(prop.countType);
            for (let k = 0; k < n; k++) reader.read(prop.type);
            continue;
          }
          values[prop.name] = reader.read(prop.type);
          if (prop.name === 'red' && prop.type.startsWith('float')) colorScale = 1;
        }
        const x = values.x, y = values.y, z = values.z;
        if (![x, y, z].every(Number.isFinite)) throw new ModelImportError('non-finite', `vértice ${v + 1}`);
        // Z-up -> Y-up
        positions[v * 3] = x;
        positions[v * 3 + 1] = z;
        positions[v * 3 + 2] = -y;
        if (vertexColors) vertexColors[v] = rgbToHex(values.red, values.green, values.blue, colorScale === 255);
      }
    } else if (element.name === 'face') {
      const vertexCount = positions.length / 3;
      for (let f = 0; f < element.count; f++) {
        let face: number[] = [];
        const values: Record<string, number> = {};
        for (const prop of element.properties) {
          if (prop.countType) {
            const n = reader.read(prop.countType);
            // Tope antes de abrir el abanico: una cara de N vértices da N − 2 triángulos.
            if (!Number.isInteger(n) || n < 0 || faces.length / 3 + Math.max(0, n - 2) > limits.maxTriangles) {
              throw new ModelImportError(Number.isInteger(n) && n >= 0 ? 'too-many-triangles' : 'corrupt', `cara ${f + 1}`);
            }
            const list: number[] = [];
            for (let k = 0; k < n; k++) list.push(reader.read(prop.type));
            if (prop.name === 'vertex_indices' || prop.name === 'vertex_index') face = list;
          } else {
            values[prop.name] = reader.read(prop.type);
          }
        }
        for (const idx of face) {
          if (!Number.isInteger(idx) || idx < 0 || idx >= vertexCount) {
            throw new ModelImportError('invalid-index', `cara ${f + 1}`);
          }
        }
        const color = values.red !== undefined
          ? rgbToHex(values.red, values.green, values.blue, true)
          : vertexColors?.[face[0]];
        if (values.red !== undefined || vertexColors) hasFaceColors = true;
        for (let k = 1; k + 1 < face.length; k++) {
          faces.push3(face[0], face[k], face[k + 1]);
          faceColors.push(color ?? '#38bdf8');
        }
        if (faces.length / 3 > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
      }
    } else {
      // Otros elementos (aristas, materiales): se leen para avanzar el cursor y se ignoran.
      for (let i = 0; i < element.count; i++) {
        for (const prop of element.properties) {
          if (prop.countType) {
            const n = reader.read(prop.countType);
            for (let k = 0; k < n; k++) reader.read(prop.type);
          } else reader.read(prop.type);
        }
      }
    }
  }

  if (faces.length === 0) throw new ModelImportError('no-geometry');
  const welded = weldVertices(positions, faces.toArray(), 1e-5);
  if (welded.indices.length === 0) throw new ModelImportError('no-geometry');
  const colors = hasFaceColors ? Array.from(welded.triangleSource, (src) => faceColors[src]) : undefined;
  const counts = new Map<string, number>();
  colors?.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const finished = finishMesh(welded.positions, welded.indices, colors, dominant);
  return {
    fileName,
    format: 'ply',
    hasPlacement: false,
    parts: [{ name: fileName.replace(/\.ply$/i, '').slice(0, MAX_PART_NAME), color: dominant, mesh: finished.mesh, group: 0, openEdges: finished.openEdges }],
  };
}

/**
 * Exporta los objetos visibles y sólidos a PLY binario little endian (mm, Z-up) con colores por
 * vértice: cada vértice se duplica por cada color de cara que lo usa. `brand` (desde quien llama)
 * firma el comentario de cabecera.
 */
export function exportSceneToPLY(objects: SceneObject[], brand?: ExportBrand): Uint8Array {
  const verts: number[] = [];
  const colors: number[] = [];
  const faceList: number[] = [];
  const faceRgb: number[] = [];
  for (const obj of exportableObjects(objects)) {
    const world = applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
    const base = normalizeHexColor(obj.color);
    const keyToIndex = new Map<string, number>();
    const triCount = Math.floor(world.indices.length / 3);
    for (let t = 0; t < triCount; t++) {
      const color = normalizeHexColor(world.faceColors?.[t], base);
      const [fr, fg, fb] = hexToRgb01(color);
      faceRgb.push(Math.round(fr * 255), Math.round(fg * 255), Math.round(fb * 255));
      for (let c = 0; c < 3; c++) {
        const v = world.indices[t * 3 + c];
        const key = `${v}${color}`;
        let mapped = keyToIndex.get(key);
        if (mapped === undefined) {
          mapped = verts.length / 3;
          keyToIndex.set(key, mapped);
          // Y-up -> Z-up: (x, y, z) -> (x, -z, y)
          verts.push(world.positions[v * 3], -world.positions[v * 3 + 2], world.positions[v * 3 + 1]);
          const [r, g, b] = hexToRgb01(color);
          colors.push(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
        }
        faceList.push(mapped);
      }
    }
  }
  const vertexCount = verts.length / 3;
  const faceCount = faceList.length / 3;
  // Un salto de línea en la marca rompería la cabecera PLY
  const signature = brandSignature(brand)?.replace(/[\r\n]+/g, ' ');
  const header =
    `ply\nformat binary_little_endian 1.0\ncomment ${signature ? `${signature} ` : ''}export (units: mm, Z-up)\n` +
    `element vertex ${vertexCount}\nproperty float x\nproperty float y\nproperty float z\n` +
    'property uchar red\nproperty uchar green\nproperty uchar blue\n' +
    `element face ${faceCount}\nproperty list uchar int vertex_indices\n` +
    'property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n';
  const headerBytes = new TextEncoder().encode(header);
  const out = new Uint8Array(headerBytes.length + vertexCount * 15 + faceCount * 16);
  out.set(headerBytes, 0);
  const view = new DataView(out.buffer);
  let o = headerBytes.length;
  for (let v = 0; v < vertexCount; v++) {
    view.setFloat32(o, verts[v * 3], true);
    view.setFloat32(o + 4, verts[v * 3 + 1], true);
    view.setFloat32(o + 8, verts[v * 3 + 2], true);
    out[o + 12] = colors[v * 3];
    out[o + 13] = colors[v * 3 + 1];
    out[o + 14] = colors[v * 3 + 2];
    o += 15;
  }
  for (let f = 0; f < faceCount; f++) {
    out[o] = 3;
    view.setInt32(o + 1, faceList[f * 3], true);
    view.setInt32(o + 5, faceList[f * 3 + 1], true);
    view.setInt32(o + 9, faceList[f * 3 + 2], true);
    out[o + 13] = faceRgb[f * 3];
    out[o + 14] = faceRgb[f * 3 + 1];
    out[o + 15] = faceRgb[f * 3 + 2];
    o += 16;
  }
  return out;
}
