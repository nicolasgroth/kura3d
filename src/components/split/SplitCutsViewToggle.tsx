/**
 * @file src/components/split/SplitCutsViewToggle.tsx
 * @description Conmutador de la vista previa de "Dividir para imprimir": «Mostrar cortes» dibuja los planos sobre la
 * pieza; «Solo las piezas» los oculta (con sus rótulos) para ver el resultado. Dos opciones de radio con nombre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';

export const SplitCutsViewToggle: React.FC<{ language: LanguageCode }> = ({ language }) => {
  const show = useKuraStore((s) => s.splitShowCuts);
  const setShow = useKuraStore((s) => s.setSplitShowCuts);
  const name = useId();
  return (
    <fieldset className="kura-split-group">
      <legend>{t(language, 'split.view.legend')}</legend>
      <div className="kura-split-modes" role="radiogroup" aria-label={t(language, 'split.view.legend')}>
        <label className="kura-split-check">
          <input type="radio" name={name} checked={show} onChange={() => setShow(true)} />
          <span>{t(language, 'split.view.showCuts')}</span>
        </label>
        <label className="kura-split-check">
          <input type="radio" name={name} checked={!show} onChange={() => setShow(false)} />
          <span>{t(language, 'split.view.onlyParts')}</span>
        </label>
      </div>
    </fieldset>
  );
};
