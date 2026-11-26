/**
 * @file src/components/viewport/ViewportProTip.tsx
 * @description Píldora de consejos del visor con acceso directo a la guía de atajos. El consejo es una sola línea
 * truncada; un botón con `aria-expanded` lo despliega completo (accesible por teclado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb, X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewportProTip.css';

/** Píldora contextual de consejos y acceso a Atajos (?). */
export const ViewportProTip: React.FC = () => {
  const [tipDismissed, setTipDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const language = useKuraStore((s) => s.language);
  const activeTool = useKuraStore((s) => s.activeTool);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  return (
    <div className="kura-protip-wrap">
      {tipDismissed ? (
        <button
          type="button"
          className="kura-hud-card kura-protip-collapsed"
          onClick={() => setTipDismissed(false)}
          title={t(language, 'viewport.protip.show')}
          aria-label={t(language, 'viewport.protip.show')}
        >
          <Lightbulb size={13} style={{ color: 'var(--accent-amber)' }} />
          <span>?</span>
        </button>
      ) : (
        <div className="kura-hud-card kura-protip-pill">
          <Lightbulb size={13} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
          <span id={textId} className={`kura-protip-text${expanded ? ' is-expanded' : ' is-clamped'}`} title={t(language, `viewport.protip.${activeTool}`)}>
            {t(language, `viewport.protip.${activeTool}`)}
          </span>
          <button
            type="button"
            className="kura-mini-icon-btn"
            aria-expanded={expanded}
            aria-controls={textId}
            data-testid="protip-expand"
            onClick={() => setExpanded((v) => !v)}
            title={t(language, 'viewport.protip.expand')}
            aria-label={t(language, 'viewport.protip.expand')}
          >
            {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-protip-help-btn"
            onClick={() => setActiveDialog('shortcuts')}
            title={t(language, 'status.shortcutsBtn')}
            aria-label={t(language, 'status.shortcutsBtn')}
          >
            <HelpCircle size={12} />
            <span>?</span>
          </button>
          <button
            type="button"
            className="kura-mini-icon-btn"
            onClick={() => setTipDismissed(true)}
            title={t(language, 'viewport.protip.hide')}
            aria-label={t(language, 'viewport.protip.hide')}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
