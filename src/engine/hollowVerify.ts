/**
 * @file src/engine/hollowVerify.ts
 * @description Verificación posterior del ahuecado y cota única de "pared máxima": el ahuecado nunca
 * informa éxito si el volumen no bajó lo que mide la cavidad o si la pared medida no se parece a la
 * pedida (p. ej. la cavidad casi nula que dejaba una malla autointersecada). La cota de pared es la
 * misma que muestra el panel antes de aplicar (`estimateHollowWall`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { EngineError } from './engineErrors';
import { estimateHollowWall, type WallThicknessStats } from './solidOffset';

/** Pared máxima esperada (mm, 1 decimal) para una caja `size` y pared `thickness`: aviso y panel. */
export function hollowMaxWallMm(size: readonly number[], thickness: number): number {
  return Math.round(estimateHollowWall(size, thickness).maxWallMm * 10) / 10;
}

export interface HollowCheckInput {
  thickness: number;
  /** Volumen del sólido antes de ahuecar (mm³). */
  volumeBefore: number;
  /** Volumen del resultado, con drenajes si los hay (mm³). */
  volumeAfter: number;
  /** Volumen de la cavidad sustraída (mm³). */
  cavityVolume: number;
  wall: WallThicknessStats;
  /** Pared máxima esperada por la rejilla (mm). */
  expectedMaxWallMm: number;
}

/**
 * Lanza `HOLLOW_INEFFECTIVE` si el resultado no es un ahuecado coherente:
 * - la cavidad es despreciable frente a la pieza (< 0,1 % del volumen);
 * - el volumen no bajó al menos el 90 % de la cavidad (la resta no tuvo efecto);
 * - la pared media medida supera holgadamente la máxima esperada (la cavidad quedó muy adentro).
 */
export function assertHollowEffective(c: HollowCheckInput): void {
  const removed = c.volumeBefore - c.volumeAfter;
  const wallBound = Math.max(c.expectedMaxWallMm, c.thickness * 1.5) + 0.05;
  const tinyCavity = !(c.cavityVolume > 1e-3 * Math.max(1, c.volumeBefore));
  const noEffect = !(removed >= 0.9 * c.cavityVolume);
  const tooDeep = !(c.wall.meanMm <= wallBound);
  if (tinyCavity || noEffect || tooDeep) {
    throw new EngineError('HOLLOW_INEFFECTIVE', {
      thickness: c.thickness,
      measured: Math.round(c.wall.meanMm * 10) / 10,
      removedPct: c.volumeBefore > 0 ? Math.round((1000 * Math.max(0, removed)) / c.volumeBefore) / 10 : 0,
    });
  }
}
