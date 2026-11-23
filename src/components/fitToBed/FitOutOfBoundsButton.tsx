/**
 * @file src/components/fitToBed/FitOutOfBoundsButton.tsx
 * @description Botón «Ajustar a la impresora…» junto al aviso «Fuera de volumen» del pie del visor:
 * abre el diálogo con la selección o, sin selección, con los objetos que se salen de la cama.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { checkObjectsOutOfBounds } from '../viewport/viewportHelpers';

export const FitOutOfBoundsButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = () => {
    const { objects, selectedIds, printerProfile, openFitToBed } = useKuraStore.getState();
    const outside = objects.filter((o) => !o.isHole && o.visible && checkObjectsOutOfBounds([o], printerProfile)).map((o) => o.id);
    openFitToBed(selectedIds.length > 0 ? selectedIds : outside);
  };
  return (
    <button type="button" className="kura-oob-fit" onClick={open} title={t(language, 'fit.openTip')} data-testid="oob-fit">
      {t(language, 'fit.outOfBoundsAction')}
    </button>
  );
};
