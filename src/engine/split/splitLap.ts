/**
 * @file src/engine/split/splitLap.ts
 * @description Solape de borde ("machihembrado") para uniones de pared delgada donde no cabe una
 * espiga: por cada isla de la sección de contacto se calcula su ancho típico w (2·área/perímetro, el
 * espesor exacto de un anillo o una lámina) y con `offset` de `CrossSection` (manifold-3d) se arma
 * una lengüeta por la línea media de la pared (tercio central, ancho w/3) que sale de la pieza baja,
 * y una ranura en la pieza alta igual a la lengüeta crecida por la holgura en cada lado y en el fondo.
 * Las paredes de la ranura quedan de w/3 − holgura. Sigue el contorno real (anillos, láminas curvas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import { ASSEMBLY_LIMITS } from '../operationLimits';
import { islandWidth } from './splitSections';
import { orientedToWorld } from './splitLabels';
import type { SplitAxis } from './splitTypes';

/** Lengüeta y cada pared de la ranura, como mínimo imprimible (mm). */
const MIN_PRINTABLE_MM = ASSEMBLY_LIMITS.minPrintableWallMm;

/**
 * Offset con esquinas en inglete y contorno simplificado: el redondeo deja vértices a menos de 1 µm
 * que, al soldar la malla, producen aristas sueltas.
 */
function cleanOffset(cs: CrossSection, delta: number): CrossSection {
  const off = cs.offset(delta, 'Miter', 2);
  const out = off.simplify(0.005);
  off.delete();
  return out;
}

export interface LapSolids {
  /** Lengüeta (a sumar a la pieza baja), en mundo. */
  tongue: Manifold;
  /** Ranura (a restar a la pieza alta), en mundo. */
  groove: Manifold;
  islands: number;
  /** Ancho de lengüeta más chico usado (mm). */
  tongueMm: number;
}

/** Islas sin solape porque no sería imprimible: medidas que habría tenido la más delgada. */
export interface LapRejection {
  islands: number;
  tongueMm: number;
  grooveWallMm: number;
}

/**
 * Lengüeta y ranura para las islas dadas (sección orientada: plano del eje en z' = `coord`). Devuelve
 * `null` si ninguna isla tiene ancho suficiente. El llamador libera lo devuelto; no libera `islands`.
 */
export function buildLapSolids(
  wasm: ManifoldToplevel,
  islands: CrossSection[],
  axis: SplitAxis,
  coord: number,
  heightMm: number,
  clearanceMm: number,
  rejected?: LapRejection,
): LapSolids | null {
  const tongues: CrossSection[] = [];
  const grooves: CrossSection[] = [];
  let tongueMm = Infinity;
  try {
    for (const island of islands) {
      const w = islandWidth(island);
      // Lengüeta y paredes de ranura iguales: w = lengüeta + 2·holgura + 2·pared
      const tongueW = (w - 2 * clearanceMm) / 3;
      const inset = (w - tongueW) / 2;
      const grooveWall = inset - clearanceMm;
      if (tongueW < MIN_PRINTABLE_MM || grooveWall < MIN_PRINTABLE_MM) {
        if (rejected) {
          rejected.islands++;
          rejected.tongueMm = Math.min(rejected.tongueMm, tongueW);
          rejected.grooveWallMm = Math.min(rejected.grooveWallMm, grooveWall);
        }
        continue;
      }
      const t = cleanOffset(island, -inset);
      if (t.isEmpty() || t.area() < 0.25 * island.area() * (1 / 3)) {
        t.delete();
        continue;
      }
      tongues.push(t);
      grooves.push(cleanOffset(island, -grooveWall));
      tongueMm = Math.min(tongueMm, tongueW);
    }
    if (tongues.length === 0) return null;
    const tUnion = wasm.CrossSection.union(tongues);
    const gUnion = wasm.CrossSection.union(grooves);
    // La lengüeta entra 0,3 mm en la pieza baja: unión robusta aunque el giro deje un error de redondeo
    const tLocal = tUnion.extrude(heightMm + 0.3).translate([0, 0, coord - 0.3]);
    // La ranura arranca bajo el plano (fuera de la pieza alta) y es más honda por la holgura
    const gLocal = gUnion.extrude(heightMm + clearanceMm + 0.5).translate([0, 0, coord - 0.5]);
    tUnion.delete();
    gUnion.delete();
    const tongue = orientedToWorld(tLocal, axis);
    const groove = orientedToWorld(gLocal, axis);
    tLocal.delete();
    gLocal.delete();
    return { tongue, groove, islands: tongues.length, tongueMm };
  } finally {
    for (const h of [...tongues, ...grooves]) h.delete();
  }
}
