/**
 * @file src/engine/manifoldKernel.ts
 * @description Inicialización perezosa del núcleo WASM Manifold-3D (compatible con Vite/navegador y Node/Vitest)
 * y utilidades de conversión bidireccional entre MeshData de Kurra3D Studio (Y-up en mm) y Manifold.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import Module, {
  type Manifold,
  type ManifoldToplevel,
  type Mesh as ManifoldMesh,
} from 'manifold-3d';
import type { MeshData } from '../types/kura';
import { EngineError, engineWarning, type EngineWarning } from './engineErrors';
import { closureCounts } from './repair/meshTopology';

/** Promesa singleton cacheada para evitar múltiples cargas del módulo WASM. */
let manifoldPromise: Promise<ManifoldToplevel> | null = null;

/** Referencia síncrona al módulo Manifold ya inicializado. */
let cachedModule: ManifoldToplevel | null = null;

/**
 * Inicializa y cachea el módulo WASM de `manifold-3d` de forma segura tanto en
 * navegador (Vite/Tauri) como en Node.js (Vitest/MCP).
 *
 * @returns Instancia lista de `ManifoldToplevel` con `setup()` ya ejecutado.
 */
export async function initManifoldEngine(): Promise<ManifoldToplevel> {
  if (cachedModule) {
    return cachedModule;
  }

  if (!manifoldPromise) {
    manifoldPromise = (async () => {
      // En navegador/Vite indicamos explícitamente la ubicación del binario .wasm;
      // en Node.js omitimos `locateFile` para que Emscripten resuelva el archivo local en node_modules.
      // Un Web Worker no tiene `window` pero sí `WorkerGlobalScope`: también es navegador.
      const isBrowser = typeof window !== 'undefined' || typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined';
      const wasm = isBrowser
        ? await Module({
            locateFile: () => new URL('manifold-3d/manifold.wasm', import.meta.url).href,
          })
        : await Module();

      // Obligatorio en manifold-3d v3 para enlazar métodos de instancia, prototipos y TBB.
      wasm.setup();
      cachedModule = wasm;
      return wasm;
    })().catch((err) => {
      // Limpia la promesa fallida para permitir reintentos limpios si falla la carga WASM
      manifoldPromise = null;
      throw err;
    });
  }

  return manifoldPromise;
}

/**
 * Indica si el motor WASM Manifold ya se encuentra inicializado en memoria.
 */
export function isManifoldReady(): boolean {
  return cachedModule !== null;
}

/**
 * Devuelve la instancia síncrona cacheada del módulo Manifold o lanza error si aún no se inicializó.
 */
export function getManifoldModule(): ManifoldToplevel {
  if (!cachedModule) {
    throw new EngineError('ENGINE_NOT_READY');
  }
  return cachedModule;
}

/** Finalizador de murmur3 (fmix32): mezcla no lineal de 32 bits. */
function fmix32(v: number): number {
  v ^= v >>> 16;
  v = Math.imul(v, 0x85ebca6b);
  v ^= v >>> 13;
  v = Math.imul(v, 0xc2b2ae35);
  return v ^ (v >>> 16);
}

/**
 * Suelda vértices duplicados o casi coincidentes dentro de una tolerancia dada (en mm)
 * y elimina triángulos degenerados para garantizar topología cerrada (watertight).
 *
 * @param positions Coordenadas planas [x, y, z, ...].
 * @param indices Índices de triángulos [i0, i1, i2, ...].
 * @param tolerance Tolerancia espacial de soldado en milímetros (por defecto 1e-5 mm).
 * @returns Posiciones e índices compactados y soldados.
 */
