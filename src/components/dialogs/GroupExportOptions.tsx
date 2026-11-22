/**
 * @file src/components/dialogs/GroupExportOptions.tsx
 * @description Opciones de exportación con un grupo seleccionado: un archivo con todo el grupo (por
 * defecto) o un archivo por objeto en un ZIP con los nombres del árbol.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';

export const GroupExportOptions: React.FC<{
  language: LanguageCode;
  groupName: string;
  perObject: boolean;
  onChange: (perObject: boolean) => void;
}> = ({ language, groupName, perObject, onChange }) => {
  const name = useId();
  return (
    <fieldset className="kura-export-scope">
      <legend>{t(language, 'groups.export.legend', { name: groupName })}</legend>
      <label>
        <input type="radio" name={name} checked={!perObject} onChange={() => onChange(false)} />
        {t(language, 'groups.export.single')}
      </label>
      <label>
        <input type="radio" name={name} checked={perObject} onChange={() => onChange(true)} />
        {t(language, 'groups.export.perObject')}
      </label>
    </fieldset>
  );
};
