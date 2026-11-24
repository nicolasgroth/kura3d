/**
 * @file src/store/__tests__/magnetTestKit.ts
 * @description Utilidades de las pruebas del alojamiento de imán con motor real: reinicio del store, malla de mundo,
 * elegir la cara que corta un rayo (punto y normal hacia afuera), contar cuerpos conexos y medir si la sección del
 * hueco quedó libre (sin láminas) tras aplicar las restas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { pocketFrame } from '../../core/addons/magnetPocket';
import { rayHits } from '../../core/addons/pocketWall';
import { applyTransformToMesh, computeMeshStats, initManifoldEngine } from '../../engine';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';

export async function resetMagnetStore() {
  await initManifoldEngine();
  useKuraStore.setState({
    engineReady: true, engineError: null, busyOperation: null, objects: [], groups: [], selectedIds: [], past: [], future: [],
    unitSystem: 'mm', language: 'es', toasts: [],
  });
}

export const store = () => useKuraStore.getState();
export const worldOf = (o: SceneObject) => applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale);
export const worldVolume = (o: SceneObject) => computeMeshStats(worldOf(o)).volumeMm3;
export const byId = (id: string) => store().objects.find((o) => o.id === id)!;

/** Centro de la caja de mundo. */
export function worldCenter(o: SceneObject): Vec3 {
  const p = worldOf(o).positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

/** Primer triángulo que corta el rayo: punto de corte y normal del triángulo (hacia afuera del sólido). */
export function pickFace(mesh: MeshData, origin: Vec3, dir: Vec3): { point: Vec3; normal: Vec3; face: number } {
  const p = mesh.positions, idx = mesh.indices;
  const o = new THREE.Vector3(...origin), d = new THREE.Vector3(...dir).normalize();
  const ray = new THREE.Ray(o, d);
  let best: { t: number; point: Vec3; normal: Vec3; face: number } | null = null;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(p, idx[t] * 3); b.fromArray(p, idx[t + 1] * 3); c.fromArray(p, idx[t + 2] * 3);
    if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
    const dist = hit.distanceTo(o);
    if (best && dist >= best.t) continue;
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    best = { t: dist, point: [hit.x, hit.y, hit.z], normal: [n.x, n.y, n.z], face: t / 3 };
  }
  if (!best) throw new Error('el rayo no corta la malla');
  return { point: best.point, normal: best.normal, face: best.face };
}

/** Cuerpos conexos (por vértices compartidos tras soldar posiciones). */
export function bodyCount(mesh: MeshData): number {
  const key = (i: number) => `${Math.round(mesh.positions[i * 3] * 1e4)},${Math.round(mesh.positions[i * 3 + 1] * 1e4)},${Math.round(mesh.positions[i * 3 + 2] * 1e4)}`;
  const ids = new Map<string, number>();
  const parent: number[] = [];
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const node = (v: number) => {
    const k = key(v);
    let id = ids.get(k);
    if (id === undefined) { id = parent.length; parent.push(id); ids.set(k, id); }
    return id;
  };
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [x, y, z] = [node(mesh.indices[t]), node(mesh.indices[t + 1]), node(mesh.indices[t + 2])];
    parent[find(y)] = find(x);
    parent[find(z)] = find(x);
  }
  return new Set(parent.map((_, i) => find(i))).size;
}

/**
 * Sección del hueco: desde puntos dentro del hueco (a `belowMm` bajo el plano de la cara, hasta `radiusMm` del eje)
 * se lanzan rayos hacia afuera por el eje. Devuelve la menor distancia al primer corte (una lámina daría < 1 mm) y si
 * algún punto de partida quedó dentro del material (hueco no abierto).
 */
export function pocketSectionClearance(world: MeshData, point: Vec3, normal: Vec3, radiusMm: number, belowMm: number) {
  const f = pocketFrame(normal)!;
  let minHit = Infinity;
  let blocked = false;
  for (const r of [0, 0.5, 0.95]) {
    for (let k = 0; k < (r === 0 ? 1 : 12); k++) {
      const ang = (k * Math.PI) / 6;
      const o: Vec3 = [0, 1, 2].map((i) => point[i] - f.axis[i] * belowMm + (f.u[i] * Math.cos(ang) + f.w[i] * Math.sin(ang)) * r * radiusMm) as Vec3;
      const hits = rayHits(world, o, f.axis);
      if (hits.length % 2 === 1) blocked = true;
      if (hits.length > 0) minHit = Math.min(minHit, hits[0] - belowMm);
    }
  }
  return { minHit, blocked };
}
