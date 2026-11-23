/**
 * @file src/components/viewport/BedToggleButton.tsx
 * @description Conmutador «Sin cama» de la barra de vistas del visor: oculta la cama (rejilla, placa,
 * rótulo y volumen de impresión) y las sombras de contacto para ver las piezas flotando. Estado con
 * `aria-pressed` y con texto e icono propios (no solo color); atajo B.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Grid2x2X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/ux6.css';
import '../../styles/bedHiddenChip.css';

export const BedToggleButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const showBed = useKuraStore((s) => s.showBed);
  const toggleShowBed = useKuraStore((s) => s.toggleShowBed);
  const tip = t(language, 'ux6.bed.toggleTip');
  return (
    <button
      type="button"
      className={`kura-btn kura-btn-sm kura-bed-toggle ${showBed ? '' : 'is-active'}`}
      aria-pressed={!showBed}
      aria-keyshortcuts="B"
      title={tip}
      aria-label={t(language, 'ux6.bed.toggle')}
      data-testid="bed-toggle"
      onClick={toggleShowBed}
    >
      <Grid2x2X size={13} aria-hidden="true" />
      <span className="kura-hud-label-wide">{t(language, 'ux6.bed.toggle')}</span>
    </button>
  );
};
