/**
 * @file src/components/contextPanel/PanelFold.tsx
 * @description Envoltura plegable de una sección del resumen del objeto: un botón (con `aria-expanded` y el
 * nombre de la sección) arriba a la derecha de la tarjeta la pliega a su título; el estado se recuerda
 * (`panelFoldPrefs`). No cambia la sección que envuelve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { usePanelFolds } from '../../store/panelFoldPrefs';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/toolPanel.css';

export const PanelFold: React.FC<{ id: string; title: TranslationKey; children: React.ReactNode }> = ({ id, title, children }) => {
  const language = useKuraStore((s) => s.language);
  const folded = usePanelFolds((s) => s.folded.includes(id));
  const toggle = usePanelFolds((s) => s.toggle);
  const name = t(language, title);
  const label = t(language, folded ? 'rediseno3b.fold.expand' : 'rediseno3b.fold.collapse', { name });
  const contentId = `kura-fold-${id}`;

  const button = (
    <button
      type="button"
      className="kura-btn kura-btn-sm kura-btn-icon kura-fold-toggle"
      aria-expanded={!folded}
      aria-controls={folded ? undefined : contentId}
      aria-label={label}
      title={label}
      data-fold={id}
      onClick={() => toggle(id)}
    >
      {folded ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
    </button>
  );

  if (folded) {
    return (
      <section className="kura-card kura-fold is-folded" aria-label={name}>
        <h3 className="kura-section-label">{name}</h3>
        {button}
      </section>
    );
  }
  return (
    <div className="kura-fold" id={contentId}>
      {button}
      {children}
    </div>
  );
};
