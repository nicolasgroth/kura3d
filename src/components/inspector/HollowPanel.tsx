/**
 * @file src/components/inspector/HollowPanel.tsx
 * @description Panel Ahuecar (hollow) del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { type InspectorSectionProps } from './inspectorTypes';

/** Ahuecar con grosor de pared y orificio de drenaje. */
export const HollowPanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const { wallThicknessMm, setWallThicknessMm, drainHole, setDrainHole, drainRadiusMm, setDrainRadiusMm } = ui;
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const showInteriorSection = useKuraStore((s) => s.showInteriorSection);
  const isBusy = Boolean(busyOperation);

  return (
    <div className="kura-form-field">
      <div className="kura-field-row">
        <label>{t(language, 'inspector.op.hollowTitle')}</label>
        <PrecisionNumberInput
          style={{ width: 92 }}
          min={0.8}
          max={12}
          step={0.2}
          precision={1}
          defaultValue={2.2}
          suffix="mm"
          value={wallThicknessMm}
          onChange={setWallThicknessMm}
          ariaLabel={t(language, 'inspector.op.wallThickness')}
        />
      </div>
      <input
        type="range"
        min={0.8}
        max={12}
        step={0.2}
        value={wallThicknessMm}
        aria-label={t(language, 'inspector.op.wallThickness')}
        title={t(language, 'ui.sliderResetTip')}
        onDoubleClick={() => setWallThicknessMm(2.2)}
        onChange={(e) => setWallThicknessMm(Number(e.target.value))}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
        <input
          type="checkbox"
          checked={drainHole}
          onChange={(e) => setDrainHole(e.target.checked)}
        />
        <span>{t(language, 'inspector.op.drainHole')}</span>
      </label>
      {drainHole && (
        <div className="kura-field-row">
          <span className="kura-field-label">{t(language, 'inspector.op.drainRadius')}</span>
          <PrecisionNumberInput
            style={{ width: 94 }}
            min={1}
            max={25}
            step={0.5}
            precision={1}
            defaultValue={4}
            suffix="mm"
            value={drainRadiusMm}
            onChange={setDrainRadiusMm}
            ariaLabel={t(language, 'inspector.op.drainRadius')}
          />
        </div>
      )}
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        disabled={isBusy || primary.locked}
        onClick={() =>
          void hollowObject(primary.id, {
            enabled: true,
            wallThickness: wallThicknessMm,
            drainHole,
            drainHoleRadius: drainRadiusMm,
          })
        }
      >
        {t(language, 'inspector.op.applyHollow')}
      </button>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={isBusy}
        title={t(language, 'hollowView.showTip')}
        onClick={() => showInteriorSection(primary.id)}
      >
        {t(language, 'hollowView.show')}
      </button>
    </div>
  );
};
