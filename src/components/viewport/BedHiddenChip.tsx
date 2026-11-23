/**
 * @file src/components/viewport/BedHiddenChip.tsx
 * @description Chip del pie del visor cuando la cama está oculta («Sin cama»): reemplaza al chip «Cama: <impresora>
 * (medidas)» por un estado atenuado «Cama oculta» que, al pulsarlo, vuelve a mostrar la cama. Mientras la cama está
 * oculta no se muestra la alarma «Fuera de volumen» (el volumen no se ve); sigue calculándose y reaparece al volver.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { EyeOff } from 'lucide-react';
import { getLocalizedPrinterName, t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/bedHiddenChip.css';

export const BedHiddenChip: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const toggleShowBed = useKuraStore((s) => s.toggleShowBed);
  const tip = t(language, 'ux6.bed.hiddenChipTip', { printer: getLocalizedPrinterName(language, printerProfile) });
  return (
    <button
      type="button"
      className="kura-hud-card kura-hud-pill-nowrap kura-bed-hidden-chip"
      data-testid="bed-hidden-chip"
      aria-keyshortcuts="B"
      title={tip}
      aria-label={tip}
      onClick={toggleShowBed}
    >
      <EyeOff size={12} aria-hidden="true" />
      <span>{t(language, 'ux6.bed.hiddenChip')}</span>
    </button>
  );
};
