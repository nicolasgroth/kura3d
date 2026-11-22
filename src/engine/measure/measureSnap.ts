/**
 * @file src/engine/measure/measureSnap.ts
 * @description Imán de la herramienta de medir: dado el punto tocado sobre una cara, propone el
 * vértice, el punto medio de arista o el centro de la cara plana más cercano dentro de un radio.
 * Puro (sin three.js); el visor convierte el radio de píxeles a mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { getFaceAdjacency } from '../paint/faceAdjacency';
import { measureRegionArea } from './measureGeometry';

export type SnapKind = 'vertex' | 'edge-mid' | 'face-center' | 'surface';

export interface SnapResult {
  point: Vec3;
  kind: SnapKind;
}

/** Una cara cuenta como plana para el centro si sus vecinas no se desvían más de esto. */
const PLANAR_DEG = 1;

/** Arista real (borde o pliegue), no una diagonal interna de la triangulación de una cara plana. */
function isFeatureEdge(mesh: MeshData, face: number, side: number): boolean {
  const { sideEdge, edgeStart, edgeTris, normals } = getFaceAdjacency(mesh);
  const e = sideEdge[face * 3 + side];
  const cosT = Math.cos((PLANAR_DEG * Math.PI) / 180);
  let others = 0;
  for (let j = edgeStart[e]; j < edgeStart[e + 1]; j++) {
    const nb = edgeTris[j];
    if (nb === face) continue;
    others++;
    const dot = normals[face * 3] * normals[nb * 3] + normals[face * 3 + 1] * normals[nb * 3 + 1] + normals[face * 3 + 2] * normals[nb * 3 + 2];
    if (dot < cosT) return true;
  }
  return others === 0;
}

const dist2 = (a: Vec3, b: Vec3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Punto de imán más cercano a `hit` sobre la cara `face` de `mesh` (ejes del mismo espacio que la
 * malla). Prioridad a igual distancia: vértice, punto medio, centro de cara. Si nada queda dentro de
 * `radiusMm`, devuelve el punto tocado.
 */
export function snapOnFace(mesh: MeshData, face: number, hit: Vec3, radiusMm: number): SnapResult {
  const P = mesh.positions, I = mesh.indices;
  if (face < 0 || face * 3 + 2 >= I.length) return { point: hit, kind: 'surface' };
  const v = [0, 1, 2].map((k) => {
    const i = I[face * 3 + k] * 3;
    return [P[i], P[i + 1], P[i + 2]] as Vec3;
  });
  const candidates: SnapResult[] = [
    ...v.map((p) => ({ point: p, kind: 'vertex' as const })),
    ...[0, 1, 2]
      .filter((k) => isFeatureEdge(mesh, face, k))
      .map((k) => {
        const a = v[k], b = v[(k + 1) % 3];
        return { point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as Vec3, kind: 'edge-mid' as const };
      }),
  ];
  const region = measureRegionArea(mesh, face, PLANAR_DEG);
  if (region.faces.length > 0) candidates.push({ point: region.centroid, kind: 'face-center' });
  const r2 = radiusMm * radiusMm;
  let best: SnapResult | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = dist2(c.point, hit);
    if (d <= r2 && d < bestD - 1e-9) {
      best = c;
      bestD = d;
    }
  }
  return best ?? { point: hit, kind: 'surface' };
}
