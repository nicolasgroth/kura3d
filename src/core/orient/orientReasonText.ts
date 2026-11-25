/**
 * @file src/core/orient/orientReasonText.ts
 * @description Frases de «Orientar para imprimir»: volumen legible y motivo del motor traducido. Funciones puras
 * sin React; las comparten el panel de la interfaz y los comandos (Command Bus / MCP) sin depender de componentes.
 * Los porcentajes se muestran en valor absoluto: el signo ya lo dice la frase («más baja», «menos soporte»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { OrientReason } from '../../engine/orient';
import { t } from '../../i18n';
import { formatLocaleNumber, formatQuantity } from '../../i18n/numberLocale';
import type { LanguageCode } from '../../types/kura';

/** Volumen en mm³ si es chico y en cm³ si no (1 cm³ = 1000 mm³). */
export function volumeText(language: LanguageCode, mm3: number): string {
  if (mm3 < 1000) return formatQuantity(language, Math.round(mm3), 'mm³');
  const cm3 = mm3 / 1000;
  return formatQuantity(language, cm3, 'cm³', { maxFrac: cm3 >= 100 ? 0 : 1 });
}

/** Motivo del motor como frase: la persona lee «82 % menos soporte que ahora», no una clave. */
export function reasonText(language: LanguageCode, reason: OrientReason): string {
  switch (reason.key) {
    case 'supportVsCurrent': {
      const percent = Math.round(Math.abs(reason.params.percent));
      return t(language, reason.params.percent < 0 ? 'orient.reason.supportLess' : 'orient.reason.supportMore', { percent });
    }
    case 'supportAdded':
      return t(language, 'orient.reason.supportAdded', { volume: volumeText(language, reason.params.volumeMm3) });
    case 'baseVsCurrent':
      return t(language, 'orient.reason.baseVsCurrent', { factor: formatLocaleNumber(language, reason.params.factor, { maxFrac: 1 }) });
    case 'lowerVsCurrent':
      return t(language, 'orient.reason.lowerVsCurrent', { percent: Math.round(Math.abs(reason.params.percent)) });
    case 'unstable':
      return t(language, 'orient.reason.unstable', { angle: formatLocaleNumber(language, reason.params.tipAngleDeg, { maxFrac: 1 }) });
    case 'noBase':
      return t(language, 'orient.reason.noBase');
    case 'current':
      return t(language, 'orient.reason.current');
    case 'noOverhangs':
      return t(language, 'orient.reason.noOverhangs');
    case 'equivalentToBest':
      return t(language, 'orient.reason.equivalentToBest');
    case 'doesNotFit':
      return t(language, 'orient.reason.doesNotFit');
  }
}
