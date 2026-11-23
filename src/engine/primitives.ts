/**
 * @file src/engine/primitives.ts
 * @description Generadores paramétricos de primitivas 3D watertight sobre Manifold-3D,
 * utilidades de transformación, normalización a cama (Y=0), cálculo de estadísticas
 * y conversión optimizada a THREE.BufferGeometry con soporte de pintado por cara.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { EngineError } from './engineErrors';
import { isMeshClosed } from './repair/meshTopology';
import type { Manifold } from 'manifold-3d';
import type {
  MeshData,
  PrimitiveParams,
  PrimitiveType,
  SceneObject,
  Vec3,
} from '../types/kura';
import {
  computeVertexNormals,
  initManifoldEngine,
  manifoldToMeshData,
} from './manifoldKernel';
import {
  resolveBox,
  resolveCone,
  resolveCylinder,
  resolvePrism,
  resolveSphere,
  resolveText,
  resolveTorus,
  resolveTube,
} from './primitiveParams';
import { buildTextCrossSection } from './text/textCrossSection';

/**
 * Normaliza una malla para que quede centrada horizontalmente en (X=0, Z=0)
 * y apoyada exactamente sobre la cama de impresión en Y=0 (minY = 0).
 *
 * @param mesh Malla de entrada en milímetros (Y-up).
 * @returns Nueva instancia `MeshData` desplazada a la cama.
 */
