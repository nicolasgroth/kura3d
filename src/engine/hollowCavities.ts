/**
 * @file src/engine/hollowCavities.ts
 * @description Selección de las cavidades reales del ahuecado: de las componentes del offset interior
 * se conservan las que valen la pena y las bolsas diminutas (umbral en `OPERATION_DEFAULTS.hollow`)
 * quedan macizas, sin cáscara propia ni orificio de drenaje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { OPERATION_DEFAULTS } from './operationLimits';

export interface CavitySelection {
  /** Cavidades conservadas (componentes de `inner`, del llamador liberarlas). */
  kept: Manifold[];
  /** Cavidad a sustraer: `inner` si no se descartó nada; si no, la composición de las conservadas. */
  carve: Manifold;
  /** Bolsas descartadas (quedan macizas). */
  discarded: number;
}

/** true si la cavidad es una bolsa que no se ahueca (ver `OPERATION_DEFAULTS.hollow`). */
export function isNegligibleCavity(volume: number, size: readonly number[], largestVolume: number): boolean {
  const { minCavityFraction, minCavityNozzleMm } = OPERATION_DEFAULTS.hollow;
  return volume < minCavityFraction * largestVolume || Math.min(...size) < minCavityNozzleMm;
}

/**
 * Parte `inner` en sus componentes, quita la basura numérica (`junk`) y las bolsas diminutas, y arma
 * la cavidad a sustraer. `own` registra cada Manifold creado para liberarlo después.
 */
export function selectCavities(
  wasm: ManifoldToplevel,
  inner: Manifold,
  junk: number,
  own: <T extends Manifold>(m: T) => T,
): CavitySelection {
  const parts = inner.decompose().map((c) => own(c)).filter((c) => Math.abs(c.volume()) > junk);
  const largest = Math.max(0, ...parts.map((c) => Math.abs(c.volume())));
  const kept = parts.filter((c) => {
    const box = c.boundingBox();
    const size = [0, 1, 2].map((k) => box.max[k] - box.min[k]);
    return !isNegligibleCavity(Math.abs(c.volume()), size, largest);
  });
  const discarded = parts.length - kept.length;
  // Componentes disjuntas de volumen positivo: `compose` las junta sin booleana.
  const carve = discarded === 0 ? inner : own(wasm.Manifold.compose(kept));
  return { kept, carve, discarded };
}
