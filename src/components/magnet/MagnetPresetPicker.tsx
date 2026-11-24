/**
 * @file src/components/magnet/MagnetPresetPicker.tsx
 * @description Preajustes del alojamiento de imán: lista con los incluidos y los del usuario (elegir uno carga sus
 * medidas), «Personalizado» cuando las medidas no calzan con ninguno, guardar las medidas actuales con un nombre y
 * eliminar el preajuste propio elegido. Los propios se guardan en preferencias locales (`useMagnetPresets`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { BUILTIN_MAGNET_PRESETS, magnetSizeLabel, sameMagnet } from '../../core/addons/magnetPresets';
import type { MagnetParams } from '../../core/addons/magnetPocket';
import { t } from '../../i18n';
import { setMagnetParams, useMagnetPanel, useMagnetPresets } from '../../store/magnetPanel';
import { MAX_USER_PRESETS, USER_PRESET_NAME_MAX, validPresetName } from '../../store/userPresets';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';

const CUSTOM = '';

export function builtinPresetLabel(values: MagnetParams, language: LanguageCode): string {
  const size = magnetSizeLabel(values, language);
  return t(language, values.shape === 'square' ? 'magnet.preset.square' : 'magnet.preset.round', { size });
}

export const MagnetPresetPicker: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useMagnetPanel((s) => s.params);
  const presets = useMagnetPresets((s) => s.presets);
  const uid = useId();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // Al día con los cambios de otra pestaña mientras el panel está abierto.
  useEffect(() => {
    useMagnetPresets.getState().reload();
    return useMagnetPresets.getState().watch();
  }, []);

  // El elegido es el primero (propios primero) cuyas medidas calzan con las actuales.
  const mine = presets.find((p) => sameMagnet(p.values, params));
  const builtin = mine ? undefined : BUILTIN_MAGNET_PRESETS.find((p) => sameMagnet(p.values, params));
  const selected = mine ? mine.id : builtin ? `builtin:${builtin.id}` : CUSTOM;

  const pick = (value: string) => {
    if (value.startsWith('builtin:')) {
      const found = BUILTIN_MAGNET_PRESETS.find((p) => `builtin:${p.id}` === value);
      if (found) setMagnetParams(found.values);
      return;
    }
    const own = presets.find((p) => p.id === value);
    if (own) setMagnetParams(own.values);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPresetName(name)) {
      setNameError(t(language, 'magnet.preset.nameInvalid'));
      return;
    }
    const result = useMagnetPresets.getState().save(name, params);
    if (!result.ok) {
      setNameError(t(language, result.reason === 'full' ? 'magnet.preset.full' : 'magnet.preset.valuesInvalid', { max: MAX_USER_PRESETS }));
      return;
    }
    setNameError(null);
    setName('');
    useKuraStore.getState().addToast(t(language, 'magnet.preset.saved', { name: result.preset.name }), 'success');
  };

  const remove = () => {
    if (!mine) return;
    const index = presets.findIndex((p) => p.id === mine.id);
    const gone = useMagnetPresets.getState().remove(mine.id);
    // El botón queda deshabilitado al eliminar: el foco vuelve al selector de preajuste, no al body.
    selectRef.current?.focus();
    if (!gone) return;
    useKuraStore.getState().addToast(t(language, 'magnet.preset.deleted', { name: gone.name }), 'info', {
      label: t(language, 'topbar.undo'),
      transient: true,
      run: () => {
        if (useMagnetPresets.getState().restore(gone, index)) selectRef.current?.focus();
      },
    });
  };

  return (
    <div className="kura-magnet-presets">
      <label className="kura-field-label" htmlFor={`${uid}-preset`}>{t(language, 'magnet.preset')}</label>
      <div className="kura-magnet-row">
        <select ref={selectRef} id={`${uid}-preset`} className="kura-select" data-testid="magnet-preset" value={selected} onChange={(e) => pick(e.target.value)}>
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
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          data-testid="magnet-preset-delete"
          disabled={!mine}
          onClick={remove}
          title={t(language, 'magnet.preset.delete')}
          aria-label={t(language, 'magnet.preset.delete')}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <form className="kura-magnet-row" onSubmit={save}>
        <input
          className="kura-input"
          data-testid="magnet-preset-name"
          value={name}
          maxLength={USER_PRESET_NAME_MAX + 10}
          placeholder={t(language, 'magnet.preset.name')}
          aria-label={t(language, 'magnet.preset.name')}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${uid}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
        />
        <button type="submit" className="kura-btn kura-btn-sm" data-testid="magnet-preset-save" title={t(language, 'magnet.preset.save')}>
          <Save size={13} aria-hidden="true" />
          <span>{t(language, 'magnet.preset.save')}</span>
        </button>
      </form>
      {nameError && <p id={`${uid}-name-error`} className="kura-unit-error" role="alert">{nameError}</p>}
    </div>
  );
};
