/**
 * @file src/components/inspector/SimplifyDeviationNote.tsx
 * @description Advertencia del informe de Simplificar cuando la desviación medida supera la tolerancia pedida o usada
 * («La desviación medida (1,48 mm) supera la tolerancia pedida (0,10 mm)»). La tolerancia guía la reducción pero no es
 * un tope: lo que se movió la superficie se mide y se dice. En la vista previa va en condicional.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { t } from '../../i18n';
import { simplifyMm } from '../../i18n/simplifyNumbers';
import type { LanguageCode } from '../../types/kura';

/** true si la desviación medida supera la tolerancia (más allá del ruido de redondeo). */
export function deviationExceedsTolerance(deviationMm: number, toleranceMm: number): boolean {
  return Number.isFinite(deviationMm) && Number.isFinite(toleranceMm) && deviationMm > toleranceMm * 1.0001 + 1e-9;
}

interface Props {
  language: LanguageCode;
  deviationMm: number;
  tolerance: { kind: 'asked' | 'used'; mm: number };
  preview?: boolean;
}

export const SimplifyDeviationNote: React.FC<Props> = ({ language, deviationMm, tolerance, preview = false }) => {
  if (!deviationExceedsTolerance(deviationMm, tolerance.mm)) return null;
  const key = preview
    ? (tolerance.kind === 'asked' ? 'simplify.preview.deviationOverAsked' : 'simplify.preview.deviationOverUsed')
    : (tolerance.kind === 'asked' ? 'simplify.report.deviationOverAsked' : 'simplify.report.deviationOverUsed');
  return (
    <p className="kura-simplify-notice" role="note" data-testid="simplify-deviation-over">
      <AlertTriangle size={14} aria-hidden="true" />
      <span>{t(language, key, { mm: simplifyMm(language, deviationMm), tol: simplifyMm(language, tolerance.mm) })}</span>
    </p>
  );
};