export function weldVertices(
  positions: Float32Array,
  indices: Uint32Array,
  tolerance = 1e-5
): { positions: Float32Array; indices: Uint32Array; triangleSource: Uint32Array } {
  const invTol = tolerance > 0 ? 1 / tolerance : 1e5;
  const vertCount = Math.floor(positions.length / 3);
  const vertRemap = new Uint32Array(vertCount);
  const outPositions = new Float32Array(vertCount * 3);
  // Coordenadas cuantizadas de cada vértice único, para comparar sin claves string.
  const quantized = new Float64Array(vertCount * 3);

  // Tabla hash de direccionamiento abierto (potencia de 2, carga <= 0.5) con índices + 1.
  let capacity = 16;
  while (capacity < vertCount * 2) capacity *= 2;
  const mask = capacity - 1;
  const table = new Int32Array(capacity);
  let unique = 0;

  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const qx = Math.round(x * invTol);
    const qy = Math.round(y * invTol);
    const qz = Math.round(z * invTol);

    // Hash de 32 bits de los valores cuantizados (incluso fuera del rango int32). Cada coordenada pasa por
    // el finalizador de murmur3 encadenado: con la combinación XOR de multiplicaciones (invertible) se
    // podían fabricar colisiones y volver cuadrático el sondeo lineal.
    let h = fmix32(((qx | 0) ^ Math.floor(qx / 4294967296)) ^ 0x9e3779b1);
    h = fmix32(h ^ ((qy | 0) ^ Math.floor(qy / 4294967296)));
    h = fmix32(h ^ ((qz | 0) ^ Math.floor(qz / 4294967296)));
    let slot = h & mask;

    let mapped = -1;
    while (table[slot] !== 0) {
      const candidate = table[slot] - 1;
      if (
        quantized[candidate * 3] === qx &&
        quantized[candidate * 3 + 1] === qy &&
        quantized[candidate * 3 + 2] === qz
      ) {
        mapped = candidate;
        break;
      }
      slot = (slot + 1) & mask;
    }
    if (mapped < 0) {
      mapped = unique++;
      table[slot] = mapped + 1;
      quantized[mapped * 3] = qx;
      quantized[mapped * 3 + 1] = qy;
      quantized[mapped * 3 + 2] = qz;
      outPositions[mapped * 3] = x;
      outPositions[mapped * 3 + 1] = y;
      outPositions[mapped * 3 + 2] = z;
    }
    vertRemap[i] = mapped;
  }

  const triCount = Math.floor(indices.length / 3);
  const outIndices = new Uint32Array(triCount * 3);
  const triangleSource = new Uint32Array(triCount);
  let kept = 0;
  for (let t = 0; t < triCount; t++) {
    const a = vertRemap[indices[t * 3]];
    const b = vertRemap[indices[t * 3 + 1]];
    const c = vertRemap[indices[t * 3 + 2]];
    // Descartar triángulos degenerados donde dos vértices colapsaron al mismo punto
    if (a !== b && b !== c && c !== a) {
      outIndices[kept * 3] = a;
      outIndices[kept * 3 + 1] = b;
      outIndices[kept * 3 + 2] = c;
      triangleSource[kept] = t;
      kept++;
    }
  }

  return {
    positions: outPositions.slice(0, unique * 3),
    indices: outIndices.slice(0, kept * 3),
    // Índice del triángulo original de cada triángulo conservado (para reasignar colores por cara).
    triangleSource: triangleSource.slice(0, kept),
  };
}

/**
 * Calcula normales suaves ponderadas por área para cada vértice de una malla indexada.
 *
 * @param positions Arreglo plano de posiciones [x, y, z, ...].
 * @param indices Índices de triángulos [i0, i1, i2, ...].
 * @returns Arreglo `Float32Array` de normales unitarias por vértice.
 */
export function computeVertexNormals(
  positions: Float32Array,
  indices: Uint32Array
): Float32Array {
  const normals = new Float32Array(positions.length);
  const triCount = Math.floor(indices.length / 3);

  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3] * 3;
    const i1 = indices[t * 3 + 1] * 3;
    const i2 = indices[t * 3 + 2] * 3;

    const ax = positions[i0];
    const ay = positions[i0 + 1];
    const az = positions[i0 + 2];

    const e1x = positions[i1] - ax;
    const e1y = positions[i1 + 1] - ay;
    const e1z = positions[i1 + 2] - az;

    const e2x = positions[i2] - ax;
    const e2y = positions[i2 + 1] - ay;
    const e2z = positions[i2 + 2] - az;

    // Producto cruzado proporcional al área del triángulo (CCW -> normal saliente)
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    normals[i0] += nx;
    normals[i0 + 1] += ny;
    normals[i0 + 2] += nz;

    normals[i1] += nx;
    normals[i1 + 1] += ny;
    normals[i1 + 2] += nz;

    normals[i2] += nx;
    normals[i2 + 1] += ny;
    normals[i2 + 2] += nz;
  }

  const vertCount = Math.floor(positions.length / 3);
  for (let v = 0; v < vertCount; v++) {
    const idx = v * 3;
    const nx = normals[idx];
    const ny = normals[idx + 1];
    const nz = normals[idx + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      normals[idx] = nx / len;
      normals[idx + 1] = ny / len;
      normals[idx + 2] = nz / len;
    } else {
      normals[idx + 1] = 1;
    }
  }

  return normals;
}

/** `new Manifold(mesh)` con el `ManifoldError` del WASM convertido en `EngineError('MESH_INVALID')`. */
function constructManifold(wasm: ManifoldToplevel, mesh: ManifoldMesh): Manifold {
  try {
    return new wasm.Manifold(mesh);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String((err as { code?: unknown })?.code ?? err);
    throw new EngineError('MESH_INVALID', { cause });
  }
}

