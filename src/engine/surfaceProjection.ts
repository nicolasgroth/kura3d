/**
 * @file src/engine/surfaceProjection.ts
 * @description Proyección conformal determinista de texto paramétrico o gráficos SVG
 * sobre cualquier superficie 3D arbitraria (planos, cilindros, esferas o mallas STL orgánicas)
 * mediante subdivisión adaptativa libre de grietas, trazado de rayos con Three.js
 * (`THREE.Raycaster`) y operaciones booleanas watertight con Manifold-3D.
 * Soporta relieve positivo (`emboss`), grabado negativo (`deboss`) e incrustación
 * multicolor a ras de superficie (`flush_inlay`) para impresión 3MF multicolor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import type { Manifold } from 'manifold-3d';
import type {
  MeshData,
  SceneObject,
  SurfaceProjectionAxis,
  SurfaceProjectionOptions,
  Vec3,
} from '../types/kura';
import {
  createColorRegistry,
  initManifoldEngine,
  manifoldToMeshData,
  meshDataToManifold,
} from './manifoldKernel';
import { EngineError, requireOperationRange } from './engineErrors';
import { OPERATION_RANGES } from './operationLimits';
import {
  applyTransformToMesh,
  computeMeshStats,
  createPrimitiveMesh,
  normalizeMeshToBed,
} from './primitives';
import { extrudeSvgToMesh } from './advancedGeometry';
import { composeFlushInlaySurface } from './inlaySurface';
import { closeComposedProjectionMesh, closedProjectionMesh } from './projectionCleanup';

/** Malla gráfica normalizada en coordenadas locales `(u, v, w)` antes de proyectar. */
interface NormalizedGraphicUV {
  /** Coordenadas planas `[u0, v0, w0, ...]` donde `u` y `v` están en mm y `w` en `[0, 1]`. */
  coords: Float32Array;
  indices: Uint32Array;
}

/** Muestra de impacto sobre la superficie objetivo en espacio mundial. */
interface SurfaceHitSample {
  point: [number, number, number];
  normal: [number, number, number];
}

/**
 * Extrae el centro-base mundial `[cx, minY, cz]` de una malla y normaliza sus
 * coordenadas locales a la cama (Y=0, centrado en XZ).
 */
function extractPositionAndNormalize(mesh: MeshData): {
  mesh: MeshData;
  position: Vec3;
} {
  const vertCount = Math.floor(mesh.positions.length / 3);
  if (vertCount === 0) {
    return { mesh, position: [0, 0, 0] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (z > maxZ) maxZ = z;
  }

  return {
    mesh: normalizeMeshToBed(mesh),
    position: [(minX + maxX) * 0.5, minY, (minZ + maxZ) * 0.5],
  };
}

/**
 * Convierte una malla extruida de texto o SVG (generada en XZ con extrusión +Y)
 * a coordenadas normalizadas `(u, v, w)` con ancho objetivo `widthMm` centrado en `(0, 0)`
 * y `w in [0, 1]` (0 = cara trasera de apoyo, 1 = cara frontal).
 */
function normalizeGraphicToUV(mesh: MeshData, widthMm: number): NormalizedGraphicUV {
  const vertCount = Math.floor(mesh.positions.length / 3);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const spanX = Math.max(1e-4, maxX - minX);
  const spanY = Math.max(1e-4, maxY - minY);
  const scaleUV = Math.max(1, widthMm) / spanX;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const coords = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];

    // Mapeo dextrógiro: u = x (izq->der), v = -z (abajo->arriba), w = y / spanY
    coords[i * 3] = (x - cx) * scaleUV;
    coords[i * 3 + 1] = -(z - cz) * scaleUV;
    coords[i * 3 + 2] = Math.max(0, Math.min(1, (y - minY) / spanY));
  }

  return {
    coords,
    indices: new Uint32Array(mesh.indices),
  };
}

/**
 * Subdivide únicamente aristas cuya proyección en el plano `(u, v)` excede `maxEdgeMm`.
 * Al decidir la subdivisión por arista compartida y triangular cada caso (0, 1, 2 ó 3 aristas
 * divididas) preservando el devanado CCW, se evitan T-junctions y se mantiene la topología
 * 2-manifold cerrada para que el sello se curve suavemente sobre cilindros o esferas.
 */
