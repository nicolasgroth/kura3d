/**
 * @file src/components/assistants/FileField.tsx
 * @description Campo de archivo de un asistente: botón «Elegir archivo», nombre elegido y botón para quitarlo. Lee
 * el archivo con un token por elección: si se elige otro mientras el anterior aún se lee, el resultado obsoleto se
 * descarta (gana siempre la última elección, no la lectura que termine última). Si la lectura falla se limpian la
 * respuesta y el archivo anteriores. El tipo se decide por el contenido (`sniffFileKind`), no por la extensión.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FileAnswer } from '../../core/recipes/resolve/types';
import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import { DEFAULT_FILE_MAX_BYTES, sniffFileKind } from './fileKind';
import type { FieldChange } from './RecipeFieldControl';
import type { FormField } from './recipeFormModel';

interface Props {
  readonly field: FormField;
  readonly inputId: string;
  readonly disabled: boolean;
  readonly aria: { 'aria-describedby': string | undefined; 'aria-invalid': true | undefined };
  readonly onChange: (change: FieldChange) => void;
  readonly onFileError: (error: boolean) => void;
  /** Mensaje de rechazo (tamaño o tipo) para mostrarlo junto al campo; `null` lo quita. */
  readonly onMessage: (message: string | null) => void;
}

export const FileField: React.FC<Props> = ({ field, inputId, disabled, aria, onChange, onFileError, onMessage }) => {
  const language = useKuraStore((s) => s.language);
  const fileInput = useRef<HTMLInputElement | null>(null);
  // Cada elección (y cada «quitar») sube el token; una lectura solo vale si su token sigue siendo el último.
  const token = useRef(0);
  // Tras un rechazo no hay respuesta, pero el campo queda en error: «quitar» también debe poder limpiarlo, o un
  // archivo opcional dejaría «Crear» bloqueado sin salida.
  const [failed, setFailed] = useState(false);
  const answer = field.value && typeof field.value === 'object' && 'kind' in field.value ? (field.value as FileAnswer) : null;

  const clearInput = () => {
    if (fileInput.current) fileInput.current.value = '';
  };
  const reject = (key: TranslationKey, params?: Record<string, string | number>) => {
    clearInput();
    onMessage(t(language, key, params));
    setFailed(true);
    onFileError(true);
    onChange({ value: undefined, file: null });
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const mine = ++token.current;
    const limit = field.maxBytes ?? DEFAULT_FILE_MAX_BYTES;
    if (file.size > limit) {
      reject('asis.file.tooBig', { max: formatLocaleNumber(language, limit / (1024 * 1024), { maxFrac: 1 }) });
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (mine !== token.current) return;
      const kind = sniffFileKind(bytes);
      if (!kind || (field.accept && !field.accept.includes(kind))) {
        reject('asis.file.badType', { types: (field.accept ?? []).map((a) => a.toUpperCase()).join(', ') });
        return;
      }
      const content = kind === 'svg' ? new TextDecoder().decode(bytes) : bytes;
      onMessage(null);
      setFailed(false);
      onFileError(false);
      onChange({ value: { kind, bytes: file.size, name: file.name.slice(0, 200) }, file: content });
    } catch {
      if (mine !== token.current) return;
      // La lectura falló: no deben quedar la respuesta ni el archivo anteriores.
      clearInput();
      onMessage(null);
      setFailed(true);
      onFileError(true);
      onChange({ value: undefined, file: null });
    }
  };

  return (
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
      {(answer || failed) && (
        <button
          type="button"
          className="kura-mini-icon-btn"
          disabled={disabled}
          aria-label={t(language, 'asis.file.remove')}
          title={t(language, 'asis.file.remove')}
          onClick={() => {
            token.current += 1;
            clearInput();
            onMessage(null);
            setFailed(false);
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
};
