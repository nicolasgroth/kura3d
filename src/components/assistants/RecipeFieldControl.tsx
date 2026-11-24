/**
 * @file src/components/assistants/RecipeFieldControl.tsx
 * @description Un campo del formulario de un asistente según el tipo de su parámetro (número o entero con unidad,
 * opción, casilla, texto, objeto de la escena o archivo): etiqueta asociada, ayuda y rango, y los avisos o errores de
 * la receta con `aria-describedby` y `aria-invalid`. El valor y las reglas vienen de `recipeFormModel`; aquí no hay
 * lógica de receta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CircleAlert, Info, X } from 'lucide-react';
import type { FileAnswer, ObjectAnswer } from '../../core/recipes/resolve/types';
import { toUserBox } from '../../core/scene/displayAxes';
import { worldBox } from '../../core/scene/overlap';
import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { DEFAULT_FILE_MAX_BYTES, sniffFileKind } from './fileKind';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import type { FieldNote, FormField } from './recipeFormModel';

/** Respuesta de un campo (lo que se guarda en `answers`) y, para archivos, su contenido. */
export interface FieldChange {
  readonly value: number | boolean | string | ObjectAnswer | FileAnswer | undefined;
  readonly file?: string | Uint8Array | null;
}

const NOTE_ICON = { error: CircleAlert, warning: AlertTriangle, info: Info } as const;

export const FieldNotes: React.FC<{ notes: readonly FieldNote[]; idPrefix: string }> = ({ notes, idPrefix }) => {
  const language = useKuraStore((s) => s.language);
  return (
    <>
      {notes.map((note, k) => {
        const Icon = NOTE_ICON[note.level];
        return (
          <p key={k} id={`${idPrefix}-note-${k}`} className={`kura-asis-note is-${note.level}`}>
            <Icon size={13} aria-hidden="true" />
            <span>
              <strong>{t(language, `asis.level.${note.level}`)}:</strong> {note.text}
            </span>
          </p>
        );
      })}
    </>
  );
};

/** Caja del objeto en los ejes del usuario (mm), o `null` si su malla está vacía. */
function objectAnswer(obj: SceneObject): ObjectAnswer | null {
  const box = worldBox(obj);
  if (!box) return null;
  const user = toUserBox({ min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] });
  return { objectId: obj.id, box: { min: user.min, max: user.max } };
}

function sameBox(a: ObjectAnswer['box'], b: ObjectAnswer['box']): boolean {
  return a.min.every((v, i) => v === b.min[i]) && a.max.every((v, i) => v === b.max[i]);
}

/**
 * Selector de objeto de la escena. Es el único campo que lee `objects` del store; la respuesta guarda una copia de
 * la caja del objeto, así que si éste se mueve, cambia o se borra la respuesta se actualiza o se limpia.
 */
const ObjectField: React.FC<{
  field: FormField;
  inputId: string;
  disabled: boolean;
  aria: { 'aria-describedby': string | undefined; 'aria-invalid': true | undefined };
  onChange: (change: FieldChange) => void;
}> = ({ field, inputId, disabled, aria, onChange }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const answer = field.value && typeof field.value === 'object' && 'objectId' in field.value ? field.value : null;
  const current = answer ? answer.objectId : '';
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!answer) return;
    const obj = objects.find((o) => o.id === answer.objectId);
    const fresh = obj ? objectAnswer(obj) : null;
    if (!fresh) onChangeRef.current({ value: undefined });
    else if (!sameBox(fresh.box, answer.box)) onChangeRef.current({ value: fresh });
  }, [objects, answer]);

  return (
    <>
      <select
        id={inputId}
        className="kura-select"
        value={objects.some((o) => o.id === current) ? current : ''}
        disabled={disabled || objects.length === 0}
        {...aria}
        onChange={(e) => {
          const obj = objects.find((o) => o.id === e.target.value);
          onChange({ value: obj ? (objectAnswer(obj) ?? undefined) : undefined });
        }}
      >
        <option value="">{t(language, field.optional ? 'asis.object.none' : 'asis.object.pick')}</option>
        {objects.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {objects.length === 0 && <p className="kura-field-hint">{t(language, 'asis.object.empty')}</p>}
    </>
  );
};

interface Props {
  readonly field: FormField;
  readonly busy: boolean;
  readonly onChange: (change: FieldChange) => void;
  readonly onInvalid: (invalid: boolean) => void;
  readonly onFileError: (error: boolean) => void;
}