/**
 * Convierte una malla `MeshData` de Kurra3D Studio (sistema Y-up en mm) a un sólido `Manifold`.
 * Opcionalmente asocia IDs originales (`originalID`) agrupando triángulos por color para
 * preservar regiones multicolor tras operaciones booleanas o cortes.
 *
 * @param wasm Módulo Manifold inicializado.
 * @param mesh Malla de entrada en formato Kurra3D Studio.
 * @param colorIdMap Mapa opcional de color hex ('#rrggbb') -> `originalID` reservado vía `Manifold.reserveIDs`.
 * @param fallbackColor Color por defecto si `mesh.faceColors` no está definido.
 * @returns Instancia válida de `Manifold`.
 */
export function meshDataToManifold(
  wasm: ManifoldToplevel,
  mesh: MeshData,
  colorIdMap?: Map<string, number>,
  fallbackColor = '#38bdf8'
): Manifold {
  if (mesh.positions.length === 0 || mesh.indices.length === 0) {
    throw new EngineError('MESH_EMPTY', { operation: 'manifold' });
  }
  for (let i = 0; i < mesh.positions.length; i++) {
    if (!Number.isFinite(mesh.positions[i])) throw new EngineError('MESH_INVALID', { cause: 'NonFiniteVertex' });
  }

  const triCount = Math.floor(mesh.indices.length / 3);
  let triVerts = new Uint32Array(mesh.indices);
  let vertProperties = new Float32Array(mesh.positions);

  // Si se suministra mapa de colores -> originalID, ordenamos los triángulos en "runs"
  // contiguos para que Manifold rastree qué material/color originó cada triángulo resultante.
  let runIndex: Uint32Array | undefined;
  let runOriginalID: Uint32Array | undefined;

  if (colorIdMap && colorIdMap.size > 0) {
    const normalizedFallback = fallbackColor.toLowerCase();
    const groups = new Map<number, number[]>();

    for (let t = 0; t < triCount; t++) {
      const hex = (mesh.faceColors?.[t] ?? normalizedFallback).toLowerCase();
      let origId = colorIdMap.get(hex);
      if (origId === undefined) {
        origId = wasm.Manifold.reserveIDs(1);
        colorIdMap.set(hex, origId);
      }
      let bucket = groups.get(origId);
      if (!bucket) {
        bucket = [];
        groups.set(origId, bucket);
      }
      bucket.push(t);
    }

    const sortedTriVerts = new Uint32Array(triCount * 3);
    const runIdxArr: number[] = [0];
    const runIdArr: number[] = [];

    // Manifold espera los runs ordenados por runOriginalID creciente
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
    let writeOffset = 0;

    for (const [origId, tris] of sortedEntries) {
      runIdArr.push(origId);
      for (const t of tris) {
        sortedTriVerts[writeOffset++] = triVerts[t * 3];
        sortedTriVerts[writeOffset++] = triVerts[t * 3 + 1];
        sortedTriVerts[writeOffset++] = triVerts[t * 3 + 2];
      }
      runIdxArr.push(writeOffset);
    }

    triVerts = sortedTriVerts;
    runIndex = new Uint32Array(runIdxArr);
    runOriginalID = new Uint32Array(runIdArr);
  }

  const manifoldMesh: ManifoldMesh = new wasm.Mesh({
    numProp: 3,
    vertProperties,
    triVerts,
    runIndex,
    runOriginalID,
  });

  // Asegura la fusión topológica de vértices coincidentes si la malla venía sin índices compartidos
  const mergedOpenEdges = manifoldMesh.merge();

  let first: Manifold | null = null;
  try {
    first = constructManifold(wasm, manifoldMesh);
  } catch {
    // El WASM rechazó la malla tal cual: se reintenta soldando (abajo).
  }
  let manifold: Manifold;
  if (first && first.status() === 'NoError') {
    manifold = first;
    // `merge` cerró bordes que no coinciden exactamente: también es una reparación implícita.
    if (mergedOpenEdges) implicitWeldEdges += defectCount(mesh);
  } else {
    // Segundo intento soldando explícitamente vértices cercanos (útil para STL/OBJ importados con tolerancia)
    first?.delete();
    const welded = weldVertices(mesh.positions, mesh.indices, 1e-4);
    const retryMesh = new wasm.Mesh({
      numProp: 3,
      vertProperties: welded.positions,
      triVerts: welded.indices,
    });
    retryMesh.merge();
    manifold = constructManifold(wasm, retryMesh);
    if (manifold.status() !== 'NoError') {
      const status = manifold.status();
      manifold.delete();
      throw new EngineError('MESH_INVALID', { cause: String(status) });
    }
    // La malla solo cerró soldando vértices cercanos: se deja dicho (aviso MESH_WELDED_IMPLICITLY).
    implicitWeldEdges += defectCount(mesh);
  }

  return manifold;
}

