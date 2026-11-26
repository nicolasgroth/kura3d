/**
 * @file src/core/addons/addonNames.ts
 * @description Nombres de los agregados (alojamiento de imán, poste y agujero de la torreta, ojo de cerradura y paso
 * de cable) en un idioma, con
 * el menor número libre entre los nombres ya usados («Imán 5 × 2», «Imán 5 × 2 (2)»…). Una sola fuente para el store
 * de la app y el MCP sin interfaz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { freeName } from './addonNeighbors';
import type { CablePassParams } from './cablePass';
import type { KeyholeParams } from './keyhole';
import type { MagnetParams } from './magnetPocket';
import { magnetSizeLabel } from './magnetPresets';
import type { ScrewBossParams } from './screwBoss';
import { formatMm, metricLabel } from './screwBossPresets';

/** Nombre libre del negativo de un imán. */
export function magnetPocketName(params: MagnetParams, language: LanguageCode, taken: ReadonlySet<string>): string {
  return freeName(taken, t(language, 'magnet.objectName', { size: magnetSizeLabel(params, language) }));
}

/** Nombres libres del poste y del agujero de una torreta. */
export function screwBossNames(params: ScrewBossParams, language: LanguageCode, taken: ReadonlySet<string>): { post: string; hole: string } {
  const size = metricLabel(params.nominalMm, language);
  return {
    post: freeName(taken, t(language, params.type === 'insert' ? 'turret.objectName.insert' : 'turret.objectName.screw', { size })),
    hole: freeName(taken, t(language, 'turret.objectName.hole', { size, d: formatMm(params.holeDiameterMm, language) })),
  };
}

/** Nombre libre del negativo de un ojo de cerradura («Ojo de cerradura 4 mm»). */
export function keyholeName(params: Pick<KeyholeParams, 'screwMm'>, language: LanguageCode, taken: ReadonlySet<string>): string {
  return freeName(taken, t(language, 'keyhole.objectName', { size: formatMm(params.screwMm, language) }));
}

/** Nombre libre del negativo de un paso de cable («Paso de cable Ø 5» o «Paso de cable 8 × 4»). */
export function cablePassName(params: Pick<CablePassParams, 'shape' | 'widthMm' | 'lengthMm'>, language: LanguageCode, taken: ReadonlySet<string>): string {
  const size = params.shape === 'slot'
    ? `${formatMm(params.lengthMm, language)} × ${formatMm(params.widthMm, language)}`
    : `Ø ${formatMm(params.widthMm, language)}`;
  return freeName(taken, t(language, 'cable.objectName', { size }));
}
