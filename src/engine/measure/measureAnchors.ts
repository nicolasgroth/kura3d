/**
 * @file src/engine/measure/measureAnchors.ts
 * @description Anclas de medición: cada punto medido guarda el objeto al que pertenece y su posición
 * en coordenadas LOCALES de ese objeto, de modo que al mover, rotar o escalar el objeto la distancia,
 * el ángulo o el área se recalculan en vivo. Una ancla queda "desactualizada" si el objeto ya no
 * existe o si su malla cambió (operación destructiva): en ese caso no se muestra ningún valor.
 * Funciones puras, sin estado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';

type Placed = Pick<SceneObject, 'position' | 'rotation' | 'scale'>;

/** Punto (y normal opcional) de una medición, fijado a un objeto en coordenadas locales. */
export interface MeasureAnchor {
  objectId: string;
  /** Malla del objeto cuando se midió: si cambia, el ancla deja de ser válida. */
  mesh: MeshData;
  local: Vec3;
  /** Normal local de la cara tocada (solo ángulo entre caras). */
  normalLocal?: Vec3;
}

/** Triángulos locales de una región de área sobre un objeto. */
export interface AreaPart {
  objectId: string;
  mesh: MeshData;
  /** 9 números por triángulo, en coordenadas locales del objeto. */
  tris: Float32Array;
}

export function placementMatrix(obj: Placed): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(obj.position[0], obj.position[1], obj.position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')),
    new THREE.Vector3(obj.scale[0], obj.scale[1], obj.scale[2]),
  );
}

const vec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Punto de mundo → coordenadas locales del objeto. */
export function worldToLocal(obj: Placed, world: Vec3): Vec3 {
  const inv = placementMatrix(obj).invert();
  return vec(new THREE.Vector3(world[0], world[1], world[2]).applyMatrix4(inv));
}

/** Coordenadas locales → mundo. */
export function localToWorld(obj: Placed, local: Vec3): Vec3 {
  return vec(new THREE.Vector3(local[0], local[1], local[2]).applyMatrix4(placementMatrix(obj)));
}

/** Normal de mundo → normal local (la inversa de la normal-matrix, normalizada). */
export function normalToLocal(obj: Placed, world: Vec3): Vec3 {
  const m = new THREE.Matrix3().setFromMatrix4(placementMatrix(obj)); // normalLocal = Mᵀ · nWorld
  const n = new THREE.Vector3(world[0], world[1], world[2]).applyMatrix3(m.transpose());
  return n.lengthSq() > 0 ? vec(n.normalize()) : [0, 1, 0];
}

/** Normal local → mundo (normal-matrix = (M⁻¹)ᵀ). */
export function normalToWorld(obj: Placed, local: Vec3): Vec3 {
  const nm = new THREE.Matrix3().getNormalMatrix(placementMatrix(obj));
  const n = new THREE.Vector3(local[0], local[1], local[2]).applyMatrix3(nm);
  return n.lengthSq() > 0 ? vec(n.normalize()) : [0, 1, 0];
}

export function makeAnchor(obj: SceneObject, world: Vec3, normalWorld?: Vec3): MeasureAnchor {
  return {
    objectId: obj.id,
    mesh: obj.mesh,
    local: worldToLocal(obj, world),
    ...(normalWorld ? { normalLocal: normalToLocal(obj, normalWorld) } : {}),
  };
}

/** Objeto actual de un ancla, o `null` si desapareció o su malla cambió. */
export function validObjectFor(
  anchor: { objectId: string; mesh: MeshData },
  objects: ReadonlyArray<SceneObject>,
): SceneObject | null {
  const obj = objects.find((o) => o.id === anchor.objectId);
  return obj && obj.mesh === anchor.mesh ? obj : null;
}

/** Triángulos de una región (índices de cara) de la malla local, como 9 números por triángulo. */
export function localTriangles(mesh: MeshData, faces: Uint32Array): Float32Array {
  const out = new Float32Array(faces.length * 9);
  const P = mesh.positions, I = mesh.indices;
  faces.forEach((f, n) => {
    for (let k = 0; k < 3; k++) {
      const v = I[f * 3 + k] * 3;
      out[n * 9 + k * 3] = P[v];
      out[n * 9 + k * 3 + 1] = P[v + 1];
      out[n * 9 + k * 3 + 2] = P[v + 2];
    }
  });
  return out;
}

export interface WorldRegion {
  areaMm2: number;
  centroid: Vec3;
  /** Triángulos en mundo (9 números por triángulo). */
  highlight: Float32Array;
}

/** Lleva los triángulos locales de las partes al mundo y suma su área (con el centroide ponderado). */
export function worldRegion(parts: ReadonlyArray<{ part: AreaPart; obj: Placed }>): WorldRegion {
  const total = parts.reduce((n, p) => n + p.part.tris.length, 0);
  const highlight = new Float32Array(total);
  let off = 0;
  let area = 0, cx = 0, cy = 0, cz = 0;
  const v = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const { part, obj } of parts) {
    const m = placementMatrix(obj);
    const src = part.tris;
    for (let i = 0; i < src.length; i += 9) {
      const p: THREE.Vector3[] = [];
      for (let k = 0; k < 3; k++) {
        v.set(src[i + k * 3], src[i + k * 3 + 1], src[i + k * 3 + 2]).applyMatrix4(m);
        highlight[off + i + k * 3] = v.x;
        highlight[off + i + k * 3 + 1] = v.y;
        highlight[off + i + k * 3 + 2] = v.z;
        p.push(v.clone());
      }
      e1.subVectors(p[1], p[0]);
      e2.subVectors(p[2], p[0]);
      const a = e1.cross(e2).length() / 2;
      area += a;
      cx += (a * (p[0].x + p[1].x + p[2].x)) / 3;
      cy += (a * (p[0].y + p[1].y + p[2].y)) / 3;
      cz += (a * (p[0].z + p[1].z + p[2].z)) / 3;
    }
    off += src.length;
  }
  const inv = area > 0 ? 1 / area : 0;
  return { areaMm2: area, centroid: [cx * inv, cy * inv, cz * inv], highlight };
}