/** Defectos de cierre (definición única) que el motor corrigió soldando en silencio. */
function defectCount(mesh: MeshData): number {
  const c = closureCounts(mesh.positions, mesh.indices);
  return c.boundaryEdges + c.nonManifoldEdges + c.misorientedEdges + c.collapsedTriangles;
}

/** Defectos que el motor cerró soldando en silencio desde la última lectura. */
let implicitWeldEdges = 0;

/** Lee y limpia el aviso de soldadura implícita (`null` si no hubo). */
export function takeImplicitWeldWarning(): EngineWarning | null {
  const edges = implicitWeldEdges;
  implicitWeldEdges = 0;
  return edges > 0 ? engineWarning('MESH_WELDED_IMPLICITLY', { edges, tol: 1e-4 }) : null;
}

/**
 * Convierte un sólido `Manifold` de vuelta a `MeshData` de Kurra3D Studio (Y-up en mm),
 * reconstruyendo opcionalmente `faceColors` a partir de los `runOriginalID` rastreados.
 *
 * @param manifold Sólido `Manifold` origen.
 * @param idToColor Mapa inverso opcional (`originalID` -> color hex '#rrggbb').
 * @param keepUniformColors Si es `true`, conserva `faceColors` aunque todas las caras tengan el mismo
 *   color (así quien llama sabe qué color tenía la pieza, p. ej. al separar cuerpos de un combinado).
 * @returns Malla cerrada `MeshData` con posiciones, índices y normales calculadas.
 */
export function manifoldToMeshData(
  manifold: Manifold,
  idToColor?: Map<number, string>,
  keepUniformColors = false
): MeshData {
  const raw = manifold.getMesh();
  const numProp = raw.numProp;
  const numVert = raw.numVert;

  let positions: Float32Array;
  if (numProp === 3) {
    positions = new Float32Array(raw.vertProperties);
  } else {
    positions = new Float32Array(numVert * 3);
    for (let v = 0; v < numVert; v++) {
      const base = v * numProp;
      positions[v * 3] = raw.vertProperties[base];
      positions[v * 3 + 1] = raw.vertProperties[base + 1];
      positions[v * 3 + 2] = raw.vertProperties[base + 2];
    }
  }

  const indices = new Uint32Array(raw.triVerts);
  const normals = computeVertexNormals(positions, indices);

  let faceColors: string[] | undefined;
  if (idToColor && idToColor.size > 0 && raw.runOriginalID && raw.runIndex) {
    const triCount = Math.floor(indices.length / 3);
    const colors = new Array<string>(triCount);
    let anyAssigned = false;

    for (let r = 0; r < raw.runOriginalID.length; r++) {
      const origId = raw.runOriginalID[r];
      const color = idToColor.get(origId);
      const startTri = Math.floor(raw.runIndex[r] / 3);
      const endTri = Math.floor(raw.runIndex[r + 1] / 3);
      if (color) {
        anyAssigned = true;
        for (let t = startTri; t < endTri && t < triCount; t++) {
          colors[t] = color;
        }
      }
    }

    if (anyAssigned) {
      // Rellenar cualquier triángulo sin mapeo con el primer color conocido
      const fallback = idToColor.values().next().value ?? '#38bdf8';
      for (let t = 0; t < triCount; t++) {
        if (!colors[t]) {
          colors[t] = fallback;
        }
      }
      // Si todos los triángulos tienen el mismo color único, podemos conservarlo o simplificar;
      // conservamos faceColors si existen múltiples colores para no perder detalle multicolor.
      const uniqueSet = new Set(colors);
      if (uniqueSet.size > 1 || keepUniformColors) {
        faceColors = colors;
      }
    }
  }

  return {
    positions,
    indices,
    normals,
    ...(faceColors ? { faceColors } : {}),
  };
}

/**
 * Construye una tabla bidireccional de colores <-> originalID de Manifold para
 * preservar regiones multicolor a través de operaciones CSG o cortes por plano.
 */
export function createColorRegistry(
  wasm: ManifoldToplevel,
  objects: Array<{ color: string; faceColors?: string[] }>
): { colorToId: Map<string, number>; idToColor: Map<number, string> } {
  const uniqueColors = new Set<string>();
  for (const obj of objects) {
    uniqueColors.add(obj.color.toLowerCase());
    if (obj.faceColors) {
      for (const c of obj.faceColors) {
        uniqueColors.add(c.toLowerCase());
      }
    }
  }

  const colorList = Array.from(uniqueColors);
  const baseId = wasm.Manifold.reserveIDs(colorList.length);
  const colorToId = new Map<string, number>();
  const idToColor = new Map<number, string>();

  colorList.forEach((hex, idx) => {
    const id = baseId + idx;
    colorToId.set(hex, id);
    idToColor.set(id, hex);
  });

  return { colorToId, idToColor };
}
