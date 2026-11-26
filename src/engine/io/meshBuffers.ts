/**
 * @file src/engine/io/meshBuffers.ts
 * @description Utilidades compartidas por los lectores y escritores de formatos: arreglos tipados
 * crecientes, validación de índices y coordenadas, cierre de malla (aristas abiertas), normalización
 * sobre la cama y colores hex.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';
import { computeVertexNormals } from '../manifoldKernel';
import { MODEL_IO_LIMITS } from '../operationLimits';
import { ModelImportError } from './importErrors';
import { countBoundaryEdges, countEdgesByUse } from '../repair/boundaryEdges';

/** Arreglo Float32 que crece por duplicación (evita `number[]` en mallas grandes). */
export class GrowableFloat32 {
  private data: Float32Array;
  length = 0;
  constructor(initial = 1024) {
    this.data = new Float32Array(Math.max(16, initial));
  }
  private reserve(extra: number) {
    if (this.length + extra <= this.data.length) return;
    let next = this.data.length * 2;
    while (next < this.length + extra) next *= 2;
    const grown = new Float32Array(next);
    grown.set(this.data.subarray(0, this.length));
    this.data = grown;
  }
  push3(a: number, b: number, c: number) {
    this.reserve(3);
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
  toArray(): Float32Array {
    return this.data.slice(0, this.length);
  }
}

/** Arreglo Uint32 que crece por duplicación. */
export class GrowableUint32 {
  private data: Uint32Array;
  length = 0;
  constructor(initial = 1024) {
    this.data = new Uint32Array(Math.max(16, initial));
  }
  private reserve(extra: number) {
    if (this.length + extra <= this.data.length) return;
    let next = this.data.length * 2;
    while (next < this.length + extra) next *= 2;
    const grown = new Uint32Array(next);
    grown.set(this.data.subarray(0, this.length));
    this.data = grown;
  }
  push3(a: number, b: number, c: number) {
    this.reserve(3);
    this.data[this.length++] = a;
    this.data[this.length++] = b;
    this.data[this.length++] = c;
  }
  toArray(): Uint32Array {
    return this.data.slice(0, this.length);
  }
}

/** Normaliza un color hex '#rrggbb', '#rrggbbaa' o '#rgb' a '#rrggbb' en minúsculas. */
export function normalizeHexColor(raw: string | undefined, fallback = '#38bdf8'): string {
  if (!raw) return fallback;
  const clean = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-f]{8}$/.test(clean)) return clean.slice(0, 7);
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return fallback;
}

/** Convierte '#rrggbb' en componentes lineales 0..1 sin corrección gamma. */
export function hexToRgb01(hex: string): [number, number, number] {
  const clean = normalizeHexColor(hex);
  return [
    parseInt(clean.slice(1, 3), 16) / 255,
    parseInt(clean.slice(3, 5), 16) / 255,
    parseInt(clean.slice(5, 7), 16) / 255,
  ];
}

/** Convierte componentes 0..1 (o 0..255 si `bytes`) a '#rrggbb'. */
export function rgbToHex(r: number, g: number, b: number, bytes = false): string {
  const to = (v: number) => {
    const n = Math.round(Math.min(1, Math.max(0, bytes ? v / 255 : v)) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Comprueba que todas las coordenadas sean finitas y estén dentro de ±`maxAbs` mm (un vértice en 1e30
 * es un vértice suelto o una escala errada: rompería el análisis y la colocación sin avisar).
 */
export function assertFinite(positions: Float32Array, maxAbs: number = MODEL_IO_LIMITS.maxAbsCoordinateMm): void {
  for (let i = 0; i < positions.length; i++) {
    const v = positions[i];
    if (v > maxAbs || v < -maxAbs) {
      throw new ModelImportError('out-of-range', `vértice ${Math.floor(i / 3) + 1}: ${v.toExponential(2)} mm`);
    }
    if (!Number.isFinite(v)) throw new ModelImportError('non-finite');
  }
}

/** Comprueba que cada índice de triángulo apunte a un vértice existente. */
export function assertIndices(indices: Uint32Array, vertexCount: number): void {
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= vertexCount) {
      throw new ModelImportError('invalid-index', `${indices[i]} ≥ ${vertexCount}`);
    }
  }
}

/** Límite de triángulos sobre el que se omite el conteo de aristas abiertas (memoria). */
const OPEN_EDGE_SCAN_LIMIT = 4_000_000;

/**
 * Cuenta aristas que no son compartidas por exactamente dos triángulos (bordes abiertos o
 * no-manifold), sobre los índices tal cual. Devuelve -1 si la malla es demasiado grande.
 */
export function countOpenEdges(indices: Uint32Array, vertexCount: number): number {
  if (Math.floor(indices.length / 3) > OPEN_EDGE_SCAN_LIMIT) return -1;
  return countEdgesByUse(indices, vertexCount, { boundaryOnly: false });
}

/** Malla importada con su diagnóstico de cierre. */
export interface FinishedMesh {
  mesh: MeshData;
  openEdges: number;
}

/**
 * Valida, calcula normales y diagnostica una malla en coordenadas de escena (mm, Y-up).
 * Las caras con color se conservan solo si hay más de un color distinto del base.
 */
export function finishMesh(
  positions: Float32Array,
  indices: Uint32Array,
  faceColors?: string[],
  baseColor?: string,
): FinishedMesh {
  const vertexCount = Math.floor(positions.length / 3);
  if (indices.length < 3 || vertexCount < 3) throw new ModelImportError('no-geometry');
  assertFinite(positions);
  assertIndices(indices, vertexCount);
  const normals = computeVertexNormals(positions, indices);
  const keepColors =
    faceColors && faceColors.length === indices.length / 3 &&
    faceColors.some((color) => color !== (baseColor ?? faceColors[0]));
  return {
    mesh: { positions, indices, normals, ...(keepColors ? { faceColors } : {}) },
    // Misma definición que el inspector (`diagnoseMesh`): aristas de un solo triángulo tras soldar.
    openEdges: Math.floor(indices.length / 3) > OPEN_EDGE_SCAN_LIMIT ? -1 : countBoundaryEdges(positions, indices),
  };
}

/** Caja envolvente [minX, minY, minZ, maxX, maxY, maxZ] de un arreglo de posiciones. */
export function boundsOf(positions: Float32Array): [number, number, number, number, number, number] {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minY, minZ, maxX, maxY, maxZ];
}

/** Traslada una malla (copia de posiciones; índices, normales y colores se comparten). */
export function translateMesh(mesh: MeshData, dx: number, dy: number, dz: number): MeshData {
  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = mesh.positions[i] + dx;
    positions[i + 1] = mesh.positions[i + 1] + dy;
    positions[i + 2] = mesh.positions[i + 2] + dz;
  }
  return { ...mesh, positions };
}

/** Centra la malla en X/Z y la apoya en Y=0 (pivote local de un objeto de escena). */
export function centerMeshOnBed(mesh: MeshData): { mesh: MeshData; offset: [number, number, number] } {
  const [minX, minY, minZ, maxX, , maxZ] = boundsOf(mesh.positions);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return { mesh: translateMesh(mesh, -cx, -minY, -cz), offset: [cx, minY, cz] };
}
