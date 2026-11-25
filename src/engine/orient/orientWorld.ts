/**
 * @file src/engine/orient/orientWorld.ts
 * @description Preparación de la pieza para orientar: malla en mundo (una sola copia), normales y
 * áreas por triángulo con el signo corregido si la malla está invertida, centro de masa (tetraedros
 * desde el origen; si no es cerrada, centroide de superficie), volumen, diagonal y los vértices del
 * casco convexo 3D (three.js `ConvexHull`, MIT) con sus caras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import type { Vec3 } from '../../types/kura';
import { EngineError } from '../engineErrors';
import { faceGeometry } from '../printabilityChecks';
import type { HullFace } from './orientCandidates';
import type { OrientInput } from './orientTypes';

export interface OrientWorld {
  positions: Float64Array;
  indices: ArrayLike<number>;
  normals: Float64Array;
  areas: Float64Array;
  totalArea: number;
  volume: number;
  com: Vec3;
  diag: number;
  /** Vértices del casco convexo intercalados (bastan para huella, extensión y altura). */
  hullPoints: Float64Array;
  /** Caras del casco: normal hacia fuera, área y vértices. */
  hullFaces: HullFace[];
}

export function worldPositions(input: OrientInput): Float64Array {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...input.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(input.rotation[0], input.rotation[1], input.rotation[2], 'XYZ')),
    new THREE.Vector3(...input.scale),
  ).elements;
  const p = input.mesh.positions;
  const out = new Float64Array(p.length - (p.length % 3));
  for (let i = 0; i < out.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  return out;
}

export function massProperties(p: Float64Array, idx: ArrayLike<number>): { volume: number; com: Vec3 } {
  let v6 = 0, cx = 0, cy = 0, cz = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const d = p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
      + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    v6 += d;
    cx += d * (p[a] + p[b] + p[c]);
    cy += d * (p[a + 1] + p[b + 1] + p[c + 1]);
    cz += d * (p[a + 2] + p[b + 2] + p[c + 2]);
  }
  const volume = v6 / 6;
  return { volume, com: Math.abs(v6) > 1e-9 ? [cx / (4 * v6), cy / (4 * v6), cz / (4 * v6)] : [NaN, NaN, NaN] };
}

function surfaceCentroid(p: Float64Array, idx: ArrayLike<number>, areas: Float64Array, total: number): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (let t = 0; t < areas.length; t++) {
    for (let k = 0; k < 3; k++) {
      const v = idx[t * 3 + k] * 3;
      c[0] += (areas[t] * p[v]) / 3; c[1] += (areas[t] * p[v + 1]) / 3; c[2] += (areas[t] * p[v + 2]) / 3;
    }
  }
  return total > 0 ? [c[0] / total, c[1] / total, c[2] / total] : [0, 0, 0];
}

function hullOf(p: Float64Array): { points: Float64Array; faces: HullFace[] } {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < p.length; i += 3) pts.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
  const hull = new ConvexHull();
  try {
    hull.setFromPoints(pts);
  } catch {
    // Puntos coplanares o degenerados: sin caras del casco, se usa la nube completa para la huella.
    return { points: p, faces: [] };
  }
  // `hull.vertices` trae toda la nube: los vértices del casco son los de sus caras.
  const used = new Set<THREE.Vector3>();
  const faces = hull.faces.map((f) => {
    const loop: number[] = [];
    let e = f.edge;
    do { loop.push(e.vertex.point.x, e.vertex.point.y, e.vertex.point.z); used.add(e.vertex.point); e = e.next; } while (e !== f.edge);
    return { normal: [f.normal.x, f.normal.y, f.normal.z] as Vec3, area: f.area, loop };
  });
  const points = new Float64Array(used.size * 3);
  let i = 0;
  for (const v of used) { points[i++] = v.x; points[i++] = v.y; points[i++] = v.z; }
  return { points: points.length >= 12 ? points : p, faces };
}

/** Prepara la pieza en mundo. Lanza `MESH_EMPTY` si no tiene triángulos. */
export function prepareOrientWorld(input: OrientInput): OrientWorld {
  const positions = worldPositions(input);
  const indices = input.mesh.indices;
  if (indices.length < 3 || positions.length < 9) throw new EngineError('MESH_EMPTY');
  const mass = massProperties(positions, indices);
  const geo = faceGeometry({ positions, indices }, mass.volume < 0 ? -1 : 1);
  const com = Number.isFinite(mass.com[0]) ? mass.com : surfaceCentroid(positions, indices, geo.areas, geo.totalArea);
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const hull = hullOf(positions);
  return {
    positions, indices, normals: geo.normals, areas: geo.areas, totalArea: geo.totalArea,
    volume: Math.abs(mass.volume), com, diag: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ),
    hullPoints: hull.points, hullFaces: hull.faces,
  };
}