export const RecipeFieldControl: React.FC<Props> = ({ field, busy, onChange, onInvalid, onFileError }) => {
  const language = useKuraStore((s) => s.language);
  const [fileMessage, setFileMessage] = useState<string | null>(null);
  const uid = useId();
  const inputId = `${uid}-in`;
  const hintId = `${uid}-hint`;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const disabled = busy || !field.enabled;
  const hasError = field.notes.some((n) => n.level === 'error');

  const range =
    field.min !== undefined && field.max !== undefined
      ? `${formatLocaleNumber(language, field.min, { maxFrac: 2 })} – ${formatLocaleNumber(language, field.max, { maxFrac: 2 })}${field.unit ? ` ${field.unit}` : ''}`
      : undefined;
  const accept = field.accept ? t(language, 'asis.file.formats', { types: field.accept.map((a) => a.toUpperCase()).join(', ') }) : undefined;
  const hint = [field.help, range, accept].filter(Boolean).join(' · ');
  const describedBy =
    [hint ? hintId : '', fileMessage ? `${uid}-file-msg` : '', ...field.notes.map((_, k) => `${uid}-note-${k}`)].filter(Boolean).join(' ') || undefined;
  const aria = { 'aria-describedby': describedBy, 'aria-invalid': hasError ? true : undefined } as const;
  const label = (
    <>
      {field.label}
      {field.optional && <span className="kura-asis-optional"> {t(language, 'asis.optional')}</span>}
    </>
  );

  let control: React.ReactNode;
  switch (field.type) {
    case 'number':
    case 'integer': {
      const value = typeof field.value === 'number' ? field.value : 0;
      control = (
        <PrecisionNumberInput
          id={inputId}
          value={value}
          step={field.step}
          precision={field.type === 'integer' ? 0 : 2}
          unit={null}
          suffix={field.unit}
          disabled={disabled}
          commitOnBlur={false}
          onChange={(v) => onChange({ value: field.type === 'integer' ? Math.round(v) : v })}
          onInvalidChange={onInvalid}
          externalInvalid={hasError}
          describedBy={describedBy}
        />
      );
      break;
    }
    case 'choice': {
      const options = field.options ?? [];
      const index = Math.max(0, options.findIndex((o) => o.value === field.value));
      control = (
        <select
          id={inputId}
          className="kura-select"
          value={index}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange({ value: options[Number(e.target.value)]?.value })}
        >
          {options.map((o, k) => (
            <option key={`${o.value}`} value={k}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case 'boolean':
      control = (
        <input
          id={inputId}
          type="checkbox"
          className="kura-asis-check"
          checked={field.value === true}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange({ value: e.target.checked })}
        />
      );
      break;
    case 'text': {
      const common = {
        id: inputId,
        className: 'kura-input',
        value: typeof field.value === 'string' ? field.value : '',
        maxLength: field.maxLength,
        disabled,
        ...aria,
      };
      control = field.multiline ? (
        <textarea {...common} rows={3} onChange={(e) => onChange({ value: e.target.value })} />
      ) : (
        <input {...common} type="text" onChange={(e) => onChange({ value: e.target.value })} />
      );
      break;
    }
    case 'object':
      control = <ObjectField field={field} inputId={inputId} disabled={disabled} aria={aria} onChange={onChange} />;
      break;
    case 'file': {
      const answer = field.value && typeof field.value === 'object' && 'kind' in field.value ? field.value : null;
      const reject = (key: TranslationKey, params?: Record<string, string | number>) => {
        if (fileInput.current) fileInput.current.value = '';
        setFileMessage(t(language, key, params));
        onFileError(true);
        onChange({ value: undefined, file: null });
      };
      const pick = async (file: File | undefined) => {
        if (!file) return;
        const limit = field.maxBytes ?? DEFAULT_FILE_MAX_BYTES;
        if (file.size > limit) {
          reject('asis.file.tooBig', { max: formatLocaleNumber(language, limit / (1024 * 1024), { maxFrac: 1 }) });
          return;
        }
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const kind = sniffFileKind(bytes);
          if (!kind || (field.accept && !field.accept.includes(kind))) {
            reject('asis.file.badType', { types: (field.accept ?? []).map((a) => a.toUpperCase()).join(', ') });
            return;
          }
          const content = kind === 'svg' ? new TextDecoder().decode(bytes) : bytes;
          setFileMessage(null);
          onFileError(false);
          onChange({ value: { kind, bytes: file.size, name: file.name.slice(0, 200) }, file: content });
        } catch {
          setFileMessage(null);
          onFileError(true);
        }
      };
      control = (
        <div className="kura-asis-file">
          <button
            id={inputId}
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={disabled}
            title={t(language, 'asis.file.choose')}
            {...aria}
            onClick={() => fileInput.current?.click()}
          >
            {t(language, 'asis.file.choose')}
          </button>
          <span className="kura-asis-file-name">{answer?.name ?? t(language, 'asis.file.none')}</span>
          {answer && (
            <button
              type="button"
              className="kura-mini-icon-btn"
              disabled={disabled}
              aria-label={t(language, 'asis.file.remove')}
              title={t(language, 'asis.file.remove')}
              onClick={() => {
                if (fileInput.current) fileInput.current.value = '';
                setFileMessage(null);
                onFileError(false);
                onChange({ value: undefined, file: null });
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            hidden
            tabIndex={-1}
            data-testid={`asis-file-${field.id}`}
            accept={(field.accept ?? []).map((a) => (a === 'jpg' ? '.jpg,.jpeg' : `.${a}`)).join(',')}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>
      );
      break;
    }
  }

  const isCheck = field.type === 'boolean';
  return (
    <div className={`kura-asis-field${isCheck ? ' is-check' : ''}`} data-field={field.id} data-type={field.type}>
      {isCheck ? (
        <label className="kura-asis-check-row" htmlFor={inputId}>
          {control}
          <span>{label}</span>
        </label>
      ) : (
        <>
          <label className="kura-field-label" htmlFor={inputId}>
            {label}
          </label>
          {control}
        </>
      )}
      {hint && (
        <span id={hintId} className="kura-field-hint">
          {hint}
        </span>
      )}
      {fileMessage && (
        <p id={`${uid}-file-msg`} className="kura-asis-note is-error" role="alert">
          <CircleAlert size={13} aria-hidden="true" />
          <span>{fileMessage}</span>
        </p>
      )}
      <FieldNotes notes={field.notes} idPrefix={uid} />
    </div>
  );
};
