/**
 * @file src/components/contextPanel/ProjectNameField.tsx
 * @description Nombre del proyecto en el panel «Proyecto», editable en línea: el lápiz (clic, Enter o F2) lo
 * vuelve un campo; Enter confirma, Esc cancela y salir del campo confirma si es válido. Un nombre vacío no se
 * acepta (aviso en el campo). El cambio lo hace `renameProject` del store y deja el proyecto con cambios sin
 * guardar; el foco vuelve al lápiz.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs } from '../shell/controlHelp';

const EXTENSION = /\.kura$/i;

export const ProjectNameField: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const projectName = useKuraStore((s) => s.projectName);
  const renameProject = useKuraStore((s) => s.renameProject);
  const blocked = useKuraStore((s) => s.projectBusy);
  const addToast = useKuraStore((s) => s.addToast);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);
  /** Evita confirmar dos veces (Enter y luego el blur al desmontar el campo). */
  const openRef = useRef(false);
  const errorId = useId();
  const hintId = useId();
  const name = projectName ?? t(language, 'app.untitled');
  const empty = draft.trim().length === 0;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    if (blocked) return;
    setDraft(name.replace(EXTENSION, ''));
    openRef.current = true;
    setEditing(true);
  };

  const finish = (commit: boolean) => {
    if (!openRef.current) return;
    openRef.current = false;
    if (commit && !empty) {
      const before = useKuraStore.getState().projectName;
      if (renameProject(draft)) {
        const after = useKuraStore.getState().projectName;
        if (after && after !== before) addToast(t(language, 'r3a.name.renamed', { name: after }), 'info');
      }
    }
    setEditing(false);
    requestAnimationFrame(() => pencilRef.current?.focus());
  };

  if (editing) {
    return (
      <span className="kura-project-name-edit">
        <input
          ref={inputRef}
          className="kura-input"
          value={draft}
          maxLength={120}
          aria-label={t(language, 'r3a.name.field')}
          aria-invalid={empty || undefined}
          aria-describedby={empty ? errorId : hintId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // El campo consume sus teclas: Esc no cierra el panel ni dispara atajos globales.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!empty) finish(true);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              finish(false);
            }
          }}
          onBlur={() => finish(!empty)}
        />
        {empty ? (
          <span id={errorId} role="alert" className="kura-field-error">{t(language, 'r3a.name.empty')}</span>
        ) : (
          <span id={hintId} className="kura-ctx-sub">{t(language, 'r3a.name.hint')}</span>
        )}
      </span>
    );
  }

  return (
    <span className="kura-project-name-row">
      <span className="kura-project-name-text" title={name}>{name}</span>
      <button
        ref={pencilRef}
        type="button"
        className="kura-mini-icon-btn kura-fact-edit"
        aria-label={t(language, 'r3a.name.edit')}
        disabled={blocked}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();
            start();
          }
        }}
        {...helpAttrs('project.rename', language)}
        title={t(language, 'r3a.name.editTip')}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </span>
  );
};
