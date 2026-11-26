/**
 * @file src/components/split/SplitJointStrengthNotes.tsx
 * @description Medidas reales (conector o imán, profundidad y pared mínima) y motivos de firmeza de una unión ya
 * dividida, para el detalle plegable de la sección "Uniones" del inspector. Lee `SplitJointRecord.strength`; con el
 * mismo vocabulario del resumen previo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Info } from 'lucide-react';
import { firmnessFacts } from '../../core/scene/jointFirmness';
import type { SplitJointRow } from '../../core/scene/splitJointStatus';
import type { LanguageCode } from '../../types/kura';
import { factText, measuresText } from './jointFirmnessUi';

/** Textos de firmeza de una fila; vacío si el proyecto no guardó la firmeza. */
export function strengthNotes(language: LanguageCode, row: Pick<SplitJointRow, 'strength' | 'weak' | 'status'>): { measures: string | null; facts: string[] } {
  if (!row.strength) return { measures: null, facts: [] };
  const facts = firmnessFacts({ strength: row.strength, weak: row.weak })
    // Una unión pegada ya dice «para pegar» en su propia nota
    .filter((f) => !(row.status === 'glue' && f.key === 'noConnector'))
    .map((f) => factText(language, f));
  return { measures: measuresText(language, row.strength), facts };
}

export const SplitJointStrengthNotes: React.FC<{ language: LanguageCode; row: SplitJointRow; testId?: string }> = ({ language, row, testId }) => {
  const { measures, facts } = strengthNotes(language, row);
  if (!measures && facts.length === 0) return null;
  return (
    <div className="kura-firmness-body" data-testid={testId}>
      {measures && (
        <p className="kura-split-joint-note kura-firmness-measures" data-kind="info">
          <Info size={12} aria-hidden="true" />
          <span>{measures}</span>
        </p>
      )}
      {facts.length > 0 && (
        <ul className="kura-firmness-facts">
          {facts.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
    </div>
  );
};
