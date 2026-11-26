/**
 * @file src/components/viewmode/ViewModeBedChip.tsx
 * @description Chip del pie del visor en Armado y Libre, en lugar de «Cama: <impresora>»: dice que en esta vista no hay
 * cama ni se evalúa «Fuera de volumen» (eso ocurre en Imprimir) y, al pulsarlo, vuelve a Imprimir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { BedDouble } from 'lucide-react';
import { t } from '../../i18n';
import { requestViewMode } from '../../store/viewModeRequest';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewMode.css';

export const ViewModeBedChip: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const tip = t(language, 'viewMode.bedChip.tip');
  return (
    <button
      type="button"
      className="kura-hud-card kura-hud-pill-nowrap kura-viewmode-bedchip"
      data-testid="viewmode-bed-chip"
      title={tip}
      aria-label={`${t(language, 'viewMode.bedChip')}. ${tip}`}
      onClick={() => requestViewMode('print')}
    >
      <BedDouble size={12} aria-hidden="true" />
      <span>{t(language, 'viewMode.bedChip')}</span>
    </button>
  );
};
