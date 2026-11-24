/**
 * @file src/components/assistants/RecipeForm.tsx
 * @description Formulario de un asistente generado desde su receta: selector de variante, un campo por parámetro
 * agrupado por página, reglas aplicadas en vivo (`resolveRecipe` en cada cambio) y botón «Crear», que ejecuta la
 * receta en el motor mediante el store. Mientras corre, los campos quedan deshabilitados y un `role="status"` lo
 * anuncia; los errores de la receta salen junto al campo o arriba, sin tocar la escena. Enter crea; Escape vuelve a
 * la lista.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LoaderCircle, WandSparkles } from 'lucide-react';
import type { RecipeIssue } from '../../core/recipes/errors';
import type { AnswerValue } from '../../core/recipes/resolve/types';
import { resolveText } from '../../core/recipes/validate/strings';
import { languageOf } from '../../core/recipes/catalog';
import { t } from '../../i18n';
import { runAssistant } from '../../store/assistantsPanel';
import { recipeBed } from '../../store/slices/recipesSlice';
import { useKuraStore } from '../../store/useKuraStore';
import { useInvalidFields } from '../useInvalidFields';
import { FieldNotes, RecipeFieldControl, type FieldChange } from './RecipeFieldControl';
import { buildFormModel, type AssistantRecipe } from './recipeFormModel';
import '../../styles/assistants.css';

const FIELD_CONTROLS = '.kura-asis-fields :is(input, select, textarea, button):not([disabled]):not([type="file"])';

export const RecipeForm: React.FC<{ entry: AssistantRecipe; onBack: () => void; onCreated: () => void }> = ({ entry, onBack, onCreated }) => {
  const language = useKuraStore((s) => s.language);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const uid = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLButtonElement | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [files, setFiles] = useState<Record<string, string | Uint8Array>>({});
  const [variant, setVariant] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [runErrors, setRunErrors] = useState<readonly RecipeIssue[]>([]);
  const [fileErrors, setFileErrors] = useState<ReadonlySet<string>>(() => new Set());
  const invalid = useInvalidFields();

  const bed = useMemo(() => recipeBed({ printerProfile, customBedDimensions: customBed }), [printerProfile, customBed]);
  const model = useMemo(
    () => buildFormModel(entry, { answers, ...(variant !== undefined ? { variant } : {}), language, bed }),
    [entry, answers, variant, language, bed],
  );
  const recipe = entry.validated.recipe;
  const title = resolveText(recipe, recipe.title, languageOf(language));
  const description = recipe.description ? resolveText(recipe, recipe.description, languageOf(language)) : undefined;
  const blocked = !model.canCreate || invalid.blocked || fileErrors.size > 0;

  // Foco inicial en el primer campo (tras el foco que el panel pone al abrir).
  useEffect(() => {
    const handle = window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(FIELD_CONTROLS)?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(handle);
  }, [entry.id]);

  // Al terminar una creación fallida el foco vuelve al botón (los campos estaban deshabilitados).
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) createRef.current?.focus({ preventScroll: true });
    wasBusy.current = busy;
  }, [busy]);

  const change = (id: string, c: FieldChange) => {
    setRunErrors([]);
    setAnswers((prev) => {
      const next = { ...prev };
      if (c.value === undefined) delete next[id];
      else next[id] = c.value;
      return next;
    });
    const file = c.file;
    if (file !== undefined) {
      setFiles((prev) => {
        const next = { ...prev };
        if (file === null) delete next[id];
        else next[id] = file;
        return next;
      });
    }
  };

  const setFileError = (id: string, error: boolean) =>
    setFileErrors((prev) => {
      if (prev.has(id) === error) return prev;
      const next = new Set(prev);
      if (error) next.add(id);
      else next.delete(id);
      return next;
    });

  const chooseVariant = (id: string) => {
    setVariant(id === '' ? undefined : id);
    // La variante rellena sus parámetros: solo las respuestas sobre ellos dejan de taparla. Las demás se conservan.
    const defined = new Set(Object.keys(entry.validated.recipe.presets?.find((p) => p.id === id)?.values ?? {}));
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !defined.has(key))));
    setRunErrors([]);
  };

  const submit = async () => {
    if (busy || blocked) return;
    setBusy(true);
    setRunErrors([]);
    let created = false;
    try {
      const used = Object.fromEntries(Object.entries(files).filter(([id]) => id in answers));
      const outcome = await runAssistant({ recipe: entry.raw, answers, ...(variant !== undefined ? { variant } : {}), files: used });
      if (outcome.status === 'created') {
        created = true;
        onCreated();
        return;
      }
      // 'failed' y 'empty': el aviso ya se mostró y la escena no cambió; el formulario sigue abierto.
      if (outcome.status === 'invalid') setRunErrors(outcome.errors);
    } catch {
      useKuraStore.getState().addToast(t(language, 'asis.runFailed'), 'error');
    } finally {
      // Pase lo que pase el formulario no queda bloqueado (ni Escape); al crear, el panel se cierra.
      if (!created) setBusy(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Escape (en captura, para que el campo numérico no lo absorba al revertir su texto) vuelve a la lista; el panel
  // se cierra con su botón X o con Escape desde la lista.
  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || busy) return;
    e.preventDefault();
    e.stopPropagation();
    onBack();
  };

  // El campo numérico confirma con Enter sin enviar el formulario: se envía con el valor ya confirmado.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.getAttribute('role') === 'spinbutton') {
      window.setTimeout(() => void submitRef.current(), 0);
    }
  };

  const formId = `${uid}-form`;
  return (
    <div ref={rootRef} className="kura-asis-form-wrap" onKeyDownCapture={onEscape} onKeyDown={onKeyDown}>
      <div className="kura-asis-head">
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-asis-back"
          disabled={busy}
          title={t(language, 'asis.backTip')}
          aria-keyshortcuts="Escape"
          onClick={onBack}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>{t(language, 'asis.back')}</span>
        </button>
        <h3 className="kura-asis-title">{title}</h3>
        {description && <p className="kura-gen-note">{description}</p>}
      </div>
      <form
        id={formId}
        className="kura-asis-form"
        aria-label={t(language, 'asis.form', { name: title })}
        aria-busy={busy}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset className="kura-asis-fields" disabled={busy}>
          {model.variants.length > 0 && (
            <div className="kura-asis-field">
              <label className="kura-field-label" htmlFor={`${uid}-variant`}>
                {t(language, 'asis.variant')}
              </label>
              <select
                id={`${uid}-variant`}
                className="kura-select"
                value={variant ?? ''}
                aria-describedby={`${uid}-variant-hint`}
                onChange={(e) => chooseVariant(e.target.value)}
              >
                <option value="">{t(language, 'asis.variant.none')}</option>
                {model.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.verified ? v.label : t(language, 'asis.variant.unverified', { label: v.label })}
                  </option>
                ))}
              </select>
              <span id={`${uid}-variant-hint`} className="kura-field-hint">
                {t(language, 'asis.variant.hint')}
              </span>
            </div>
          )}
          {model.notes.length > 0 && (
            <div className="kura-asis-notes">
              <FieldNotes notes={model.notes} idPrefix={`${uid}-top`} />
            </div>
          )}
          {model.groups.map((group) => {
            const headingId = `${uid}-g-${group.page ?? 'main'}`;
            return (
              <section key={group.page ?? '_'} className="kura-asis-group" aria-labelledby={group.title ? headingId : undefined}>
                {group.title && (
                  <h4 id={headingId} className="kura-asis-group-title">
                    {group.title}
                  </h4>
                )}
                {group.fields.map((field) => (
                  <RecipeFieldControl
                    key={field.id}
                    field={field}
                    busy={busy}
                    onChange={(c) => change(field.id, c)}
                    onInvalid={invalid.track(field.id)}
                    onFileError={(error) => setFileError(field.id, error)}
                  />
                ))}
              </section>
            );
          })}
        </fieldset>
        {fileErrors.size > 0 && (
          <p className="kura-asis-note is-error" role="alert">
            {t(language, 'asis.file.readError')}
          </p>
        )}
        {runErrors.length > 0 && (
          <div className="kura-asis-problems" role="alert">
            <strong>{t(language, 'asis.problems')}</strong>
            <ul>
              {runErrors.map((e, k) => (
                <li key={k}>{t(language, e.key, e.params)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="kura-asis-actions">
          <div className="kura-asis-status" role="status" aria-live="polite">
            {busy && (
              <>
                <LoaderCircle size={15} className="kura-asis-spin" aria-hidden="true" />
                <span>{t(language, 'asis.running', { name: title })}</span>
              </>
            )}
          </div>
          {blocked && !busy && <span className="kura-field-hint">{t(language, 'asis.createBlocked')}</span>}
          <button
            ref={createRef}
            type="submit"
            className="kura-btn kura-btn-primary kura-asis-create"
            disabled={blocked || busy}
            title={blocked ? t(language, 'asis.createBlocked') : t(language, 'asis.createTip')}
            aria-keyshortcuts="Enter"
          >
            <WandSparkles size={13} aria-hidden="true" />
            <span>{t(language, 'asis.create')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
