/**
 * @file src/components/inspector/TexturePanel.tsx
 * @description Panel de textura superficial del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { type TexturePatternType } from '../../types/kura';
import { type InspectorSectionProps } from './inspectorTypes';

/** Textura superficial. */
export const TexturePanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const { texturePattern, setTexturePattern, textureDepthMm, setTextureDepthMm, textureScaleMm, setTextureScaleMm } = ui;
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const applyTextureToObject = useKuraStore((s) => s.applyTextureToObject);
  const isBusy = Boolean(busyOperation);

  return (
    <div className="kura-form-field">
      <label htmlFor="kura-tex-pattern">{t(language, 'inspector.op.textureTitle')}</label>
      <select
        id="kura-tex-pattern"
        className="kura-select"
        value={texturePattern}
        onChange={(e) => setTexturePattern(e.target.value as TexturePatternType)}
      >
        <option value="fuzzy">{t(language, 'inspector.texture.fuzzy')}</option>
        <option value="knurling">{t(language, 'inspector.texture.knurling')}</option>
        <option value="waves">{t(language, 'inspector.texture.waves')}</option>
        <option value="honeycomb">{t(language, 'inspector.texture.honeycomb')}</option>
        <option value="grid">{t(language, 'inspector.texture.grid')}</option>
      </select>

      <div className="kura-slider-header">
        <span className="kura-field-label">
          {t(language, 'inspector.op.textureDepth')}
        </span>
        <PrecisionNumberInput
          strictRange
          onInvalidChange={invalid.track('f1')}
          style={{ width: 88 }}
          min={0.1}
          max={2.5}
          step={0.05}
          precision={2}
          defaultValue={0.45}
          suffix="mm"
          value={textureDepthMm}
          onChange={setTextureDepthMm}
          ariaLabel={t(language, 'inspector.op.textureDepth')}
        />
      </div>
      <input
        type="range"
        min={0.1}
        max={2.5}
        step={0.05}
        value={textureDepthMm}
        aria-label={t(language, 'inspector.op.textureDepth')}
        title={t(language, 'ui.sliderResetTip')}
        onDoubleClick={() => setTextureDepthMm(0.45)}
        onChange={(e) => setTextureDepthMm(Number(e.target.value))}
      />

      <div className="kura-slider-header">
        <span className="kura-field-label">
          {t(language, 'inspector.op.textureScale')}
        </span>
        <PrecisionNumberInput
          strictRange
          onInvalidChange={invalid.track('f2')}
          style={{ width: 88 }}
          min={1}
          max={16}
          step={0.5}
          precision={1}
          defaultValue={4}
          suffix="mm"
          value={textureScaleMm}
          onChange={setTextureScaleMm}
          ariaLabel={t(language, 'inspector.op.textureScale')}
        />
      </div>
      <input
        type="range"
        min={1}
        max={16}
        step={0.5}
        value={textureScaleMm}
        aria-label={t(language, 'inspector.op.textureScale')}
        title={t(language, 'ui.sliderResetTip')}
        onDoubleClick={() => setTextureScaleMm(4)}
        onChange={(e) => setTextureScaleMm(Number(e.target.value))}
      />

      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={isBusy || primary.locked || invalid.blocked}
        onClick={() =>
          applyTextureToObject(primary.id, {
            pattern: texturePattern,
            depth: textureDepthMm,
            scale: textureScaleMm,
          })
        }
      >
        <Sparkles size={13} />
        <span>{t(language, 'inspector.op.applyTexture')}</span>
      </button>
    </div>
  );
};
