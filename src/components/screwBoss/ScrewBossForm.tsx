/**
 * @file src/components/screwBoss/ScrewBossForm.tsx
 * @description Campos de la torreta: tipo (tornillo directo o inserto roscado), alto y diámetro exterior del poste,
 * diámetro y profundidad del agujero (validados junto al campo, con coma decimal como el resto de la app), la nota
 * de que las medidas son de partida y conviene imprimir una prueba, y el resumen («Poste Ø 7,5 × 10 mm, agujero Ø
 * 2,5 × 8 mm»). Cambiar el tipo carga la medida equivalente (o la por defecto) de la tabla. Avisa al estado del
 * panel si hay campos inválidos (no se coloca con medidas fuera de rango).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId } from 'react';
import { invalidScrewBossFields, SCREW_BOSS_RANGES, type ScrewBossNumericField, type ScrewBossType } from '../../core/addons/screwBoss';
import { builtinScrewBossPresetsOf, formatMm, SCREW_BOSS_DEFAULTS } from '../../core/addons/screwBossPresets';
import { t, type TranslationKey } from '../../i18n';
import { setScrewBossBlocked, setScrewBossParams, useScrewBossPanel } from '../../store/screwBossPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';

const TYPES: readonly ScrewBossType[] = ['screw', 'insert'];

/** Al cambiar de tipo: la medida del mismo nominal en la tabla del otro tipo, o la primera de ese tipo. */
function presetForType(type: ScrewBossType, nominalMm: number) {
  const list = builtinScrewBossPresetsOf(type);
  return (list.find((p) => p.values.nominalMm === nominalMm) ?? list.find((p) => p.values.nominalMm === 3) ?? list[0]).values;
}

export const ScrewBossForm: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useScrewBossPanel((s) => s.params);
  const invalid = useInvalidFields();
  const uid = useId();
  const crossInvalid = invalidScrewBossFields(params).length > 0;
  const blocked = invalid.blocked || crossInvalid;
  useEffect(() => setScrewBossBlocked(blocked), [blocked]);
  useEffect(() => () => setScrewBossBlocked(false), []);

  const fmt = (n: number) => formatMm(n, language);
  const field = (key: ScrewBossNumericField, label: TranslationKey, step: number) => (
    <div className="kura-magnet-field" data-testid={`turret-field-${key}`}>
      <label className="kura-field-label" htmlFor={`${uid}-${key}`}>{t(language, label)}</label>
      <PrecisionNumberInput
        id={`${uid}-${key}`}
        strictRange
        onInvalidChange={invalid.track(key)}
        min={SCREW_BOSS_RANGES[key].min}
        max={SCREW_BOSS_RANGES[key].max}
        step={step}
        precision={2}
        defaultValue={SCREW_BOSS_DEFAULTS[key]}
        value={params[key]}
        onChange={(v) => setScrewBossParams({ [key]: v })}
        ariaLabel={t(language, label)}
        // El poste debe ser más ancho que el agujero (con su chaflán): se marca el diámetro exterior.
        externalInvalid={key === 'outerDiameterMm' && crossInvalid && !invalid.blocked}
      />
    </div>
  );

  return (
    <div className="kura-magnet-form">
      <span className="kura-field-label" id={`${uid}-type`}>{t(language, 'turret.type')}</span>
      <div className="kura-segmented" role="group" aria-labelledby={`${uid}-type`}>
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`kura-btn ${params.type === type ? 'is-active' : ''}`}
            aria-pressed={params.type === type}
            data-testid={`turret-type-${type}`}
            onClick={() => {
              if (params.type !== type) setScrewBossParams(presetForType(type, params.nominalMm));
            }}
          >
            {t(language, type === 'screw' ? 'turret.type.screw' : 'turret.type.insert')}
          </button>
        ))}
      </div>
      <div className="kura-magnet-grid">
        {field('heightMm', 'turret.height', 0.5)}
        {field('outerDiameterMm', 'turret.outer', 0.5)}
        {field('holeDiameterMm', 'turret.holeDiameter', 0.1)}
        {field('holeDepthMm', 'turret.holeDepth', 0.5)}
      </div>
      <p className="kura-fit-note" data-testid="turret-start-note">{t(language, 'turret.startNote')}</p>
      <p className="kura-magnet-summary" data-testid="turret-summary">
        {blocked
          ? t(language, 'turret.summaryInvalid')
          : t(language, 'turret.summary', {
            od: fmt(params.outerDiameterMm), h: fmt(params.heightMm), d: fmt(params.holeDiameterMm), depth: fmt(params.holeDepthMm),
          })}
      </p>
    </div>
  );
};
