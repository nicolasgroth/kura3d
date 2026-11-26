/**
 * @file src/components/dialogs/PlateExportOptions.tsx
 * @description Opciones de exportación con piezas en dos o más placas (lote P6): en 3MF, un archivo con todas las
 * placas (Bambu Studio / OrcaSlicer las separan) o un 3MF por placa en un ZIP; en los demás formatos, un archivo
 * por placa en un ZIP (único camino: no tienen placas). Explica qué laminadores entienden cada una y cuántas piezas
 * sin placa quedan fuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import type { ExportFormat } from '../../store/modelIoActions';
import type { PlateExportMode } from '../../store/plateExportFlow';
import type { LanguageCode } from '../../types/kura';

export const PlateExportOptions: React.FC<{
  language: LanguageCode;
  format: ExportFormat;
  plateCount: number;
  excluded: number;
  mode: PlateExportMode;
  onChange: (mode: PlateExportMode) => void;
}> = ({ language, format, plateCount, excluded, mode, onChange }) => {
  const name = useId();
  const hintCombined = useId();
  const hintPerPlate = useId();
  return (
    <fieldset className="kura-export-scope">
      <legend>{t(language, 'dialog.export.plates.legend', { count: plateCount })}</legend>
      {format === '3mf' ? (
        <>
          <label>
            <input type="radio" name={name} checked={mode === 'combined'} onChange={() => onChange('combined')} aria-describedby={hintCombined} />
            {t(language, 'dialog.export.plates.combined')}
          </label>
          <p id={hintCombined} className="kura-export-info">{t(language, 'dialog.export.plates.combined.hint')}</p>
          <label>
            <input type="radio" name={name} checked={mode === 'perPlate'} onChange={() => onChange('perPlate')} aria-describedby={hintPerPlate} />
            {t(language, 'dialog.export.plates.perPlate')}
          </label>
          <p id={hintPerPlate} className="kura-export-info">{t(language, 'dialog.export.plates.perPlate.hint')}</p>
        </>
      ) : (
        <p className="kura-export-info">{t(language, 'dialog.export.plates.onlyZip', { format: format.toUpperCase() })}</p>
      )}
      {excluded > 0 && <p className="kura-export-info" role="note">{t(language, 'dialog.export.plates.excluded', { count: excluded })}</p>}
    </fieldset>
  );
};
