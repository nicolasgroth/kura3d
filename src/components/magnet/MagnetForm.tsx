/**
 * @file src/components/magnet/MagnetForm.tsx
 * @description Campos del imán: forma (redondo o cuadrado), diámetro o lado, alto, holguras de ancho y profundidad
 * (validadas junto al campo, con coma decimal como el resto de la app) y «oculto bajo la cara» con su ayuda. Avisa
 * al estado del panel si hay campos inválidos (no se coloca con medidas fuera de rango).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId } from 'react';
import { MAGNET_DEFAULTS, MAGNET_RANGES, pocketDims, type MagnetNumericField, type MagnetShape } from '../../core/addons/magnetPocket';
import { t, type TranslationKey } from '../../i18n';
import { setMagnetBlocked, setMagnetParams, useMagnetPanel } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';

const SHAPES: readonly MagnetShape[] = ['round', 'square'];

export const MagnetForm: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useMagnetPanel((s) => s.params);
  const invalid = useInvalidFields();
  const uid = useId();
  useEffect(() => setMagnetBlocked(invalid.blocked), [invalid.blocked]);
  useEffect(() => () => setMagnetBlocked(false), []);

  const fmt = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 2 });
  const dims = pocketDims(params);
  const field = (key: MagnetNumericField, label: TranslationKey, step: number, help?: string) => (
    <div className="kura-magnet-field">
      <label className="kura-field-label" htmlFor={`${uid}-${key}`}>{t(language, label)}</label>
      <PrecisionNumberInput
        id={`${uid}-${key}`}
        strictRange
        onInvalidChange={invalid.track(key)}
        min={MAGNET_RANGES[key].min}
        max={MAGNET_RANGES[key].max}
        step={step}
        precision={2}
        defaultValue={MAGNET_DEFAULTS[key]}
        value={params[key]}
        onChange={(v) => setMagnetParams({ [key]: v })}
        describedBy={help}
        ariaLabel={t(language, label)}
      />
    </div>
  );

  return (
    <div className="kura-magnet-form">
      <span className="kura-field-label" id={`${uid}-shape`}>{t(language, 'magnet.shape')}</span>
      <div className="kura-segmented" role="group" aria-labelledby={`${uid}-shape`}>
        {SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            className={`kura-btn ${params.shape === shape ? 'is-active' : ''}`}
            aria-pressed={params.shape === shape}
            data-testid={`magnet-shape-${shape}`}
            onClick={() => setMagnetParams({ shape })}
          >
            {t(language, shape === 'round' ? 'magnet.shape.round' : 'magnet.shape.square')}
          </button>
        ))}
      </div>
      <div className="kura-magnet-grid">
        {field('sizeMm', params.shape === 'round' ? 'magnet.diameter' : 'magnet.side', 0.5)}
        {field('heightMm', 'magnet.height', 0.5)}
        {field('clearanceMm', 'magnet.clearance', 0.05, `${uid}-clearance-help`)}
        {field('depthClearanceMm', 'magnet.depthClearance', 0.05, `${uid}-clearance-help`)}
      </div>
      <p id={`${uid}-clearance-help`} className="kura-fit-note">{t(language, 'magnet.clearanceHelp')}</p>
      <label className="kura-magnet-check">
        <input
          type="checkbox"
          data-testid="magnet-hidden"
          checked={params.hidden}
          aria-describedby={`${uid}-hidden-help`}
          onChange={(e) => setMagnetParams({ hidden: e.target.checked })}
        />
        <span>{t(language, 'magnet.hidden')}</span>
      </label>
      <p id={`${uid}-hidden-help`} className="kura-fit-note">{t(language, 'magnet.hiddenHelp')}</p>
      <p className="kura-magnet-summary" data-testid="magnet-summary">
        {invalid.blocked
          ? t(language, 'magnet.summaryInvalid')
          : t(language, params.shape === 'round' ? 'magnet.summaryRound' : 'magnet.summarySquare', { w: fmt(dims.widthMm), d: fmt(dims.depthMm) })}
      </p>
    </div>
  );
};
