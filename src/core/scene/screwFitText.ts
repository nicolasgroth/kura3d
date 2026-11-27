/**
 * @file src/core/scene/screwFitText.ts
 * @description Texto del resultado de la comprobación de enroscado en el idioma pedido: «Enrosca: holgura mínima X mm»,
 * holgura insuficiente o interferencia con su volumen. Lo usan el asistente (antes y después de crear) y el diálogo de
 * roscas emparejadas, con el mismo número que devuelven el bus y el MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { LanguageCode } from '../../types/kura';

export interface ScrewFitSummary {
  readonly status: 'ok' | 'tight' | 'interference';
  readonly minClearanceMm: number;
  readonly maxInterferenceMm3: number;
  /** `press`: acople a presión («Encaja…» en vez de «Enrosca…»). */
  readonly joint?: 'thread' | 'press';
}

export function screwFitText(fit: ScrewFitSummary, lang: LanguageCode): string {
  const press = fit.joint === 'press';
  if (fit.status === 'interference') {
    return t(lang, press ? 'pressFit.interference' : 'screwFit.interference', { mm3: formatLocaleNumber(lang, fit.maxInterferenceMm3, { maxFrac: fit.maxInterferenceMm3 < 10 ? 2 : 0 }) });
  }
  const mm = formatLocaleNumber(lang, fit.minClearanceMm, { maxFrac: 2, minFrac: 2 });
  if (press) return t(lang, fit.status === 'ok' ? 'pressFit.ok' : 'pressFit.tight', { mm });
  return t(lang, fit.status === 'ok' ? 'screwFit.ok' : 'screwFit.tight', { mm });
}
