/**
 * @file src/components/settings/SplitSettings.tsx
 * @description Sección "División y uniones" de Ajustes: conector por defecto, holgura por defecto y valor
 * inicial de "Reforzar uniones débiles". Son preferencias del usuario (se guardan en este equipo); el panel
 * de división y el corte por plano las toman al abrirse. Usa `setSplitPrefs` del store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { OPERATION_RANGES } from '../../engine/operationLimits';
import { SPLIT_PREF_CONNECTORS, type SplitPrefConnector } from '../../store/splitPreferences';
import { FALLBACK_CONNECTOR_SIZE_MM } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import '../../styles/statusMeasures.css';

/** Clave de i18n del nombre de cada tipo de unión (las mismas del panel de división). */
export const SPLIT_PREF_CONNECTOR_LABEL: Record<SplitPrefConnector, string> = {
  auto: 'split.joint.auto',
  lap: 'split.joint.lap',
  none: 'dialog.cut.connector.none',
  dowel: 'dialog.cut.connector.dowel',
  peg: 'dialog.cut.connector.peg',
  dovetail: 'dialog.cut.connector.dovetail',
  'loose-dowel': 'split.joint.looseDowel',
};

export const SplitSettings: React.FC<{ idPrefix: string }> = ({ idPrefix }) => {
  const language = useKuraStore((s) => s.language);
  const prefs = useKuraStore((s) => s.splitPrefs);
  const setSplitPrefs = useKuraStore((s) => s.setSplitPrefs);
  const range = OPERATION_RANGES.cut.tolerance;

  return (
    <div className="kura-measures-fields" role="group" aria-labelledby={`${idPrefix}-title`}>
      <strong id={`${idPrefix}-title`} style={{ fontSize: 13 }}>{t(language, 'settings.split.title')}</strong>
      <span id={`${idPrefix}-help`} className="kura-measures-help">{t(language, 'settings.split.help')}</span>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-connector`}>{t(language, 'settings.split.connector')}</label>
        <select
          id={`${idPrefix}-connector`}
          className="kura-select"
          value={prefs.connectorType}
          aria-describedby={`${idPrefix}-help`}
          title={t(language, 'settings.split.connector')}
          onChange={(e) => setSplitPrefs({ connectorType: e.target.value as SplitPrefConnector })}
        >
          {SPLIT_PREF_CONNECTORS.map((type) => (
            <option key={type} value={type}>{t(language, SPLIT_PREF_CONNECTOR_LABEL[type] as Parameters<typeof t>[1])}</option>
          ))}
        </select>
      </div>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-size-auto`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id={`${idPrefix}-size-auto`}
            type="checkbox"
            checked={prefs.connectorSize === 'auto'}
            aria-describedby={`${idPrefix}-size-help`}
            title={t(language, 'split.size.autoTip')}
            onChange={(e) => setSplitPrefs({ connectorSize: e.target.checked ? 'auto' : FALLBACK_CONNECTOR_SIZE_MM })}
          />
          <span>{t(language, 'settings.split.size')}: {t(language, 'settings.split.sizeAuto')}</span>
        </label>
        {prefs.connectorSize !== 'auto' && (
          <>
            <label className="kura-field-label" htmlFor={`${idPrefix}-size`}>{t(language, 'settings.split.sizeValue')}</label>
            <PrecisionNumberInput
              id={`${idPrefix}-size`}
              ariaLabel={t(language, 'settings.split.sizeValue')}
              title={t(language, 'split.size.help')}
              min={2 * OPERATION_RANGES.cut.connectorSize.min}
              max={100}
              step={1}
              precision={1}
              value={2 * prefs.connectorSize}
              onChange={(v) => setSplitPrefs({ connectorSize: v / 2 })}
            />
          </>
        )}
        <span id={`${idPrefix}-size-help`} className="kura-measures-help">{t(language, 'settings.split.sizeHelp')}</span>
      </div>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-tolerance`}>{t(language, 'settings.split.tolerance')}</label>
        <PrecisionNumberInput
          id={`${idPrefix}-tolerance`}
          ariaLabel={t(language, 'settings.split.tolerance')}
          title={t(language, 'settings.split.toleranceHelp')}
          min={range.min}
          max={range.max}
          step={0.05}
          precision={2}
          value={prefs.tolerance}
          onChange={(v) => setSplitPrefs({ tolerance: v })}
        />
        <span id={`${idPrefix}-tolerance-help`} className="kura-measures-help">{t(language, 'settings.split.toleranceHelp')}</span>
      </div>
      <div className="kura-measures-field">
        <label className="kura-field-label" htmlFor={`${idPrefix}-reinforce`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id={`${idPrefix}-reinforce`}
            type="checkbox"
            checked={prefs.reinforceWeakJoints}
            aria-describedby={`${idPrefix}-reinforce-help`}
            title={t(language, 'split.reinforceTip')}
            onChange={(e) => setSplitPrefs({ reinforceWeakJoints: e.target.checked })}
          />
          <span>{t(language, 'settings.split.reinforce')}</span>
        </label>
        <span id={`${idPrefix}-reinforce-help`} className="kura-measures-help">
          {t(language, 'settings.split.reinforceHelp')} {t(language, 'split.reinforceHelp')}
        </span>
      </div>
    </div>
  );
};