function subdivideGraphicUVEdges(
  graphic: NormalizedGraphicUV,
  maxEdgeMm = 2.5
): NormalizedGraphicUV {
  let coords = Array.from(graphic.coords);
  let indices = Array.from(graphic.indices);
  const maxPasses = 5;
  const maxTriangles = 18000;

  for (let pass = 0; pass < maxPasses; pass++) {
    const triCount = Math.floor(indices.length / 3);
    if (triCount >= maxTriangles) break;

    const edgeMid = new Map<string, number>();
    let anySplit = false;

    const getOrSplitEdge = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const existing = edgeMid.get(key);
      if (existing !== undefined) return existing;

      const du = coords[b * 3] - coords[a * 3];
      const dv = coords[b * 3 + 1] - coords[a * 3 + 1];
      if (Math.hypot(du, dv) <= maxEdgeMm) {
        return -1;
      }

      anySplit = true;
      const midIdx = coords.length / 3;
      coords.push(
        (coords[a * 3] + coords[b * 3]) * 0.5,
        (coords[a * 3 + 1] + coords[b * 3 + 1]) * 0.5,
        (coords[a * 3 + 2] + coords[b * 3 + 2]) * 0.5
      );
      edgeMid.set(key, midIdx);
      return midIdx;
    };

    // Primer barrido: detectar qué aristas exceden maxEdgeMm
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      getOrSplitEdge(i0, i1);
      getOrSplitEdge(i1, i2);
      getOrSplitEdge(i2, i0);
    }

    if (!anySplit) break;

    const lookupMid = (a: number, b: number): number => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      return edgeMid.get(key) ?? -1;
    };

    const nextIndices: number[] = [];
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];

      const m01 = lookupMid(i0, i1);
      const m12 = lookupMid(i1, i2);
      const m20 = lookupMid(i2, i0);

      const count = (m01 >= 0 ? 1 : 0) + (m12 >= 0 ? 1 : 0) + (m20 >= 0 ? 1 : 0);

      if (count === 0) {
        nextIndices.push(i0, i1, i2);
      } else if (count === 1) {
        if (m01 >= 0) {
          nextIndices.push(i0, m01, i2, m01, i1, i2);
        } else if (m12 >= 0) {
          nextIndices.push(i0, i1, m12, i0, m12, i2);
        } else {
          nextIndices.push(i0, i1, m20, m20, i1, i2);
        }
      } else if (count === 2) {
        // Rotamos lógicamente para colocar el vértice entre las 2 aristas divididas como ápice
        if (m01 >= 0 && m12 >= 0) {
          nextIndices.push(i1, m12, m01, i0, m01, i2, m01, m12, i2);
        } else if (m12 >= 0 && m20 >= 0) {
          nextIndices.push(i2, m20, m12, i1, m12, i0, m12, m20, i0);
        } else {
          nextIndices.push(i0, m01, m20, i2, m20, i1, m20, m01, i1);
        }
      } else {
        // 3 aristas divididas -> subdivisión conformal 1-a-4
        nextIndices.push(
          i0, m01, m20,
          m01, i1, m12,
          m20, m12, i2,
          m01, m12, m20
        );
      }
    }

    indices = nextIndices;
  }

  return {
    coords: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
}

/**
 * Construye una malla Three.js y el arreglo de normales geométricas salientes por triángulo
 * para realizar raycasting preciso e independiente de la orientación de la cámara.
 */
