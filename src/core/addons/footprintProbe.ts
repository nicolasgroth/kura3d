/**
 * @file src/core/addons/footprintProbe.ts
 * @description Huella de un agregado con sección «estadio» sobre una cara (ojo de cerradura, paso de cable): en
 * `FOOTPRINT_DIRECTIONS` direcciones alrededor de su centro se mira si bajo el borde de la huella (agrandado
 * `offsetMm`) hay pieza, con puntos a media profundidad dentro del material (paridad de rayos). Con eso: la huella
 * sale de la pieza por lados opuestos (es más ancha que la cara: mismo criterio que `spansFace` del imán), se asoma
 * por un borde o queda a menos de cierta distancia de él. También si otro agregado (malla de mundo) queda a menos de
 * `gapMm` del sólido de la huella. Funciones puras; corren en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { fromLocal, toLocal, type UprightFrame } from './faceFrame';
import { insideMesh } from './meshRays';
import { stadiumPlaneDistance, stadiumReach } from './stadiumMesh';

/** Direcciones de muestreo alrededor del centro de la huella (pares opuestas: k y k + N/2). */
export const FOOTPRINT_DIRECTIONS = 16;

export interface StadiumFootprint {
  /** Centro de la huella sobre el plano de la cara (mundo). */
  center: Vec3;
  frame: Pick<UprightFrame, 'axis' | 'x' | 'z'>;
  /** Radio de la sección (medio ancho). */
  radius: number;
  /** Medio tramo recto sobre X local. */
  halfStraight: number;
}

/**
 * Por dirección, true si bajo el borde de la huella agrandado `offsetMm` no hay pieza: ni a 0,5 × ni a 0,9 ×
 * `depthMm` bajo la cara. `depthMm` debe ser menor que el espesor de la pieza en ese punto.
 */
export function footprintOff(world: MeshData, fp: StadiumFootprint, offsetMm: number, depthMm: number): boolean[] {
  const out: boolean[] = [];
  const r = fp.radius + offsetMm;
  for (let k = 0; k < FOOTPRINT_DIRECTIONS; k++) {
    const angle = (k * 2 * Math.PI) / FOOTPRINT_DIRECTIONS;
    const reach = stadiumReach(r, fp.halfStraight, angle);
    const lx = Math.cos(angle) * reach, lz = Math.sin(angle) * reach;
    const inside = [0.5, 0.9].some((f) => insideMesh(world, fromLocal(fp.frame, fp.center, [lx, -f * depthMm, lz])));
    out.push(!inside);
  }
  return out;
}

/** Sale de la pieza en direcciones opuestas: la huella es más ancha que la cara en esa zona. */
export const spansOpposite = (off: readonly boolean[]): boolean => {
  const half = off.length / 2;
  return off.some((e, k) => e && off[(k + half) % off.length]);
};

/**
 * Algún agregado de `others` queda a menos de `gapMm` del sólido de la huella (de `yMin` a `yMax` sobre el eje,
 * en coordenadas locales). Mira los vértices de cada malla y si puntos de la huella caen dentro de ella.
 */
export function nearOtherMeshes(fp: StadiumFootprint, yMin: number, yMax: number, gapMm: number, others: readonly MeshData[]): boolean {
  if (others.length === 0) return false;
  const samples: Vec3[] = [];
  for (const f of [0.1, 0.5, 0.9]) {
    const y = yMin + f * (yMax - yMin);
    samples.push(fromLocal(fp.frame, fp.center, [0, y, 0]));
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4;
      const reach = stadiumReach(fp.radius + gapMm * 0.9, fp.halfStraight, angle);
      samples.push(fromLocal(fp.frame, fp.center, [Math.cos(angle) * reach, y, Math.sin(angle) * reach]));
    }
  }
  for (const other of others) {
    if (samples.some((s) => insideMesh(other, s))) return true;
    const pos = other.positions;
    for (let i = 0; i + 2 < pos.length; i += 3) {
      const [x, y, z] = toLocal(fp.frame, fp.center, [pos[i], pos[i + 1], pos[i + 2]]);
      if (y < yMin - gapMm || y > yMax + gapMm) continue;
      if (stadiumPlaneDistance(x, z, fp.radius, fp.halfStraight) < gapMm) return true;
    }
  }
  return false;
}
