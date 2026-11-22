/**
 * @file src/components/split/SplitExportOptions.tsx
 * @description Opciones del diálogo de exportación cuando hay piezas de una división: "Un archivo
 * por pieza (ZIP)" y, para 3MF, "Un 3MF con todas las piezas en su disposición de impresión".
 * Son excluyentes; sin marcar, se exporta como siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { splitPartFileName } from '../../core/scene/splitGroups';
import type { SplitExportMode } from '../../store/splitExport';
import { useKuraStore } from '../../store/useKuraStore';

export const SplitExportOptions: React.FC<{
  format: string;
  base: string;
  firstCode: string;
  value: SplitExportMode | null;
  onChange: (mode: SplitExportMode | null) => void;
}> = ({ format, base, firstCode, value, onChange }) => {
  const language = useKuraStore((s) => s.language);
  const is3mf = format === '3mf';
  return (
    <fieldset className="kura-export-scope kura-split-export">
      <legend>{t(language, 'split.title')}</legend>
      <label title={t(language, 'export.split.perPieceTip', { name: splitPartFileName(base, firstCode, format) })}>
        <input
          type="checkbox"
          checked={value === 'perPiece'}
          onChange={(e) => onChange(e.target.checked ? 'perPiece' : null)}
        />
        {t(language, 'export.split.perPiece')}
      </label>
      <label title={t(language, 'export.split.printLayoutTip')}>
        <input
          type="checkbox"
          checked={is3mf && value === 'printLayout'}
          disabled={!is3mf}
          onChange={(e) => onChange(e.target.checked ? 'printLayout' : null)}
        />
        {t(language, 'export.split.printLayout')}
      </label>
    </fieldset>
  );
};