function buildTargetRaycasterMesh(worldMesh: MeshData): {
  threeMesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  faceNormals: Float32Array;
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
    cx: number;
    cy: number;
    cz: number;
    dx: number;
    dy: number;
    dz: number;
  };
} {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(worldMesh.positions), 3)
  );
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(worldMesh.indices), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const threeMesh = new THREE.Mesh(geometry, material);
  threeMesh.updateMatrixWorld(true);

  const triCount = Math.floor(worldMesh.indices.length / 3);
  const faceNormals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const i0 = worldMesh.indices[t * 3] * 3;
    const i1 = worldMesh.indices[t * 3 + 1] * 3;
    const i2 = worldMesh.indices[t * 3 + 2] * 3;

    const e1x = worldMesh.positions[i1] - worldMesh.positions[i0];
    const e1y = worldMesh.positions[i1 + 1] - worldMesh.positions[i0 + 1];
    const e1z = worldMesh.positions[i1 + 2] - worldMesh.positions[i0 + 2];

    const e2x = worldMesh.positions[i2] - worldMesh.positions[i0];
    const e2y = worldMesh.positions[i2 + 1] - worldMesh.positions[i0 + 1];
    const e2z = worldMesh.positions[i2 + 2] - worldMesh.positions[i0 + 2];

    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    faceNormals[t * 3] = nx / len;
    faceNormals[t * 3 + 1] = ny / len;
    faceNormals[t * 3 + 2] = nz / len;
  }

  const box = geometry.boundingBox!;
  const minX = box.min.x;
  const minY = box.min.y;
  const minZ = box.min.z;
  const maxX = box.max.x;
  const maxY = box.max.y;
  const maxZ = box.max.z;

  return {
    threeMesh,
    geometry,
    material,
    faceNormals,
    bounds: {
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      cx: (minX + maxX) * 0.5,
      cy: (minY + maxY) * 0.5,
      cz: (minZ + maxZ) * 0.5,
      dx: maxX - minX,
      dy: maxY - minY,
      dz: maxZ - minZ,
    },
  };
}

/**
 * Calcula el origen y dirección del rayo para proyectar `(u, v)` sobre la superficie
 * objetivo según el eje elegido (`+z`, `-z`, `+x`, `-x`, `+y`, `-y` o `cylindrical`).
 */
function buildProjectionRay(
  u: number,
  v: number,
  axis: SurfaceProjectionAxis,
  bounds: ReturnType<typeof buildTargetRaycasterMesh>['bounds']
): { origin: THREE.Vector3; dir: THREE.Vector3; fallbackPoint: [number, number, number] } {
  const { minX, minY, minZ, maxX, maxY, maxZ, cx, cy, cz, dx, dz } = bounds;
  const standoff = 25;

  switch (axis) {
    case '+z':
      return {
        origin: new THREE.Vector3(cx + u, cy + v, maxZ + standoff),
        dir: new THREE.Vector3(0, 0, -1),
        fallbackPoint: [
          Math.max(minX, Math.min(maxX, cx + u)),
          Math.max(minY, Math.min(maxY, cy + v)),
          maxZ,
        ],
      };
    case '-z':
      return {
        origin: new THREE.Vector3(cx - u, cy + v, minZ - standoff),
        dir: new THREE.Vector3(0, 0, 1),
        fallbackPoint: [
          Math.max(minX, Math.min(maxX, cx - u)),
          Math.max(minY, Math.min(maxY, cy + v)),
          minZ,
        ],
      };
    case '+x':
      return {
        origin: new THREE.Vector3(maxX + standoff, cy + v, cz - u),
        dir: new THREE.Vector3(-1, 0, 0),
        fallbackPoint: [
          maxX,
          Math.max(minY, Math.min(maxY, cy + v)),
          Math.max(minZ, Math.min(maxZ, cz - u)),
        ],
      };
    case '-x':
      return {
        origin: new THREE.Vector3(minX - standoff, cy + v, cz + u),
        dir: new THREE.Vector3(1, 0, 0),
        fallbackPoint: [
          minX,
          Math.max(minY, Math.min(maxY, cy + v)),
          Math.max(minZ, Math.min(maxZ, cz + u)),
        ],
      };
    case '+y':
      return {
        origin: new THREE.Vector3(cx + u, maxY + standoff, cz - v),
        dir: new THREE.Vector3(0, -1, 0),
        fallbackPoint: [
          Math.max(minX, Math.min(maxX, cx + u)),
          maxY,
          Math.max(minZ, Math.min(maxZ, cz - v)),
        ],
      };
    case '-y':
      return {
        origin: new THREE.Vector3(cx + u, minY - standoff, cz + v),
        dir: new THREE.Vector3(0, 1, 0),
        fallbackPoint: [
          Math.max(minX, Math.min(maxX, cx + u)),
          minY,
          Math.max(minZ, Math.min(maxZ, cz + v)),
        ],
      };
    case 'cylindrical': {
      // Envoltura cilíndrica alrededor del eje vertical Y centrada en (cx, cz)
      const cylR = Math.max(2, Math.max(dx, dz) * 0.5);
      const theta = u / cylR;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const outerR = cylR + standoff;
      return {
        origin: new THREE.Vector3(cx + sinT * outerR, cy + v, cz + cosT * outerR),
        dir: new THREE.Vector3(-sinT, 0, -cosT),
        fallbackPoint: [
          cx + sinT * cylR,
          Math.max(minY, Math.min(maxY, cy + v)),
          cz + cosT * cylR,
        ],
      };
    }
  }
}

