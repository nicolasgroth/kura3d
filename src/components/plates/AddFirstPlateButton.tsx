/**
 * @file src/components/plates/AddFirstPlateButton.tsx
 * @description Botón discreto «+ Placa» del pie del visor, junto al chip de la cama: es la única novedad visible con una
 * placa o ninguna (crea la segunda placa; desde ahí aparece la tira de placas y este botón se va). Solo existe con
 * menos de dos placas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/plateStrip.css';
import { requestChipFocus } from './plateChipFocus';

export const AddFirstPlateButton: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const count = useKuraStore((s) => s.plates.length);
  const busy = useKuraStore((s) => s.busyOperation !== null);
  const createPlate = useKuraStore((s) => s.createPlate);
  if (count >= 2) return null;
  return (
    <button
      type="button"
      className="kura-plate-first"
      onClick={() => { if (createPlate()) requestChipFocus(); }}
      disabled={busy}
      title={t(language, 'plates.addFirst.tip')}
      data-testid="plate-add-first"
    >
      {t(language, 'plates.addFirst')}
    </button>
  );
};
