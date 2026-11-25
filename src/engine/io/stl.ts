/**
 * @file src/engine/io/stl.ts
 * @description Lectura y escritura STL. Lector binario/ASCII con detección robusta (bytes extra al
 * final, cabeceras binarias que empiezan con "solid"), validación de NaN y truncado, y soldado de
 * vértices. Escritor binario IEEE-754 con conversión Y-up (Kurra3D Studio) a Z-up (laminadores).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8 } from 'fflate';
import type { MeshData, SceneObject } from '../../types/kura';
import { applyTransformToMesh } from '../primitives';
import { MAX_PART_NAME, ModelImportError, checkInputSize, resolveLimits, type ModelImportLimits } from './importErrors';
import type { ImportedModel } from './importTypes';
import { GrowableFloat32, finishMesh } from './meshBuffers';
import { weldTriangleSoup } from './soupWeld';
import { isPrintable } from '../../core/scene/objectRole';

const PRINTABLE_SAMPLE = 512;

/** true si el inicio del buffer parece texto STL ASCII ("solid" + caracteres imprimibles). */
function looksLikeAsciiStl(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  const head = String.fromCharCode(...bytes.subarray(i, i + 5)).toLowerCase();
  if (head !== 'solid') return false;
  const end = Math.min(bytes.length, PRINTABLE_SAMPLE);
  for (let k = 0; k < end; k++) {
    const b = bytes[k];
    if (b === 0 || (b < 0x09) || (b > 0x0d && b < 0x20)) return false;
  }
  return true;
}

/** Lee triángulos STL binarios en coordenadas Y-up (sin soldar). */
function readBinary(view: DataView, triCount: number): Float32Array {
  const raw = new Float32Array(triCount * 9);
  let offset = 84;
  let w = 0;
  for (let t = 0; t < triCount; t++) {
    offset += 12; // normal
    for (let c = 0; c < 3; c++) {
      const sx = view.getFloat32(offset, true);
      const sy = view.getFloat32(offset + 4, true);
      const sz = view.getFloat32(offset + 8, true);
      offset += 12;
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) {
        throw new ModelImportError('non-finite', `triángulo ${t + 1}`);
      }
      // Conversión Z-up -> Y-up: (x, y, z) -> (x, z, -y)
      raw[w++] = sx;
      raw[w++] = sz;
      raw[w++] = -sy;
    }
    offset += 2; // attribute byte count
  }
  return raw;
}

/** Lee vértices STL ASCII en coordenadas Y-up (sin soldar). */
function readAscii(bytes: Uint8Array, limits: ModelImportLimits): Float32Array {
  const text = new TextDecoder('utf-8').decode(bytes);
  const out = new GrowableFloat32(4096);
  const vertexRegex = /\bvertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = vertexRegex.exec(text)) !== null) {
    const sx = Number(m[1]);
    const sy = Number(m[2]);
    const sz = Number(m[3]);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) {
      throw new ModelImportError('non-finite', `vértice ${count + 1}`);
    }
    out.push3(sx, sz, -sy);
    count++;
    if (count / 3 > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
  }
  if (count % 3 !== 0) throw new ModelImportError('truncated', `${count} vértices`);
  return out.toArray();
}

/**
 * Lee un STL (binario o ASCII) y devuelve una pieza soldada en coordenadas de escena
 * (mm, Y-up) sin recentrar.
 */
