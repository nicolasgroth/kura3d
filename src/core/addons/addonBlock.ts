/**
 * @file src/core/addons/addonBlock.ts
 * @description Bloqueos que impiden colocar un agregado (no son avisos): un alojamiento de imán que ocuparía casi
 * toda la pieza (la resta la haría desaparecer) o cuya boca es más ancha que la pieza en esa cara, y una torreta cuyo
 * pie es más ancho que la zona de apoyo. Regla única para el store de la app y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { MAX_POCKET_FILL } from './pocketAnalysis';

/** `tooBig`: el hueco ocupa casi toda la pieza; `spansFace`: la boca sale por lados opuestos; `tooWide`: torreta. */
export type AddonBlockReason = 'tooBig' | 'spansFace' | 'tooWide';

/** Motivo por el que el imán no se coloca, o null si se puede colocar. */
export function magnetBlockReason(made: { fill: number; spansFace: boolean }): AddonBlockReason | null {
  if (made.fill > MAX_POCKET_FILL) return 'tooBig';
  return made.spansFace ? 'spansFace' : null;
}

/** Clave i18n del error de cada bloqueo (la misma que muestra la app). */
export const ADDON_BLOCK_KEY = {
  tooBig: 'magnet.error.tooBig',
  spansFace: 'magnet.error.tooBig',
  tooWide: 'turret.error.tooWide',
} as const satisfies Record<AddonBlockReason, string>;