/**
 * Envuelve el gráfico subdividido `(u, v, w)` sobre los impactos muestreados de la superficie
 * objetivo para producir una malla sólida cerrada (`S`) desplazada entre `-backEmbed` y `+frontDepth`
 * a lo largo de la normal saliente de cada vértice.
 */
function buildConformalStampMesh(
  graphic: NormalizedGraphicUV,
  samples: SurfaceHitSample[],
  frontDepth: number,
  backEmbed: number,
  colorHex: string
): MeshData {
  const vertCount = Math.floor(graphic.coords.length / 3);
  const positions = new Float32Array(vertCount * 3);
  const totalSpan = frontDepth + backEmbed;

  for (let i = 0; i < vertCount; i++) {
    const w = graphic.coords[i * 3 + 2];
    const offset = -backEmbed + w * totalSpan;
    const sample = samples[i];
    positions[i * 3] = sample.point[0] + sample.normal[0] * offset;
    positions[i * 3 + 1] = sample.point[1] + sample.normal[1] * offset;
    positions[i * 3 + 2] = sample.point[2] + sample.normal[2] * offset;
  }

  const triCount = Math.floor(graphic.indices.length / 3);
  return {
    positions,
    indices: new Uint32Array(graphic.indices),
    faceColors: new Array<string>(triCount).fill(colorHex.toLowerCase()),
  };
}

/**
 * Proyecta de manera conformal texto paramétrico o un diseño SVG vectorial sobre cualquier
 * superficie 3D arbitraria (cubos, cilindros, esferas o mallas STL orgánicas), generando
 * un sólido watertight listo para impresión 3D en modo relieve (`emboss`), grabado (`deboss`)
 * o incrustación multicolor a ras de superficie (`flush_inlay`).
 *
 * @param targetObj Objeto 3D objetivo en la escena.
 * @param options Parámetros de proyección superficial y color del gráfico.
 * @returns Nueva malla resultante normalizada a cama y su posición mundial `[cx, minY, cz]`.
 */
