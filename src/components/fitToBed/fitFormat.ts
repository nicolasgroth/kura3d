/**
 * @file src/components/fitToBed/fitFormat.ts
 * @description Formato de "Ajustar a la impresora": tamaños X × Y × Z en la unidad activa, porcentajes
 * con la coma o el punto del idioma, título de cada alternativa, pasos de giro y avisos traducidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { FitAlternative, FitWarning } from '../../engine/fitToBed';
import { useKuraStore } from '../../store/useKuraStore';
import { formatDimension } from '../../utils/units';
import type { Vec3 } from '../../types/kura';

export function useFitFormat() {
  const language = useKuraStore((s) => s.language);
  const unit = useKuraStore((s) => s.unitSystem);
  const objects = useKuraStore((s) => s.objects);
  const num = (v: number, maxFrac = 1) => formatLocaleNumber(language, v, { maxFrac });
  // Hacia abajo: el porcentaje mostrado nunca promete más de lo que cabe.
  const pct = (factor: number) => num(Math.floor(factor * 1000 + 1e-6) / 10, 1);
  // El motor de ajuste ya entrega X, Y, Z del usuario: no se pasa por `toUserSize` (permutaría otra vez).
  const size = (s: Readonly<Vec3>) => {
    const [x, y, z] = s.map((v) => formatDimension(v, unit, 1, language));
    return `${x} × ${y} × ${z}`;
  };
  const title = (alt: FitAlternative) => {
    if (alt.kind === 'scale') return t(language, 'fit.alt.scale', { pct: pct(alt.factor) });
    if (alt.kind === 'rotateScale') return t(language, 'fit.alt.rotateScale', { pct: pct(alt.factor) });
    return t(language, alt.kind === 'rotate' ? 'fit.alt.rotate' : 'fit.alt.split');
  };
  /** Nombre sin porcentaje (para las opciones no disponibles). */
  const name = (alt: FitAlternative) =>
    alt.kind === 'rotateScale' ? t(language, 'fit.alt.rotateScaleName') : alt.kind === 'scale' ? t(language, 'fit.alt.scale', { pct: 100 }) : title(alt);
  const steps = (alt: FitAlternative) =>
    alt.orientation.steps.length === 0
      ? t(language, 'fit.alt.noRotation')
      : alt.orientation.steps.map((s) => t(language, 'fit.step', { deg: s.deg, axis: s.axis.toUpperCase() })).join(', ');
  const face = (alt: FitAlternative) =>
    t(language, 'fit.downFace', { face: t(language, `fit.face.${alt.orientation.downFace}` as TranslationKey) });
  const warning = (w: FitWarning) => {
    const p = w.params;
    const name = objects.find((o) => o.id === p.objectId)?.name ?? String(p.objectId ?? '');
    return t(language, `fit.warning.${w.code}` as TranslationKey, {
      pct: typeof p.factor === 'number' ? pct(p.factor) : '',
      wall: typeof p.wallMm === 'number' ? num(p.wallMm, 2) : '',
      min: typeof p.minFactor === 'number' ? pct(p.minFactor) : '',
      name,
      feature: typeof p.feature === 'string' ? t(language, `fit.feature.${p.feature}` as TranslationKey) : '',
      label: String(p.label ?? ''),
      nominal: typeof p.nominalMm === 'number' ? num(p.nominalMm, 2) : '',
      scaled: typeof p.scaledMm === 'number' ? num(p.scaledMm, 2) : '',
    });
  };
  return { num, pct, size, title, name, steps, face, warning };
}
