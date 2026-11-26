/**
 * @file src/components/split/jointFirmnessUi.tsx
 * @description Piezas visuales compartidas de la firmeza de las uniones (firme, regular, débil, para pegar): icono y
 * texto de cada nivel (el estado nunca depende solo del color), textos de motivos y medidas con los números ya
 * formateados, y el manejo de teclado de una lista de uniones (flechas, Inicio y Fin).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { AlertTriangle, Paperclip, ShieldCheck, ShieldHalf } from 'lucide-react';
import { t } from '../../i18n';
import type { FirmnessCounts, FirmnessFact, JointFirmness } from '../../core/scene/jointFirmness';
import { FIRMNESS_ORDER, firmnessMeasures } from '../../core/scene/jointFirmness';
import { SPLIT_JOINT_WALL_MM } from '../../engine/split/splitJointStrength';
import type { LanguageCode, SplitJointRecordStrength } from '../../types/kura';
import { formatNumber, tCount } from '../../utils/plural';

export const FIRMNESS_ICON: Record<JointFirmness, React.ReactNode> = {
  firm: <ShieldCheck size={12} aria-hidden="true" />,
  fair: <ShieldHalf size={12} aria-hidden="true" />,
  weak: <AlertTriangle size={12} aria-hidden="true" />,
  glue: <Paperclip size={12} aria-hidden="true" />,
};

/** Insignia de un nivel: icono y palabra (el color solo refuerza). */
export const FirmnessBadge: React.FC<{ language: LanguageCode; level: JointFirmness; testId?: string }> = ({ language, level, testId }) => (
  <span className="kura-firmness-badge" data-firmness={level} data-testid={testId}>
    {FIRMNESS_ICON[level]} {t(language, `jointFirmness.level.${level}`)}
  </span>
);

/** Texto de un motivo o dato (`jointFirmness.fact.*`) con sus números formateados para el idioma. */
export function factText(language: LanguageCode, fact: FirmnessFact): string {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(fact.params)) params[k] = formatNumber(language, v, { maximumFractionDigits: 1 });
  return t(language, `jointFirmness.fact.${fact.key}`, params);
}

/** «2 × Ø6 mm, entra 8 mm; pared mínima 1,2 mm.»; `null` si la unión no lleva conector ni imán. */
export function measuresText(language: LanguageCode, strength: SplitJointRecordStrength): string | null {
  const m = firmnessMeasures(strength);
  if (!m) return null;
  const f = (n: number) => formatNumber(language, n, { maximumFractionDigits: 1 });
  return t(language, m.magnet ? 'jointFirmness.measures.magnet' : 'jointFirmness.measures.connector', {
    count: m.count, d: f(m.diameterMm), depth: f(m.depthMm), wall: f(SPLIT_JOINT_WALL_MM),
  });
}

/** «6 uniones: 4 firmes, 1 regular, 1 para pegar» (solo los niveles que tienen alguna). */
export function firmnessSentence(language: LanguageCode, counts: FirmnessCounts): string {
  const parts = FIRMNESS_ORDER.filter((l) => counts[l] > 0)
    .map((l) => tCount(language, { one: `jointFirmness.count.${l}.one`, other: `jointFirmness.count.${l}.other` }, counts[l]))
    .join(', ');
  return tCount(language, { one: 'jointFirmness.sum.one', other: 'jointFirmness.sum.other' }, counts.total, { parts });
}

/** Flechas arriba/abajo, Inicio y Fin pasan el foco entre los elementos `selector` de la lista. */
export function onFirmnessListKey(e: React.KeyboardEvent<HTMLElement>, selector: string): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  if (!(e.target instanceof Element) || !e.target.matches(selector)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector));
  const at = items.indexOf(e.target as HTMLElement);
  if (items.length === 0 || at < 0) return;
  e.preventDefault();
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
  items[next]?.focus();
}