export async function projectGraphicOntoSurface(
  targetObj: SceneObject,
  options: SurfaceProjectionOptions
): Promise<{ mesh: MeshData; position: Vec3 }> {
  const wasm = await initManifoldEngine();

  const R = OPERATION_RANGES.projection;
  const widthMm = requireOperationRange('widthMm', options.widthMm, R.widthMm, 20);
  const depthMm = requireOperationRange('depthMm', options.depthMm, R.depthMm, 1.2);
  const offsetU = requireOperationRange('offsetU', options.offsetU, R.offsetU, 0);
  const offsetV = requireOperationRange('offsetV', options.offsetV, R.offsetV, 0);
  const stampColor = (options.colorHex || '#f97316').toLowerCase();

  // 1) Generar el sólido 2D extruido del texto o SVG
  let rawGraphic: MeshData;
  if (options.kind === 'svg') {
    const svg = options.svgContent?.trim();
    if (!svg) {
      throw new EngineError('PROJECTION_EMPTY_SVG');
    }
    rawGraphic = await extrudeSvgToMesh({
      svgContent: svg,
      name: 'ProjectionSVG',
      depth: 1,
      targetWidth: widthMm,
      curveSegments: 10,
    });
  } else {
    const text = options.text?.trim() ?? '';
    if (!text) {
      throw new EngineError('PROJECTION_EMPTY_TEXT');
    }
    rawGraphic = await createPrimitiveMesh('text', {
      text,
      fontSize: 16,
      height: 1,
    });
  }

  // Normalizar a coordenadas (u, v, w) y subdividir aristas largas para curvado limpio
  const maxEdgeMm = Math.min(2.5, Math.max(0.8, widthMm / 16));
  const uvGraphic = subdivideGraphicUVEdges(
    normalizeGraphicToUV(rawGraphic, widthMm),
    maxEdgeMm
  );

  // 2) Hornear el objeto objetivo a espacio mundial y preparar el Raycaster
  const targetWorld = applyTransformToMesh(
    targetObj.mesh,
    targetObj.position,
    targetObj.rotation,
    targetObj.scale
  );

  const raySetup = buildTargetRaycasterMesh(targetWorld);
  const raycaster = new THREE.Raycaster();
  const sampleCache = new Map<string, SurfaceHitSample>();
  const vertCount = Math.floor(uvGraphic.coords.length / 3);
  const vertexSamples: SurfaceHitSample[] = new Array(vertCount);
  let missedSamples = 0;
  // Espesor mínimo de la pieza bajo el gráfico (distancia entre la 1.ª y 2.ª intersección del rayo)
  let minThickness = Infinity;

  try {
    for (let i = 0; i < vertCount; i++) {
      const u = uvGraphic.coords[i * 3] + offsetU;
      const v = uvGraphic.coords[i * 3 + 1] + offsetV;
      const cacheKey = `${Math.round(u * 1000)}_${Math.round(v * 1000)}`;
      let cached = sampleCache.get(cacheKey);

      if (!cached) {
        const { origin, dir, fallbackPoint } = buildProjectionRay(
          u,
          v,
          options.axis,
          raySetup.bounds
        );
        raycaster.set(origin, dir);
        const hits = raycaster.intersectObject(raySetup.threeMesh, false);

        if (hits.length > 0) {
          const hit = hits[0];
          const exit = hits.find((h) => h.distance > hit.distance + 1e-4);
          if (exit) {
            minThickness = Math.min(minThickness, exit.distance - hit.distance);
          }
          let nx = -dir.x;
          let ny = -dir.y;
          let nz = -dir.z;

          if (hit.faceIndex != null && hit.faceIndex >= 0) {
            nx = raySetup.faceNormals[hit.faceIndex * 3];
            ny = raySetup.faceNormals[hit.faceIndex * 3 + 1];
            nz = raySetup.faceNormals[hit.faceIndex * 3 + 2];
          } else if (hit.face) {
            nx = hit.face.normal.x;
            ny = hit.face.normal.y;
            nz = hit.face.normal.z;
          }

          // Garantizar que la normal apunte hacia el lado exterior (opuesto al rayo entrante)
          if (nx * dir.x + ny * dir.y + nz * dir.z > 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }

          const nLen = Math.hypot(nx, ny, nz) || 1;
          cached = {
            point: [hit.point.x, hit.point.y, hit.point.z],
            normal: [nx / nLen, ny / nLen, nz / nLen],
          };
        } else {
          missedSamples++;
          // Respaldo seguro si un vértice periférico cae fuera de la silueta del objetivo:
          // buscamos el vértice más cercano al punto proyectado sobre la envolvente para evitar NaN.
          let bestDistSq = Infinity;
          let bx = fallbackPoint[0];
          let by = fallbackPoint[1];
          let bz = fallbackPoint[2];
          const posArr = targetWorld.positions;
          const tVertCount = Math.floor(posArr.length / 3);
          for (let tv = 0; tv < tVertCount; tv++) {
            const dx = posArr[tv * 3] - fallbackPoint[0];
            const dy = posArr[tv * 3 + 1] - fallbackPoint[1];
            const dz = posArr[tv * 3 + 2] - fallbackPoint[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              bx = posArr[tv * 3];
              by = posArr[tv * 3 + 1];
              bz = posArr[tv * 3 + 2];
            }
          }
          cached = {
            point: [bx, by, bz],
            normal: [-dir.x, -dir.y, -dir.z],
          };
        }

        sampleCache.set(cacheKey, cached);
      }

      vertexSamples[i] = cached;
    }
  } finally {
    raySetup.geometry.dispose();
    raySetup.material.dispose();
  }

  // El gráfico debe caer completo sobre la pieza: si algún rayo no la toca, se saldría de la cara
  if (missedSamples > 0) {
    throw new EngineError('PROJECTION_OUT_OF_BOUNDS', {
      width: widthMm,
      missed: missedSamples,
      total: vertCount,
    });
  }
  // Grabado o incrustación más profundos que la pieza la atravesarían
  const MIN_FLOOR_MM = 0.4;
  if (options.mode !== 'emboss' && Number.isFinite(minThickness) && depthMm > minThickness - MIN_FLOOR_MM) {
    throw new EngineError('PROJECTION_TOO_DEEP', {
      depth: depthMm,
      thickness: minThickness,
      floor: MIN_FLOOR_MM,
    });
  }

  // 3) Construir el sello Manifold y ejecutar el modo booleano correspondiente
  const registry = createColorRegistry(wasm, [
    { color: targetObj.color, faceColors: targetWorld.faceColors },
    { color: stampColor },
  ]);

  let targetManifold: Manifold | null = null;
  let stampManifold: Manifold | null = null;
  let pocketManifold: Manifold | null = null;
  let carvedManifold: Manifold | null = null;
  let inlayIntersectManifold: Manifold | null = null;
  let resultManifold: Manifold | null = null;

  try {
    targetManifold = meshDataToManifold(
      wasm,
      targetWorld,
      registry.colorToId,
      targetObj.color
    );

    if (options.mode === 'emboss') {
      const embed = Math.max(0.6, Math.min(2.0, depthMm * 0.8 + 0.5));
      const stampMesh = buildConformalStampMesh(
        uvGraphic,
        vertexSamples,
        depthMm,
        embed,
        stampColor
      );
      stampManifold = meshDataToManifold(
        wasm,
        stampMesh,
        registry.colorToId,
        stampColor
      );
      resultManifold = targetManifold.add(stampManifold);
    } else if (options.mode === 'deboss') {
      const outerPad = Math.max(0.4, Math.min(1.5, depthMm * 0.5));
      const stampMesh = buildConformalStampMesh(
        uvGraphic,
        vertexSamples,
        outerPad,
        depthMm,
        stampColor
      );
      stampManifold = meshDataToManifold(
        wasm,
        stampMesh,
        registry.colorToId,
        stampColor
      );
      resultManifold = targetManifold.subtract(stampManifold);
    } else {
      // flush_inlay: talla una cavidad poco profunda y rellena con la intersección exacta
      // del volumen objetivo pintada con colorHex para mantener la superficie externa 100% a ras.
      const pocketDepth = Math.max(0.6, depthMm);
      const pocketMesh = buildConformalStampMesh(
        uvGraphic,
        vertexSamples,
        0.5,
        pocketDepth,
        stampColor
      );
      // La cavidad lleva un originalID propio: sus caras (paredes internas) se descartan al componer.
      const rawPocket = meshDataToManifold(wasm, pocketMesh, registry.colorToId, stampColor);
      pocketManifold = rawPocket.asOriginal();
      rawPocket.delete();
      carvedManifold = targetManifold.subtract(pocketManifold);
      inlayIntersectManifold = targetManifold.intersect(pocketManifold);
      const pocketVolume = Math.max(1e-9, pocketManifold.volume());
      const effect = inlayIntersectManifold.volume() / pocketVolume;
      if (inlayIntersectManifold.isEmpty() || effect < 0.05) {
        throw new EngineError('PROJECTION_NO_EFFECT', { change: effect * 100 });
      }
      // Una sola malla: la superficie de la pieza con la región incrustada pintada (sin unir sólidos
      // que se tocan, que dejaba láminas coincidentes y aristas no pareadas).
      const inlayMesh = composeFlushInlaySurface(
        carvedManifold,
        inlayIntersectManifold,
        pocketManifold.originalID(),
        registry.idToColor,
        targetObj.color.toLowerCase(),
        stampColor
      );
      return extractPositionAndNormalize(
        closeComposedProjectionMesh(wasm, inlayMesh, registry.colorToId, registry.idToColor, targetObj.color)
      );
    }

    if (resultManifold.isEmpty() || resultManifold.numTri() === 0) {
      throw new EngineError('PROJECTION_NO_EFFECT', { change: 0 });
    }

    // El resultado debe cambiar de verdad la pieza (no solo agregar triángulos sueltos)
    const stampVolume = Math.max(1e-9, stampManifold?.volume() ?? 0);
    const before = targetManifold.volume();
    const after = resultManifold.volume();
    const effect = Math.abs(after - before) / stampVolume;
    if (effect < 0.05) {
      throw new EngineError('PROJECTION_NO_EFFECT', { change: effect * 100 });
    }

    return extractPositionAndNormalize(closedProjectionMesh(resultManifold, registry.idToColor));
  } finally {
    targetManifold?.delete();
    stampManifold?.delete();
    pocketManifold?.delete();
    carvedManifold?.delete();
    inlayIntersectManifold?.delete();
    resultManifold?.delete();
  }
}
