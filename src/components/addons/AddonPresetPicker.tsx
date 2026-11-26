/**
 * @file src/components/addons/AddonPresetPicker.tsx
 * @description Selector de preajustes común de los agregados (imán, torreta): lista con los incluidos y los del
 * usuario (elegir uno carga sus medidas), «Personalizado» cuando las medidas no calzan con ninguno, guardar las
 * medidas actuales con un nombre y eliminar el preajuste propio elegido (con Deshacer). Los textos salen de
 * `<prefijo>.preset.*` y los `data-testid` de `<testId>-preset*`, así cada agregado conserva los suyos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { Save, Trash2 } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { MAX_USER_PRESETS, USER_PRESET_NAME_MAX, validPresetName, type UserPresetsState } from '../../store/userPresets';
import { useKuraStore } from '../../store/useKuraStore';

const CUSTOM = '';

export interface AddonPresetPickerProps<T> {
  /** Prefijo de los textos (`magnet`, `turret`). */
  textPrefix: string;
  /** Prefijo de los `data-testid` (`magnet`, `turret`). */
  testId: string;
  /** Clase base del agregado (`kura-magnet`), para reutilizar sus estilos. */
  className?: string;
  values: T;
  builtins: ReadonlyArray<{ id: string; label: string; values: T }>;
  presets: UseBoundStore<StoreApi<UserPresetsState<T>>>;
  same: (a: T, b: T) => boolean;
  onPick: (values: T) => void;
}

export function AddonPresetPicker<T>({ textPrefix, testId, className = 'kura-magnet', values, builtins, presets: store, same, onPick }: AddonPresetPickerProps<T>) {
  const language = useKuraStore((s) => s.language);
  const presets = store((s) => s.presets);
  const uid = useId();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const key = (k: string) => `${textPrefix}.preset${k}` as TranslationKey;

  // Al día con los cambios de otra pestaña mientras el panel está abierto.
  useEffect(() => {
    store.getState().reload();
    return store.getState().watch();
  }, [store]);

  // El elegido es el primero (propios primero) cuyas medidas calzan con las actuales.
  const mine = presets.find((p) => same(p.values, values));
  const builtin = mine ? undefined : builtins.find((p) => same(p.values, values));
  const selected = mine ? mine.id : builtin ? `builtin:${builtin.id}` : CUSTOM;

  const pick = (value: string) => {
    if (value.startsWith('builtin:')) {
      const found = builtins.find((p) => `builtin:${p.id}` === value);
      if (found) onPick(found.values);
      return;
    }
    const own = presets.find((p) => p.id === value);
    if (own) onPick(own.values);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validPresetName(name)) {
      setNameError(t(language, key('.nameInvalid')));
      return;
    }
    const result = store.getState().save(name, values);
    if (!result.ok) {
      setNameError(t(language, key(result.reason === 'full' ? '.full' : result.reason === 'storage' ? '.storageFailed' : '.valuesInvalid'), { max: MAX_USER_PRESETS }));
      return;
    }
    setNameError(null);
    setName('');
    useKuraStore.getState().addToast(t(language, key('.saved'), { name: result.preset.name }), 'success');
  };

  const remove = () => {
    if (!mine) return;
    const index = presets.findIndex((p) => p.id === mine.id);
    const gone = store.getState().remove(mine.id);
    // El botón queda deshabilitado al eliminar: el foco vuelve al selector de preajuste, no al body.
    selectRef.current?.focus();
    if (!gone) {
      // Si el preajuste sigue ahí, no se pudo escribir en el almacenamiento del navegador.
      if (store.getState().presets.some((p) => p.id === mine.id)) useKuraStore.getState().addToast(t(language, key('.storageFailed')), 'error');
      return;
    }
    useKuraStore.getState().addToast(t(language, key('.deleted'), { name: gone.name }), 'info', {
      label: t(language, 'topbar.undo'),
      ariaLabel: t(language, key('.undoDelete'), { name: gone.name }),
      transient: true,
      run: () => {
        if (store.getState().restore(gone, index)) selectRef.current?.focus();
      },
    });
  };

  return (
    <div className={`${className}-presets`}>
      <label className="kura-field-label" htmlFor={`${uid}-preset`}>{t(language, key(''))}</label>
      <div className={`${className}-row`}>
        <select ref={selectRef} id={`${uid}-preset`} className="kura-select" data-testid={`${testId}-preset`} value={selected} onChange={(e) => pick(e.target.value)}>
          <option value={CUSTOM} disabled>{t(language, key('.custom'))}</option>
          <optgroup label={t(language, key('.builtin'))}>
            {builtins.map((p) => <option key={p.id} value={`builtin:${p.id}`}>{p.label}</option>)}
          </optgroup>
          {presets.length > 0 && (
            <optgroup label={t(language, key('.mine'))}>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          data-testid={`${testId}-preset-delete`}
          disabled={!mine}
          onClick={remove}
          title={t(language, key('.delete'))}
          aria-label={t(language, key('.delete'))}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      <form className={`${className}-row`} onSubmit={save}>
        <input
          className="kura-input"
          data-testid={`${testId}-preset-name`}
          value={name}
          maxLength={USER_PRESET_NAME_MAX + 10}
          placeholder={t(language, key('.name'))}
          aria-label={t(language, key('.name'))}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${uid}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
        />
        <button type="submit" className="kura-btn kura-btn-sm" data-testid={`${testId}-preset-save`} title={t(language, key('.save'))}>
          <Save size={13} aria-hidden="true" />
          <span>{t(language, key('.save'))}</span>
        </button>
      </form>
      {nameError && <p id={`${uid}-name-error`} className="kura-unit-error" role="alert">{nameError}</p>}
    </div>
  );
}
