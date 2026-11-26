/**
 * @file src/engine/proceduralTexture.ts
 * @description Texturas procedurales (fuzzy, knurling, waves, honeycomb, grid): subdivisión
 * uniforme sin grietas y desplazamiento de vértices por su normal suave.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, TextureOptions, TexturePatternType } from '../types/kura';
import { computeVertexNormals } from './manifoldKernel';
import { normalizeMeshToBed } from './primitives';
/**
 * Subdivide uniformemente cada triángulo en 4 sub-triángulos compartiendo los
 * vértices medios de cada arista, garantizando 0 grietas y preservación watertight.
 */
function subdivideMeshUniform(mesh: MeshData): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  const vertPositions = Array.from(mesh.positions);
  const edgeMidpoints = new Map<string, number>();
  const newIndices: number[] = [];
  const newFaceColors: string[] | undefined = mesh.faceColors
    ? new Array<string>(triCount * 4)
    : undefined;

  const getMidpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const existing = edgeMidpoints.get(key);
    if (existing !== undefined) return existing;

    const midIdx = vertPositions.length / 3;
    vertPositions.push(
      (vertPositions[a * 3] + vertPositions[b * 3]) * 0.5,
      (vertPositions[a * 3 + 1] + vertPositions[b * 3 + 1]) * 0.5,
      (vertPositions[a * 3 + 2] + vertPositions[b * 3 + 2]) * 0.5
    );
    edgeMidpoints.set(key, midIdx);
    return midIdx;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const m01 = getMidpoint(i0, i1);
    const m12 = getMidpoint(i1, i2);
    const m20 = getMidpoint(i2, i0);

    newIndices.push(i0, m01, m20);
    newIndices.push(m01, i1, m12);
    newIndices.push(m20, m12, i2);
    newIndices.push(m01, m12, m20);

    if (newFaceColors && mesh.faceColors) {
      const col = mesh.faceColors[t];
      const base = t * 4;
      newFaceColors[base] = col;
      newFaceColors[base + 1] = col;
      newFaceColors[base + 2] = col;
      newFaceColors[base + 3] = col;
    }
  }

  return {
    positions: new Float32Array(vertPositions),
    indices: new Uint32Array(newIndices),
    ...(newFaceColors ? { faceColors: newFaceColors } : {}),
  };
}

/**
 * Calcula la longitud máxima promedio de aristas de la malla para decidir si
 * requiere subdivisión antes de desplazar vértices.
 */
function getMaxEdgeLength(mesh: MeshData): number {
  const triCount = Math.floor(mesh.indices.length / 3);
  let maxLenSq = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] * 3;
    const i1 = mesh.indices[t * 3 + 1] * 3;
    const i2 = mesh.indices[t * 3 + 2] * 3;

    const pairs: [number, number][] = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ];
    for (const [a, b] of pairs) {
      const dx = mesh.positions[b] - mesh.positions[a];
      const dy = mesh.positions[b + 1] - mesh.positions[a + 1];
      const dz = mesh.positions[b + 2] - mesh.positions[a + 2];
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq > maxLenSq) maxLenSq = dSq;
    }
  }
  return Math.sqrt(maxLenSq);
}

/** Hash espacial determinista en [0, 1] para ruido "fuzzy skin". */
function spatialHash3D(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruido trilineal suave determinista basado en hash espacial. */
function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const n000 = spatialHash3D(ix, iy, iz);
  const n100 = spatialHash3D(ix + 1, iy, iz);
  const n010 = spatialHash3D(ix, iy + 1, iz);
  const n110 = spatialHash3D(ix + 1, iy + 1, iz);
  const n001 = spatialHash3D(ix, iy, iz + 1);
  const n101 = spatialHash3D(ix + 1, iy, iz + 1);
  const n011 = spatialHash3D(ix, iy + 1, iz + 1);
  const n111 = spatialHash3D(ix + 1, iy + 1, iz + 1);

  return lerp(
    lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
    lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
    w
  );
}

/**
 * Evalúa el factor de desplazamiento normalizado [-0.5 .. 1.0] de cada patrón
 * procedural en función de la posición 3D y escala en milímetros.
 */
