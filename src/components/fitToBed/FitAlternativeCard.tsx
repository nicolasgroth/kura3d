/**
 * @file src/components/fitToBed/FitAlternativeCard.tsx
 * @description Tarjeta de opción de "Ajustar a la impresora" (radio nativo dentro del radiogroup):
 * título con el factor, tamaño resultante, giro, cara apoyada si cambia, marca de sugerida y avisos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import type { FitAlternative } from '../../engine/fitToBed';
import { useKuraStore } from '../../store/useKuraStore';
import { useFitFormat } from './fitFormat';

export const FitAlternativeCard: React.FC<{ alt: FitAlternative; name: string; checked: boolean; onChoose: () => void }> = ({
  alt, name, checked, onChoose,
}) => {
  const language = useKuraStore((s) => s.language);
  const fmt = useFitFormat();
  const descId = useId();
  const detail = alt.kind === 'split'
    ? t(language, 'fit.alt.splitDesc')
    : [`→ ${fmt.size(alt.sizeMm)}`, fmt.steps(alt), alt.changesDownFace ? fmt.face(alt) : ''].filter(Boolean).join(' · ');
  return (
    <label className="kura-fit-option" data-testid={`fit-alt-${alt.kind}`}>
      <input type="radio" name={name} checked={checked} onChange={onChoose} aria-describedby={descId} />
      <span className="kura-fit-option-title">
        {fmt.title(alt)}
        {alt.recommended && <span className="kura-fit-badge">{t(language, 'fit.alt.recommended')}</span>}
      </span>
      <span id={descId} className="kura-fit-option-detail">
        {detail}
        {alt.warnings.length > 0 && (
          <span className="kura-fit-warnings">
            {alt.warnings.map((w, i) => (
              <span key={i} className="kura-fit-warning">{fmt.warning(w)}</span>
            ))}
          </span>
        )}
      </span>
    </label>
  );
};
