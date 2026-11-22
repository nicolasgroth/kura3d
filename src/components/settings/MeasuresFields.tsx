/**
 * @file src/components/settings/MeasuresFields.tsx
 * @description Selectores de unidad de medida e impresora esperada, compartidos por Ajustes y el popover
 * de la barra de estado. Usan las acciones del store (setUnitSystem, setPrinterProfile).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { getLocalizedPrinterName, t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { DEFAULT_PRINTER_PROFILES, type UnitSystem } from '../../types/kura';
import '../../styles/statusMeasures.css';

export const UNIT_OPTIONS: UnitSystem[] = ['mm', 'cm', 'm', 'in', 'ft'];

export const MeasuresFields: React.FC<{
  idPrefix: string;
  showHelp?: boolean;
  unitRef?: React.Ref<HTMLSelectElement>;
  printerRef?: React.Ref<HTMLSelectElement>;
}> = ({ idPrefix, showHelp = false, unitRef, printerRef }) => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const setUnitSystem = useKuraStore((s) => s.setUnitSystem);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const setPrinterProfile = useKuraStore((s) => s.setPrinterProfile);

  return (
    <div className="kura-measures-fields">
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-unit`}>
          {t(language, 'dialog.settings.unitLabel')}
        </label>
        <select
          id={`${idPrefix}-unit`}
          ref={unitRef}
          className="kura-select"
          value={unitSystem}
          onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
          aria-describedby={showHelp ? `${idPrefix}-unit-help` : undefined}
          title={t(language, 'dialog.settings.unitLabel')}
        >
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        {showHelp && (
          <span id={`${idPrefix}-unit-help`} className="kura-measures-help">
            {t(language, 'dialog.settings.unitHelp')}
          </span>
        )}
      </div>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-printer`}>
          {t(language, 'dialog.settings.printerLabel')}
        </label>
        <select
          id={`${idPrefix}-printer`}
          ref={printerRef}
          className="kura-select"
          value={printerProfile.id}
          onChange={(e) => setPrinterProfile(e.target.value)}
          aria-describedby={showHelp ? `${idPrefix}-printer-help` : undefined}
          title={getLocalizedPrinterName(language, printerProfile)}
        >
          {DEFAULT_PRINTER_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {getLocalizedPrinterName(language, profile)}
            </option>
          ))}
        </select>
        {showHelp && (
          <span id={`${idPrefix}-printer-help`} className="kura-measures-help">
            {t(language, 'dialog.settings.printerHelp')}
          </span>
        )}
      </div>
    </div>
  );
};
