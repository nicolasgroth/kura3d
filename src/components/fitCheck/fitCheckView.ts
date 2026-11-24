/**
 * @file src/components/fitCheck/fitCheckView.ts
 * @description Presentación del informe de «Comprobar encaje» para el panel: orden de los pares por gravedad,
 * texto de la fase en curso (`prepare:i/n`, `pair:i/n`) con su fracción de avance, y la cifra de cada par
 * (volumen de choque o holgura) en el formato del idioma. Funciones puras, sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { FitCheckReport, FitPairResult, FitPairStatus } from '../../engine/fitCheck';
import type { LanguageCode } from '../../types/kura';

const RANK: Record<FitPairStatus, number> = { interferes: 0, tight: 1, ok: 2, far: 3 };

/** Pares del más grave al menos: choques por volumen, justos por holgura y luego el resto (orden estable). */
export function pairsBySeverity(pairs: readonly FitPairResult[]): FitPairResult[] {
  return pairs
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const r = RANK[x.p.status] - RANK[y.p.status];
      if (r !== 0) return r;
      if (x.p.status === 'interferes') return (y.p.interference?.volumeMm3 ?? 0) - (x.p.interference?.volumeMm3 ?? 0) || x.i - y.i;
      if (x.p.status === 'tight') return (x.p.clearanceMm ?? 0) - (y.p.clearanceMm ?? 0) || x.i - y.i;
      return x.i - y.i;
    })
    .map(({ p }) => p);
}

/** Clave estable de un par (para la lista y el resaltado). */
export const pairKey = (p: { aId: string; bId: string }) => `${p.aId}|${p.bId}`;

/** Texto y avance (0..1, o `null` si aún no se sabe) de una fase del motor. */
export function phaseView(language: LanguageCode, phase: string | null): { text: string; fraction: number | null } {
  const m = phase ? /^(prepare|pair):(\d+)\/(\d+)$/.exec(phase) : null;
  if (!m) return { text: t(language, 'fitCheck.ui.running'), fraction: null };
  const i = Number(m[2]);
  const n = Math.max(1, Number(m[3]));
  const key = m[1] === 'prepare' ? 'fitCheck.ui.phase.prepare' : 'fitCheck.ui.phase.pair';
  // Preparar pesa poco frente a revisar pares: se reparte 20 % / 80 % de la barra.
  const share = Math.min(1, i / n);
  return { text: t(language, key, { i, n }), fraction: m[1] === 'prepare' ? 0.2 * share : 0.2 + 0.8 * share };
}

/** Cifra principal de un par: volumen de choque, holgura medida o «más que el tope de búsqueda». */
export function pairFigure(language: LanguageCode, pair: FitPairResult, report: Pick<FitCheckReport, 'options'>): string {
  if (pair.status === 'interferes' && pair.interference) {
    const v = pair.interference.volumeMm3;
    return t(language, 'fitCheck.ui.pair.volume', { value: formatLocaleNumber(language, v, { maxFrac: v < 10 ? 2 : 1, grouping: true }) });
  }
  if (pair.clearanceMm === null) {
    return t(language, 'fitCheck.ui.pair.far', { value: formatLocaleNumber(language, report.options.searchMm) });
  }
  return t(language, 'fitCheck.ui.pair.clearance', { value: formatLocaleNumber(language, pair.clearanceMm, { maxFrac: 2, minFrac: 2 }) });
}

/** Nombre del peor par del resumen («A» y «B»), si lo hay. */
export function worstPairNames(language: LanguageCode, report: FitCheckReport): string | null {
  const worst = report.summary.worst;
  if (!worst) return null;
  const pair = report.pairs.find((p) => p.aId === worst.aId && p.bId === worst.bId);
  return pair ? t(language, 'fitCheck.ui.pair.names', { a: pair.aName, b: pair.bName }) : null;
}