export function normalizeMeshToBed(mesh: MeshData): MeshData {
  const vertCount = Math.floor(mesh.positions.length / 3);
  if (vertCount === 0) {
    return {
      positions: new Float32Array(0),
      indices: new Uint32Array(0),
      ...(mesh.normals ? { normals: new Float32Array(0) } : {}),
      ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const offsetX = -(minX + maxX) * 0.5;
  const offsetY = -minY;
  const offsetZ = -(minZ + maxZ) * 0.5;

  const positions = new Float32Array(mesh.positions.length);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = mesh.positions[i * 3] + offsetX;
    positions[i * 3 + 1] = mesh.positions[i * 3 + 1] + offsetY;
    positions[i * 3 + 2] = mesh.positions[i * 3 + 2] + offsetZ;
  }

  return {
    positions,
    indices: new Uint32Array(mesh.indices),
    ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };
}

/**
 * Aplica una transformación afín TRS (Traslación, Rotación Euler XYZ en radianes, Escala)
 * directamente sobre los vértices de una malla, invirtiendo el orden de devanado (winding)
 * si la escala tiene determinante negativo para mantener normales salientes.
 *
 * @param mesh Malla local origen.
 * @param position Traslación [x, y, z] en mm.
 * @param rotation Rotación Euler [rx, ry, rz] en radianes.
 * @param scale Escala [sx, sy, sz].
 * @returns Malla transformada al espacio destino con normales recalculadas.
 */
export function applyTransformToMesh(
  mesh: MeshData,
  position: Vec3,
  rotation: Vec3,
  scale: Vec3
): MeshData {
  const mat = new THREE.Matrix4().compose(
    new THREE.Vector3(position[0], position[1], position[2]),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ')
    ),
    new THREE.Vector3(scale[0], scale[1], scale[2])
  );

  const e = mat.elements;
  const vertCount = Math.floor(mesh.positions.length / 3);
  const positions = new Float32Array(mesh.positions.length);

  for (let i = 0; i < vertCount; i++) {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];

    positions[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
    positions[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    positions[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }

  const indices = new Uint32Array(mesh.indices);
  // Si la reflexión invierte la orientación (determinante < 0), volteamos los triángulos
  const det = scale[0] * scale[1] * scale[2];
  if (det < 0) {
    const triCount = Math.floor(indices.length / 3);
    for (let t = 0; t < triCount; t++) {
      const tmp = indices[t * 3 + 1];
      indices[t * 3 + 1] = indices[t * 3 + 2];
      indices[t * 3 + 2] = tmp;
    }
  }

  const normals = computeVertexNormals(positions, indices);

  return {
    positions,
    indices,
    normals,
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };
}

export { computeMeshStats } from './meshStats';

/**
 * Construye una `THREE.BufferGeometry` lista para renderizar en Three.js.
 * Cuando `mesh.faceColors` está presente, convierte la geometría a formato no-indexado
 * con atributo `color` por vértice para mostrar el pintado por triángulo con bordes nítidos.
 *
 * @param mesh Malla origen en formato Kura3D.
 * @param baseColorHex Color base opcional en hex si no se usa `faceColors`.
 * @returns Geometría Three.js lista para GPU.
 */
export function createBufferGeometryFromMeshData(
  mesh: MeshData,
  baseColorHex?: string
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const triCount = Math.floor(mesh.indices.length / 3);

  if (mesh.faceColors && mesh.faceColors.length === triCount && triCount > 0) {
    const posOut = new Float32Array(triCount * 9);
    const normOut = new Float32Array(triCount * 9);
    const colOut = new Float32Array(triCount * 9);
    const colorCache = new Map<string, [number, number, number]>();
    const tmpColor = new THREE.Color();
    const defaultHex = (baseColorHex ?? '#38bdf8').toLowerCase();

    for (let t = 0; t < triCount; t++) {
      const hex = (mesh.faceColors[t] ?? defaultHex).toLowerCase();
      let rgb = colorCache.get(hex);
      if (!rgb) {
        tmpColor.set(hex);
        rgb = [tmpColor.r, tmpColor.g, tmpColor.b];
        colorCache.set(hex, rgb);
      }

      const i0 = mesh.indices[t * 3] * 3;
      const i1 = mesh.indices[t * 3 + 1] * 3;
      const i2 = mesh.indices[t * 3 + 2] * 3;

      const ax = mesh.positions[i0];
      const ay = mesh.positions[i0 + 1];
      const az = mesh.positions[i0 + 2];
      const bx = mesh.positions[i1];
      const by = mesh.positions[i1 + 1];
      const bz = mesh.positions[i1 + 2];
      const cx = mesh.positions[i2];
      const cy = mesh.positions[i2 + 1];
      const cz = mesh.positions[i2 + 2];

      const base = t * 9;
      posOut[base] = ax;
      posOut[base + 1] = ay;
      posOut[base + 2] = az;
      posOut[base + 3] = bx;
      posOut[base + 4] = by;
      posOut[base + 5] = bz;
      posOut[base + 6] = cx;
      posOut[base + 7] = cy;
      posOut[base + 8] = cz;

      // Normal plana por triángulo para que el pintado por caras se vea definido y limpio
      const e1x = bx - ax;
      const e1y = by - ay;
      const e1z = bz - az;
      const e2x = cx - ax;
      const e2y = cy - ay;
      const e2z = cz - az;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      for (let k = 0; k < 3; k++) {
        normOut[base + k * 3] = nx;
        normOut[base + k * 3 + 1] = ny;
        normOut[base + k * 3 + 2] = nz;
        colOut[base + k * 3] = rgb[0];
        colOut[base + k * 3 + 1] = rgb[1];
        colOut[base + k * 3 + 2] = rgb[2];
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normOut, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colOut, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(mesh.positions), 3)
  );
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.indices), 1));

  if (mesh.normals && mesh.normals.length === mesh.positions.length) {
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(new Float32Array(mesh.normals), 3)
    );
  } else {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Crea una primitiva paramétrica 3D cerrada (2-manifold watertight) centrada en X=0, Z=0
 * y apoyada sobre la cama en Y=0.
 *
 * @param type Tipo de primitiva ('box', 'cylinder', 'tube', 'sphere', 'cone', 'torus', 'prism', 'text').
 * @param params Parámetros geométricos en milímetros.
 * @returns Malla `MeshData` lista para escena, CSG o exportación.
 */
export async function createPrimitiveMesh(
  type: PrimitiveType,
  params: PrimitiveParams = {}
): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  let manifold: Manifold | null = null;
  // Registro de manejadores WASM intermedios para garantizar su liberación en finally
  const tempHandles: Array<{ delete: () => void }> = [];

  try {
    switch (type) {
      case 'box': {
        const { w, h, d } = resolveBox(params);
        manifold = wasm.Manifold.cube([w, h, d], true);
        break;
      }

      case 'cylinder': {
        const { r, h, seg } = resolveCylinder(params);
        // Manifold.cylinder extruye a lo largo de Z; rotamos -90° en X para alinear con Y-up
        const raw = wasm.Manifold.cylinder(h, r, r, seg, false);
        tempHandles.push(raw);
        manifold = raw.rotate([-90, 0, 0]);
        break;
      }

      case 'tube': {
        const { outerR, innerR, h, seg } = resolveTube(params);

        const outer = wasm.Manifold.cylinder(h, outerR, outerR, seg, false);
        tempHandles.push(outer);
        // El cilindro interno sobresale 1 mm por ambos extremos para evitar coplanaridad
        const innerRaw = wasm.Manifold.cylinder(h + 2, innerR, innerR, seg, false);
        tempHandles.push(innerRaw);
        const inner = innerRaw.translate([0, 0, -1]);
        tempHandles.push(inner);
        const tubeZ = outer.subtract(inner);
        tempHandles.push(tubeZ);
        manifold = tubeZ.rotate([-90, 0, 0]);
        break;
      }

      case 'sphere': {
        const { r, seg } = resolveSphere(params);
        manifold = wasm.Manifold.sphere(r, seg);
        break;
      }

      case 'cone': {
        const { r, h, seg } = resolveCone(params);
        const raw = wasm.Manifold.cylinder(h, r, 0, seg, false);
        tempHandles.push(raw);
        manifold = raw.rotate([-90, 0, 0]);
        break;
      }

      case 'torus': {
        const { majorR, tubeR, seg } = resolveTorus(params);
        // Revolucionamos un círculo desplazado sobre +X alrededor del eje Y (Manifold lo asigna a Z)
        const circle = wasm.CrossSection.circle(tubeR, Math.max(12, Math.round(seg * 0.75)));
        tempHandles.push(circle);
        const shifted = circle.translate([majorR, 0]);
        tempHandles.push(shifted);
        const revolved = shifted.revolve(seg, 360);
        tempHandles.push(revolved);
        // Rotamos -90° en X para que el toro repose plano sobre la cama XZ (eje de simetría = Y)
        manifold = revolved.rotate([-90, 0, 0]);
        break;
      }

      case 'prism': {
        const { sides, r, h } = resolvePrism(params);
        const raw = wasm.Manifold.cylinder(h, r, r, sides, false);
        tempHandles.push(raw);
        manifold = raw.rotate([-90, 0, 0]);
        break;
      }

      case 'text': {
        // Fuente real (Roboto Bold): `fontSize` es el alto de mayúscula en mm.
        const { text, fontSize, depth: extrudeDepth, letterSpacing, textAlign } = resolveText(params);
        const cs = await buildTextCrossSection(wasm, text, { size: fontSize, letterSpacing, align: textAlign });
        tempHandles.push(cs);
        const extruded = cs.extrude(extrudeDepth, 0, 0, [1, 1], false);
        tempHandles.push(extruded);
        // Rotamos -90° en X: el texto queda acostado sobre la cama XZ y extruido hacia +Y
        manifold = extruded.rotate([-90, 0, 0]);
        break;
      }

      default: {
        const exhaustive: never = type;
        throw new EngineError('PRIMITIVE_UNSUPPORTED', { type: String(exhaustive) });
      }
    }

    if (manifold.status() !== 'NoError' || manifold.isEmpty()) {
      throw new EngineError('INVALID_PARAMETER', { name: type, value: manifold.status(), min: 0, max: 0 });
    }
    const mesh = manifoldToMeshData(manifold);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const handle of tempHandles) {
      handle.delete();
    }
    if (manifold) {
      manifold.delete();
    }
  }
}