function sampleTexturePattern(
  pattern: Exclude<TexturePatternType, 'none'>,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  scale: number
): number {
  const s = Math.max(0.5, scale);

  // Coordenadas triplanares según normal dominante para evitar distorsión en caras laterales
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  let u = x;
  let v = z;
  if (ax >= ay && ax >= az) {
    u = z;
    v = y;
  } else if (az >= ax && az >= ay) {
    u = x;
    v = y;
  }

  switch (pattern) {
    case 'fuzzy':
      return valueNoise3D((x / s) * 3.0, (y / s) * 3.0, (z / s) * 3.0) * 2 - 1;

    case 'knurling': {
      const k1 = Math.sin(((u + v) / s) * Math.PI * 2);
      const k2 = Math.sin(((u - v) / s) * Math.PI * 2);
      return Math.abs(k1) * Math.abs(k2) * 2 - 0.5;
    }

    case 'waves':
      return Math.sin(((u * 0.75 + v * 1.1) / s) * Math.PI * 2);

    case 'honeycomb': {
      const px = u / s;
      const py = v / s;
      const r3 = Math.sqrt(3);
      const hx = px;
      const hy = py * (2 / r3);
      const gx = hx - Math.round(hx);
      const gy = hy - Math.round(hy);
      const hexDist = Math.max(Math.abs(gx), Math.abs(gx * 0.5 + gy * 0.866));
      return hexDist > 0.36 ? 0.8 : -0.4;
    }

    case 'grid': {
      const gx = Math.abs((u / s) - Math.round(u / s));
      const gy = Math.abs((v / s) - Math.round(v / s));
      return gx < 0.14 || gy < 0.14 ? 1.0 : -0.25;
    }
  }
}

/**
 * Aplica un relieve procedural determinista (`fuzzy`, `knurling`, `waves`, `honeycomb`, `grid`)
 * subdividiendo primero las aristas grandes dentro de un presupuesto seguro de triángulos
 * y desplazando los vértices a lo largo de su normal suave.
 *
 * @param mesh Malla de entrada watertight.
 * @param options Patrón, profundidad en mm y escala en mm.
 * @returns Malla con relieve aplicado y base apoyada en Y=0.
 */
export function applyProceduralTexture(
  mesh: MeshData,
  options: TextureOptions
): MeshData {
  if (
    options.pattern === 'none' ||
    Math.abs(options.depth) < 1e-6 ||
    mesh.indices.length === 0
  ) {
    return {
      positions: new Float32Array(mesh.positions),
      indices: new Uint32Array(mesh.indices),
      ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
      ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
    };
  }

  let working: MeshData = {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };

  // Subdividimos uniformemente hasta alcanzar resolución adecuada al patrón (límite 48k tris)
  const targetEdge = Math.max(0.6, options.scale * 0.45);
  const maxTriangles = 48000;
  let pass = 0;
  while (
    pass < 4 &&
    working.indices.length / 3 <= maxTriangles / 4 &&
    getMaxEdgeLength(working) > targetEdge
  ) {
    working = subdivideMeshUniform(working);
    pass++;
  }

  const normals = computeVertexNormals(working.positions, working.indices);
  const vertCount = Math.floor(working.positions.length / 3);
  const displaced = new Float32Array(working.positions.length);

  for (let v = 0; v < vertCount; v++) {
    const x = working.positions[v * 3];
    const y = working.positions[v * 3 + 1];
    const z = working.positions[v * 3 + 2];
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];

    const factor = sampleTexturePattern(
      options.pattern,
      x,
      y,
      z,
      nx,
      ny,
      nz,
      options.scale
    );
    const disp = factor * options.depth;

    displaced[v * 3] = x + nx * disp;
    displaced[v * 3 + 1] = y + ny * disp;
    displaced[v * 3 + 2] = z + nz * disp;
  }

  const finalNormals = computeVertexNormals(displaced, working.indices);
  return normalizeMeshToBed({
    positions: displaced,
    indices: working.indices,
    normals: finalNormals,
    ...(working.faceColors ? { faceColors: working.faceColors } : {}),
  });
}
