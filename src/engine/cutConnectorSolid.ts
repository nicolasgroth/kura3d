/**
 * @file src/engine/cutConnectorSolid.ts
 * @description Sólido de un conector del corte por plano (dowel, peg, dovetail) orientado al eje de
 * corte. Lo comparten el corte por plano (`operations.ts`) y la división para la cama (`split/`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { CutConnectorType, Vec3 } from '../types/kura';

/**
 * Construye una pieza conectora individual orientada según el eje de corte.
 * El conector sobresale hacia +normal desde `cutCoord` hasta `cutCoord + depth`
 * con un anclaje de -0.5 mm embebido dentro de la mitad negativa para evitar caras coplanares.
 */
export function buildConnectorSolid(
  wasm: ManifoldToplevel,
  type: Exclude<CutConnectorType, 'none'>,
  axis: 'x' | 'y' | 'z',
  worldCenter: Vec3,
  size: number,
  depth: number,
  expandTolerance: number
): Manifold {
  const r = Math.max(0.4, size + expandTolerance);
  const h = Math.max(0.8, depth + expandTolerance);
  const embed = 0.5;
  const totalLen = h + embed;

  const tempHandles: Array<{ delete: () => void }> = [];
  try {
    let localZ: Manifold;

    if (type === 'dowel') {
      const raw = wasm.Manifold.cylinder(totalLen, r, r, 24, false);
      tempHandles.push(raw);
      localZ = raw.translate([0, 0, -embed]);
      tempHandles.push(localZ);
    } else if (type === 'peg') {
      // Clavija cuadrada ligeramente cónica en la punta para facilitar el encastre manual
      const cs = wasm.CrossSection.square([r * 1.8, r * 1.8], true);
      tempHandles.push(cs);
      const extruded = cs.extrude(totalLen, 0, 0, [0.85, 0.85], false);
      tempHandles.push(extruded);
      localZ = extruded.translate([0, 0, -embed]);
      tempHandles.push(localZ);
    } else {
      // Dovetail (cola de milano): trapecio en XZ extruido en espesor Y y reorientado al eje de corte
      const neckHalf = Math.max(0.35, size * 0.55) + expandTolerance;
      const headHalf = Math.max(0.55, size * 0.95) + expandTolerance;
      const thick = Math.max(0.8, size * 1.3 + expandTolerance * 2);

      const profile: [number, number][] = [
        [-neckHalf, -embed],
        [neckHalf, -embed],
        [neckHalf, 0],
        [headHalf, h],
        [-headHalf, h],
        [-neckHalf, 0],
      ];
      const cs = wasm.CrossSection.ofPolygons([profile], 'Positive');
      tempHandles.push(cs);
      const extruded = cs.extrude(thick, 0, 0, [1, 1], true);
      tempHandles.push(extruded);
      // El perfil tiene su profundidad en el eje 2D +Y, así que rotamos +90° en X para que apunte a +Z
      localZ = extruded.rotate([90, 0, 0]);
      tempHandles.push(localZ);
    }

    let oriented: Manifold;
    if (axis === 'z') {
      oriented = localZ;
    } else if (axis === 'y') {
      // Rotar -90° en X lleva +Z a +Y
      oriented = localZ.rotate([-90, 0, 0]);
      tempHandles.push(oriented);
    } else {
      // Rotar +90° en Y lleva +Z a +X
      oriented = localZ.rotate([0, 90, 0]);
      tempHandles.push(oriented);
    }

    return oriented.translate(worldCenter);
  } finally {
    for (const handle of tempHandles) {
      handle.delete();
    }
  }
}
