/**
 * @file src/components/contextPanel/InlineFactEditor.tsx
 * @description Dato del panel «Proyecto» con lápiz que despliega su editor ahí mismo (bajo el valor), sin saltar a
 * otra zona de la pantalla: el lápiz lleva `aria-expanded`/`aria-controls`, el editor recibe el foco al abrir y
 * Esc (o el botón Listo) lo pliega devolviendo el foco al lápiz. Lo usan «Cama activa» y «Unidades».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs, helpText, type HelpId } from '../shell/controlHelp';

const FOCUSABLE = 'select, input, button';

export const InlineFactEditor: React.FC<{
  help: HelpId;
  /** Valor visible cuando el editor está plegado. */
  value: React.ReactNode;
  title?: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ help, value, title, testId, children }) => {
  const language = useKuraStore((s) => s.language);
  const [open, setOpen] = useState(false);
  const editorId = useId();
  const pencilRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) editorRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => pencilRef.current?.focus());
  };

  return (
    <>
      <span className="kura-project-name-row">
        <span className="kura-project-name-text" title={title}>{value}</span>
        <button
          ref={pencilRef}
          type="button"
          className={`kura-mini-icon-btn kura-fact-edit${open ? ' is-active' : ''}`}
          aria-label={helpText(language, help).name}
          aria-expanded={open}
          aria-controls={editorId}
          data-testid={testId}
          onClick={() => (open ? close() : setOpen(true))}
          {...helpAttrs(help, language)}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
      </span>
      {open && (
        <div
          id={editorId}
          ref={editorRef}
          className="kura-fact-editor"
          role="group"
          aria-label={helpText(language, help).name}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          {children}
          <button type="button" className="kura-btn kura-btn-sm kura-fact-done" title={t(language, 'r3a.edit.close')} onClick={close}>
            <Check size={13} aria-hidden="true" />
            <span>{t(language, 'r3a.edit.done')}</span>
          </button>
        </div>
      )}
    </>
  );
};
