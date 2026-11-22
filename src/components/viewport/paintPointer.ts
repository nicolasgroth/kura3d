/**
 * @file src/components/viewport/paintPointer.ts
 * @description Puente entre el puntero del visor y el pincel: arma la consulta del pincel en
 * coordenadas locales (centro, cámara para pintar solo caras de frente, cara bajo el puntero) y
 * acelera el raycast de mallas grandes con un BVH (three-mesh-bvh, MIT) mientras se pinta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect, type RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH, type MeshBVHOptions } from 'three-mesh-bvh';
import type { BrushQuery } from '../../engine/paint/brushSelect';
import type { MeshData, Vec3 } from '../../types/kura';
import { longestEdgeMm } from '../../utils/paintCoarseness';

/** `indirect` existe en three-mesh-bvh 0.8 aunque sus tipos no lo declaran. */
export const PAINT_BVH_OPTIONS = { indirect: true } as MeshBVHOptions;

/**
 * Con el borde fino activo, se subdivide (camino por muestra, más lento) si alguna arista de la malla
 * supera esta fracción del radio: basta una cara gruesa para que la mancha deje de tener la forma del
 * pincel (tras refinar una zona, la mediana engaña). En mallas finas el borde ya sigue el círculo.
 */
export const REFINE_EDGE_TRIANGLE_RATIO = 0.5;

/** El trazo necesita subdividir el borde (no puede ir por el camino en vivo). */
export function strokeNeedsEdgeRefine(refineEdge: boolean, mesh: MeshData, scale: Vec3, radiusMm: number): boolean {
  return refineEdge && longestEdgeMm(mesh.positions, mesh.indices, scale) > radiusMm * REFINE_EDGE_TRIANGLE_RATIO;
}

/** Bajo este tamaño el raycast normal ya es rápido y no vale la pena construir el BVH. */
const BVH_MIN_TRIANGLES = 20_000;

const tmpInverse = new THREE.Matrix4();
const tmpVec = new THREE.Vector3();

const toVec3 = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Consulta del pincel para el evento del puntero sobre `mesh` (con su escala de objeto). */
export function brushQueryFromEvent(e: ThreeEvent<PointerEvent>, mesh: THREE.Mesh, scale: Vec3, radiusMm: number): BrushQuery {
  const center = toVec3(mesh.worldToLocal(e.point.clone()));
  const camera = e.camera;
  const query: BrushQuery = { center, radiusMm, scale, seedFace: e.faceIndex ?? null };
  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    tmpInverse.copy(mesh.matrixWorld).invert();
    query.viewDir = toVec3(camera.getWorldDirection(tmpVec).transformDirection(tmpInverse));
  } else {
    query.eye = toVec3(mesh.worldToLocal(camera.getWorldPosition(tmpVec)));
  }
  return query;
}

type BvhGeometry = THREE.BufferGeometry & { boundsTree?: MeshBVH };

/**
 * Mientras `enabled`, la malla usa raycast con BVH (una sola construcción por geometría): el puntero
 * deja de recorrer todos los triángulos en cada movimiento.
 */
export function usePaintRaycastAcceleration(meshRef: RefObject<THREE.Mesh | null>, geometry: THREE.BufferGeometry, enabled: boolean): void {
  useEffect(() => {
    const mesh = meshRef.current;
    if (!enabled || !mesh) return;
    const position = geometry.getAttribute('position');
    const triangles = geometry.index ? geometry.index.count / 3 : (position?.count ?? 0) / 3;
    if (triangles < BVH_MIN_TRIANGLES) return;
    const g = geometry as BvhGeometry;
    // Modo indirecto: no toca el índice ni el orden de los triángulos (faceIndex sigue siendo el original).
    if (!g.boundsTree) g.boundsTree = new MeshBVH(geometry, PAINT_BVH_OPTIONS);
    mesh.raycast = acceleratedRaycast;
    return () => {
      mesh.raycast = THREE.Mesh.prototype.raycast;
    };
  }, [meshRef, geometry, enabled]);
}
