/**
 * @file src/components/split/SplitLabelsToggle.tsx
 * @description Casilla "Mostrar rótulos de pieza" del visor de Dividir (activa por defecto; la preferencia se
 * recuerda en este navegador). Se usa en el panel Dividir y en el control de armado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/splitLabels.css';

export const SplitLabelsToggle: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const on = useKuraStore((s) => s.splitLabels);
  const set = useKuraStore((s) => s.setSplitLabels);
  return (
    <label className="kura-split-check kura-split-labels-toggle" title={t(language, 'ux4.labels.showTip')}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>{t(language, 'ux4.labels.show')}</span>
    </label>
  );
};
