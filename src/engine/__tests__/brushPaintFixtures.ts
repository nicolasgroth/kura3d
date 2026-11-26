/**
 * @file src/engine/__tests__/brushPaintFixtures.ts
 * @description Mallas pintadas con el pincel real (con "refinar al pintar") para las pruebas de
 * "separar por colores": trazos irregulares sobre cilindro, esfera y texto 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { paintMeshFacesInSphere } from '../paint/brush';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';

export const WHITE = '#ffffff';
export const RED = '#ff0000';

export function brushObj(mesh: MeshData): SceneObject {
  return {
    id: 'o', name: 'o', source: 'primitive', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: WHITE, role: 'solid', visible: true, locked: false, mesh, stats: computeMeshStats(mesh),
  };
}

/** Aplica un trazo de pincel (con refinado del borde) muestra a muestra, como la app. */
export function strokeOn(mesh: MeshData, samples: Vec3[], radius: number): MeshData {
  let o = brushObj(mesh);
  for (const c of samples) o = { ...o, mesh: paintMeshFacesInSphere(o, c, radius, RED, { refineEdge: true }) };
  return o.mesh;
}

/** Cilindro Ø28×36 con un trazo ondulado en la pared (eje Y, base en y = 0). */
export async function paintedCylinder(): Promise<MeshData> {
  const cyl = await createPrimitiveMesh('cylinder', { radius: 14, height: 36 });
  const samples: Vec3[] = [];
  for (let k = 0; k <= 14; k++) {
    const ang = 0.35 * Math.sin(k * 0.9) + k * 0.04;
    samples.push([14 * Math.cos(ang), 8 + k * 1.4, 14 * Math.sin(ang)]);
  }
  return strokeOn(cyl, samples, 3.2);
}

/** Esfera r = 15 con un trazo ondulado cerca del polo superior. */
export async function paintedSphere(): Promise<MeshData> {
  const sphere = await createPrimitiveMesh('sphere', { radius: 15, segments: 48 });
  const samples: Vec3[] = [];
  for (let k = 0; k <= 12; k++) {
    const th = 0.5 + k * 0.08, ph = 0.3 * Math.sin(k);
    samples.push([15 * Math.cos(ph) * Math.sin(th), 15 + 15 * Math.cos(th), 15 * Math.sin(ph) * Math.sin(th)]);
  }
  return strokeOn(sphere, samples, 3);
}

/** Texto 3D "K3" con un trazo ondulado sobre su cara superior. */
export async function paintedText(): Promise<MeshData> {
  const text = await createPrimitiveMesh('text', { text: 'K3', fontSize: 20, depth: 5 });
  const P = text.positions;
  let maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    maxY = Math.max(maxY, P[i + 1]); minX = Math.min(minX, P[i]); maxX = Math.max(maxX, P[i]);
    minZ = Math.min(minZ, P[i + 2]); maxZ = Math.max(maxZ, P[i + 2]);
  }
  const samples: Vec3[] = [];
  for (let k = 0; k <= 10; k++) samples.push([minX + (maxX - minX) * (0.1 + k * 0.08), maxY, (minZ + maxZ) / 2 + 2 * Math.sin(k)]);
  return strokeOn(text, samples, 2.5);
}
