/**
 * @file src/engine/svgContourPack.ts
 * @description Contornos SVG ya leídos (grupos → anillos → puntos 2D) empaquetados en vistas
 * tipadas para viajar al Worker del motor como buffers transferibles, y su desempaquetado. Los
 * contornos se leen en el hilo principal porque `THREE.SVGLoader` necesita `DOMParser`, que el
 * Worker no tiene; la extrusión con Manifold corre en el Worker.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export type SvgContourGroups = [number, number][][][];

export interface PackedSvgContours {
  /** Coordenadas x,y consecutivas de todos los puntos. */
  coords: Float64Array;
  /** Puntos de cada anillo, en orden. */
  ringSizes: Uint32Array;
  /** Anillos de cada grupo, en orden. */
  groupSizes: Uint32Array;
}

export function packSvgContours(groups: SvgContourGroups): PackedSvgContours {
  let points = 0;
  let rings = 0;
  for (const g of groups) {
    rings += g.length;
    for (const r of g) points += r.length;
  }
  const coords = new Float64Array(points * 2);
  const ringSizes = new Uint32Array(rings);
  const groupSizes = new Uint32Array(groups.length);
  let p = 0;
  let ri = 0;
  groups.forEach((g, gi) => {
    groupSizes[gi] = g.length;
    for (const r of g) {
      ringSizes[ri++] = r.length;
      for (const [x, y] of r) {
        coords[p++] = x;
        coords[p++] = y;
      }
    }
  });
  return { coords, ringSizes, groupSizes };
}

/** Inverso de `packSvgContours`. Lanza si los tamaños no calzan con las coordenadas. */
export function unpackSvgContours(packed: PackedSvgContours): SvgContourGroups {
  const { coords, ringSizes, groupSizes } = packed;
  const groups: SvgContourGroups = [];
  let p = 0;
  let ri = 0;
  for (let gi = 0; gi < groupSizes.length; gi++) {
    const group: [number, number][][] = [];
    for (let k = 0; k < groupSizes[gi]; k++) {
      if (ri >= ringSizes.length) throw new RangeError('Packed SVG contours: ring count mismatch');
      const n = ringSizes[ri++];
      if (p + n * 2 > coords.length) throw new RangeError('Packed SVG contours: coordinate count mismatch');
      const ring: [number, number][] = new Array(n);
      for (let i = 0; i < n; i++, p += 2) ring[i] = [coords[p], coords[p + 1]];
      group.push(ring);
    }
    groups.push(group);
  }
  return groups;
}
