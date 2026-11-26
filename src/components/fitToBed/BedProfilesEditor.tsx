/**
 * @file src/components/fitToBed/BedProfilesEditor.tsx
 * @description Editor de camas del usuario: lista (usar, editar, duplicar, borrar) y formulario con
 * nombre, ancho X, fondo Y, alto Z y margen por lado, con validación de rangos y coma decimal.
 * Se guardan en preferencias locales; elegir una la deja como cama activa del proyecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId, useState } from 'react';
import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { draftFromProfile, validateBedDraft, type BedDraftError, type BedProfileDraft } from '../../store/bedProfiles';
import { useKuraStore } from '../../store/useKuraStore';

const FIELDS = [
  ['widthMm', 'bedProfiles.width'],
  ['depthMm', 'bedProfiles.depth'],
  ['heightMm', 'bedProfiles.height'],
  ['marginMm', 'bedProfiles.margin'],
] as const;

const parseDecimal = (text: string) => {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  return clean === '' ? NaN : Number(clean);
};

type Texts = { name: string } & Record<(typeof FIELDS)[number][0], string>;

export const BedProfilesEditor: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const beds = useKuraStore((s) => s.userBedProfiles);
  const activeId = useKuraStore((s) => s.printerProfile.id);
  const num = (v: number) => formatLocaleNumber(language, v, { maxFrac: 2 });
  const toTexts = (d: BedProfileDraft): Texts => ({
    name: d.name, widthMm: num(d.widthMm), depthMm: num(d.depthMm), heightMm: num(d.heightMm), marginMm: num(d.marginMm),
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [texts, setTexts] = useState<Texts | null>(null);
  const [errors, setErrors] = useState<BedDraftError[]>([]);
  const formId = useId();

  const startNew = () => {
    const p = useKuraStore.getState().printerProfile;
    setEditId(null);
    setTexts(toTexts({ ...draftFromProfile(p), name: t(language, 'bedProfiles.defaultName') }));
    setErrors([]);
  };
  const startEdit = (id: string) => {
    const p = beds.find((b) => b.id === id);
    if (!p) return;
    setEditId(id);
    setTexts(toTexts(draftFromProfile(p)));
    setErrors([]);
  };
  const save = () => {
    if (!texts) return;
    const draft: BedProfileDraft = {
      name: texts.name, widthMm: parseDecimal(texts.widthMm), depthMm: parseDecimal(texts.depthMm),
      heightMm: parseDecimal(texts.heightMm), marginMm: parseDecimal(texts.marginMm),
    };
    const found = validateBedDraft(draft);
    setErrors(found);
    if (found.length > 0) return;
    const saved = useKuraStore.getState().saveUserBedProfile(draft, editId ?? undefined);
    if (saved) {
      useKuraStore.getState().setPrinterProfile(saved.id);
      setTexts(null);
    }
  };
  const errorText = (e: BedDraftError) => {
    if (e.field === 'name') return t(language, 'bedProfiles.error.name');
    if (e.field === 'margin-space') return t(language, 'bedProfiles.error.margin');
    const label = FIELDS.find(([f]) => f === e.field)?.[1] ?? 'bedProfiles.width';
    return t(language, 'bedProfiles.error.range', { field: t(language, label), min: num(e.min), max: num(e.max) });
  };
  const fieldError = (field: string) => errors.some((e) => e.field === field || (e.field === 'margin-space' && field === 'marginMm'));

  return (
    <div className="kura-bed-editor" data-testid="bed-editor">
      <p className="kura-fit-note">{t(language, 'bedProfiles.help')}</p>
      {beds.length > 0 && (
        <ul className="kura-bed-list">
          {beds.map((b) => (
            <li key={b.id} className={b.id === activeId ? 'is-active' : undefined}>
              <span className="kura-bed-name">{b.name}</span>
              <span className="kura-bed-actions">
                <button type="button" className="kura-btn kura-btn-small" onClick={() => startEdit(b.id)}>{t(language, 'bedProfiles.edit')}</button>
                <button type="button" className="kura-btn kura-btn-small" onClick={() => useKuraStore.getState().duplicateBedProfile(b.id)}>{t(language, 'bedProfiles.duplicate')}</button>
                <button type="button" className="kura-btn kura-btn-small" onClick={() => useKuraStore.getState().deleteUserBedProfile(b.id)}>{t(language, 'bedProfiles.delete')}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!texts && (
        <button type="button" className="kura-btn kura-btn-small" onClick={startNew} data-testid="bed-new">{t(language, 'bedProfiles.new')}</button>
      )}
      {texts && (
        <form id={formId} className="kura-bed-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>
            <span>{t(language, 'bedProfiles.name')}</span>
            <input className="kura-input" value={texts.name} maxLength={60} aria-invalid={fieldError('name')} data-testid="bed-name"
              onChange={(e) => setTexts({ ...texts, name: e.target.value })} />
          </label>
          {FIELDS.map(([field, label]) => (
            <label key={field}>
              <span>{t(language, label as TranslationKey)}</span>
              <input className="kura-input" inputMode="decimal" value={texts[field]} aria-invalid={fieldError(field)} data-testid={`bed-${field}`}
                onChange={(e) => setTexts({ ...texts, [field]: e.target.value })} />
            </label>
          ))}
          {errors.length > 0 && (
            <ul className="kura-unit-error" role="alert">
              {errors.map((e, i) => <li key={i}>{errorText(e)}</li>)}
            </ul>
          )}
          <span className="kura-bed-actions">
            <button type="button" className="kura-btn kura-btn-small" onClick={() => setTexts(null)}>{t(language, 'fit.cancel')}</button>
            <button type="submit" className="kura-btn kura-btn-small kura-btn-primary" data-testid="bed-save">{t(language, 'bedProfiles.save')}</button>
          </span>
        </form>
      )}
    </div>
  );
};
