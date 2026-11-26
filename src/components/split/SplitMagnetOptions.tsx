/**
 * @file src/components/split/SplitMagnetOptions.tsx
 * @description Opciones de la unión «Imanes» de Dividir para imprimir: imán (preajustes incluidos y los del usuario
 * del alojamiento de imán; por defecto 5 × 2), redondos, cuadrados y rectangulares, holguras de diámetro y
 * profundidad, cantidad automática o fija, la medida del alojamiento resultante (diámetro × profundidad en el redondo;
 * largo × ancho × profundidad en los de bloque) y el recordatorio de polaridad. El estado vive en
 * `useSplitMagnetChoice`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useState } from 'react';
import { Magnet } from 'lucide-react';
import { MAGNET_DEFAULTS, MAGNET_RANGES, pocketDims, type MagnetParams } from '../../core/addons/magnetPocket';
import { BUILTIN_MAGNET_PRESETS, sameMagnet } from '../../core/addons/magnetPresets';
import type { SplitConnectorOptions } from '../../engine';
import { OPERATION_RANGES as OR } from '../../engine/operationLimits';
import { magnetConnector } from '../../engine/split/splitMagnet';
import { t } from '../../i18n';
import { useMagnetPresets } from '../../store/magnetPanel';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import { builtinPresetLabel } from '../magnet/MagnetPresetPicker';

/** Imán y cantidad elegidos para la unión. */
export interface SplitMagnetChoice {
  magnet: MagnetParams;
  countAuto: boolean;
  count: number;
}

export const DEFAULT_SPLIT_MAGNET_CHOICE: SplitMagnetChoice = { magnet: { ...MAGNET_DEFAULTS }, countAuto: true, count: 2 };

export function useSplitMagnetChoice() {
  return useState<SplitMagnetChoice>(DEFAULT_SPLIT_MAGNET_CHOICE);
}

/** Conector del motor para la elección. */
export const splitMagnetConnector = (c: SplitMagnetChoice): SplitConnectorOptions =>
  magnetConnector(c.magnet, c.countAuto ? 'auto' : c.count);

/** Campo numérico del panel (el mismo `num` de `SplitForBedPanel`: rango estricto y campos inválidos marcados). */
export type SplitNumField = (
  id: string, label: string, value: number, onChange: (v: number) => void, range: { min: number; max: number },
  opts?: { step?: number; precision?: number; disabled?: boolean; def?: number; hint?: string },
) => React.ReactNode;

const CUSTOM = '';

export const SplitMagnetOptions: React.FC<{
  language: LanguageCode;
  uid: string;
  choice: SplitMagnetChoice;
  onChange: (next: SplitMagnetChoice) => void;
  num: SplitNumField;
}> = ({ language, uid, choice, onChange, num }) => {
  const presets = useMagnetPresets((s) => s.presets);
  useEffect(() => {
    useMagnetPresets.getState().reload();
  }, []);
  const { magnet } = choice;
  // Las holguras son propias de la unión: el preajuste se reconoce por forma y medidas
  const sameSize = (p: MagnetParams) => p.shape === magnet.shape && p.sizeMm === magnet.sizeMm && p.heightMm === magnet.heightMm
    && (p.shape !== 'rect' || p.widthMm === magnet.widthMm);
  const mine = presets.find((p) => sameMagnet(p.values, magnet)) ?? presets.find((p) => sameSize(p.values));
  const builtin = mine ? undefined : BUILTIN_MAGNET_PRESETS.find((p) => sameSize(p.values));
  const selected = mine ? mine.id : builtin ? `builtin:${builtin.id}` : CUSTOM;
  const set = (patch: Partial<SplitMagnetChoice>) => onChange({ ...choice, ...patch });
  const setMagnet = (patch: Partial<MagnetParams>) => set({ magnet: { ...magnet, ...patch, hidden: false } });
  const pick = (value: string) => {
    const found = value.startsWith('builtin:')
      ? BUILTIN_MAGNET_PRESETS.find((p) => `builtin:${p.id}` === value)?.values
      : presets.find((p) => p.id === value)?.values;
    if (found) {
      setMagnet({
        shape: found.shape, sizeMm: found.sizeMm, widthMm: found.shape === 'rect' ? found.widthMm : undefined, heightMm: found.heightMm,
        clearanceMm: found.clearanceMm, depthClearanceMm: found.depthClearanceMm,
      });
    }
  };
  const dims = pocketDims({ ...magnet, hidden: false });
  const fmt = (n: number) => formatNumber(language, n, { maximumFractionDigits: 2 });
  const round = magnet.shape === 'round';

  return (
    <div className="kura-split-magnet" data-testid="split-magnet-options">
      <div className="kura-form-field">
        <label htmlFor={`${uid}-magnet`}>{t(language, 'splitMagnet.preset')}</label>
        <select
          id={`${uid}-magnet`}
          className="kura-select"
          data-testid="split-magnet-preset"
          value={selected}
          aria-describedby={`${uid}-magnet-help`}
          onChange={(e) => pick(e.target.value)}
        >
          <option value={CUSTOM} disabled>{t(language, 'magnet.preset.custom')}</option>
          <optgroup label={t(language, 'magnet.preset.builtin')}>
            {BUILTIN_MAGNET_PRESETS.map((p) => (
              <option key={p.id} value={`builtin:${p.id}`}>{builtinPresetLabel(p.values, language)}</option>
            ))}
          </optgroup>
          {presets.length > 0 && (
            <optgroup label={t(language, 'magnet.preset.mine')}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <div className="kura-split-row2">
        {num('mclr', `${t(language, 'splitMagnet.clearance')} (mm)`, magnet.clearanceMm, (v) => setMagnet({ clearanceMm: v }), MAGNET_RANGES.clearanceMm, { step: 0.05, precision: 2, def: MAGNET_DEFAULTS.clearanceMm })}
        {num('mdclr', `${t(language, 'splitMagnet.depthClearance')} (mm)`, magnet.depthClearanceMm, (v) => setMagnet({ depthClearanceMm: v }), MAGNET_RANGES.depthClearanceMm, { step: 0.05, precision: 2, def: MAGNET_DEFAULTS.depthClearanceMm })}
        <label className="kura-split-check">
          <input type="checkbox" data-testid="split-magnet-count-auto" checked={choice.countAuto} onChange={(e) => set({ countAuto: e.target.checked })} />
          <span>{t(language, 'splitMagnet.countAuto')}</span>
        </label>
        {num('mcount', t(language, 'splitMagnet.count'), choice.count, (v) => set({ count: Math.round(v) }), { min: 1, max: OR.cut.connectorCount.max }, { precision: 0, disabled: choice.countAuto, def: 2 })}
      </div>
      <p className="kura-split-target" id={`${uid}-magnet-help`}>
        {round
          ? t(language, 'splitMagnet.help', { width: fmt(dims.widthMm), depth: fmt(dims.depthMm) })
          : t(language, 'splitMagnet.helpBlock', { size: `${fmt(dims.widthMm)} × ${fmt(dims.crossMm)} × ${fmt(dims.depthMm)}` })}
      </p>
      <p className="kura-split-target" role="note" data-testid="split-magnet-polarity">
        <Magnet size={12} aria-hidden="true" /> {t(language, 'splitMagnet.polarity')}
      </p>
    </div>
  );
};