export function readSTL(
  buffer: ArrayBuffer,
  fileName = 'model.stl',
  limitsInput?: Partial<ModelImportLimits>,
): ImportedModel {
  const limits = resolveLimits(limitsInput);
  checkInputSize(buffer.byteLength, limits);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const declared = buffer.byteLength >= 84 ? view.getUint32(80, true) : -1;
  const expected = declared >= 0 ? 84 + declared * 50 : Infinity;
  const ascii = looksLikeAsciiStl(bytes);

  let raw: Float32Array;
  if (declared > 0 && expected === buffer.byteLength && !ascii) {
    if (declared > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
    raw = readBinary(view, declared);
  } else if (ascii) {
    raw = readAscii(bytes, limits);
  } else if (declared > 0 && expected <= buffer.byteLength) {
    // Binario con bytes extra al final (algunos exportadores rellenan): se ignoran.
    if (declared > limits.maxTriangles) throw new ModelImportError('too-many-triangles');
    raw = readBinary(view, declared);
  } else if (declared > 0) {
    throw new ModelImportError('truncated', `${declared} triángulos declarados`);
  } else {
    throw new ModelImportError('no-geometry');
  }

  if (raw.length === 0) throw new ModelImportError('no-geometry');
  // Soldadura en sitio (consume `raw`): sin índices secuenciales ni copia cuantizada (ver soupWeld).
  const welded = weldTriangleSoup(raw, 1e-5);
  if (welded.indices.length === 0) throw new ModelImportError('no-geometry');
  const finished = finishMesh(welded.positions, welded.indices);
  return {
    fileName,
    format: 'stl',
    hasPlacement: false,
    parts: [{
      name: fileName.replace(/\.stl$/i, '').slice(0, MAX_PART_NAME),
      mesh: finished.mesh,
      group: 0,
      openEdges: finished.openEdges,
    }],
  };
}

// ============================================================================
// Exportación STL binario
// ============================================================================

/** Escribe triángulos (Y-up) en un DataView STL a partir de `offset`; devuelve el nuevo offset. */
function writeTriangles(view: DataView, offset: number, mesh: MeshData): number {
  const p = mesh.positions;
  const idx = mesh.indices;
  const triCount = Math.floor(idx.length / 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = idx[t * 3] * 3;
    const i1 = idx[t * 3 + 1] * 3;
    const i2 = idx[t * 3 + 2] * 3;
    // Conversión Y-up -> Z-up: (x, y, z) -> (x, -z, y)
    const ax = p[i0], ay = -p[i0 + 2], az = p[i0 + 1];
    const bx = p[i1], by = -p[i1 + 2], bz = p[i1 + 1];
    const cx = p[i2], cy = -p[i2 + 2], cz = p[i2 + 1];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len; ny /= len; nz /= len;
    } else {
      nx = 0; ny = 0; nz = 1;
    }
    // Escritura directa en el único buffer de salida (sin arreglos temporales por triángulo).
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }
  return offset;
}

/** Cabecera por omisión: neutra. La marca la pone quien exporta (`stlBrandHeader(BRAND)`). */
const DEFAULT_STL_HEADER = 'Binary STL';

/** Cabecera de autoría para un STL a partir de la marca que entrega quien llama. */
export function stlBrandHeader(brand: { name: string; author: string }): string {
  return `${brand.name} by ${brand.author}`;
}

function allocateStl(triCount: number, headerText: string): { bytes: Uint8Array; view: DataView } {
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // La cabecera no debe comenzar con "solid" para no confundirse con STL ASCII.
  const safeHeader = headerText.trimStart().toLowerCase().startsWith('solid') ? `STL ${headerText.trimStart()}` : headerText;
  bytes.set(strToU8(safeHeader).subarray(0, 80), 0);
  view.setUint32(80, triCount, true);
  return { bytes, view };
}

/**
 * Exporta una malla `MeshData` (Y-up en mm) a STL binario IEEE-754 (Z-up).
 */
export function exportMeshToBinarySTL(mesh: MeshData, headerText = DEFAULT_STL_HEADER): Uint8Array {
  const triCount = Math.floor(mesh.indices.length / 3);
  const { bytes, view } = allocateStl(triCount, headerText);
  writeTriangles(view, 84, mesh);
  return bytes;
}

/** Objetos exportables: sólidos visibles (negativos y referencias nunca se imprimen ni exportan). */
export function exportableObjects(objects: readonly SceneObject[]): SceneObject[] {
  return objects.filter(isPrintable);
}

/**
 * Fusiona los objetos visibles y sólidos con sus transformaciones mundiales en un STL binario.
 */
export function exportSceneToBinarySTL(objects: SceneObject[], headerText = DEFAULT_STL_HEADER): Uint8Array {
  const worlds = exportableObjects(objects).map((obj) =>
    applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale),
  );
  const triCount = worlds.reduce((acc, mesh) => acc + Math.floor(mesh.indices.length / 3), 0);
  const { bytes, view } = allocateStl(triCount, headerText);
  let offset = 84;
  for (const mesh of worlds) offset = writeTriangles(view, offset, mesh);
  return bytes;
}
