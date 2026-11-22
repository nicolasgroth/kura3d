/**
 * @file src/components/inspector/IdentitySection.tsx
 * @description Sección Identidad del inspector: nombre, material PBR y color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PRINT_COLOR_PALETTE, type MaterialPresetId } from '../../types/kura';
import { colorName, colorNameWithHex } from '../../utils/colorNames';
import { MATERIAL_IDS } from './inspectorConstants';
import { type InspectorSectionProps } from './inspectorTypes';

/** Sección 1: identidad, material PBR y color. */
export const IdentitySection: React.FC<Pick<InspectorSectionProps, 'primary'>> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const setObjectMaterial = useKuraStore((s) => s.setObjectMaterial);
  const currentMaterial = primary.materialPreset ?? 'pla_matte';

  return (
    <section className="kura-card">
      <h3 className="kura-section-label">{t(language, 'inspector.section.identity')}</h3>

      <div className="kura-form-field">
        <label htmlFor="kura-obj-name">{t(language, 'inspector.field.name')}</label>
        <input
          id="kura-obj-name"
          className="kura-input"
          value={primary.name}
          onChange={(e) => updateObjectMeta(primary.id, { name: e.target.value })}
        />
      </div>

      <div className="kura-field-row">
        <span className="kura-field-label">{t(language, 'inspector.field.role')}</span>
        <div className="kura-segmented">
          <button
            type="button"
            className={`kura-btn ${!primary.isHole ? 'is-active' : ''}`}
            onClick={() => updateObjectMeta(primary.id, { isHole: false })}
          >
            {t(language, 'inspector.role.solid')}
          </button>
          <button
            type="button"
            className={`kura-btn ${primary.isHole ? 'is-active' : ''}`}
            onClick={() => updateObjectMeta(primary.id, { isHole: true })}
            title={t(language, 'inspector.role.holeTip')}
          >
            {t(language, 'inspector.role.hole')}
          </button>
        </div>
      </div>

      <div className="kura-form-field">
        <label htmlFor="kura-obj-material">{t(language, 'material.title')}</label>
        <select
          id="kura-obj-material"
          className="kura-select"
          value={currentMaterial}
          onChange={(e) =>
            setObjectMaterial(primary.id, e.target.value as MaterialPresetId)
          }
        >
          {MATERIAL_IDS.map((matId) => (
            <option key={matId} value={matId}>
              {t(language, `material.${matId}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="kura-form-field">
        <label>{t(language, 'inspector.field.color')}</label>
        <div className="kura-swatch-row">
          {PRINT_COLOR_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`kura-swatch ${primary.color === hex ? 'is-active' : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => updateObjectMeta(primary.id, { color: hex })}
              aria-label={colorName(language, hex)}
              aria-pressed={primary.color === hex}
              title={colorNameWithHex(language, hex)}
            />
          ))}
          <input
            type="color"
            className="kura-swatch-custom"
            value={primary.color}
            onChange={(e) => updateObjectMeta(primary.id, { color: e.target.value })}
            aria-label={t(language, 'inspector.field.color')}
            title={t(language, 'inspector.field.color')}
          />
        </div>
      </div>
    </section>
  );
};
