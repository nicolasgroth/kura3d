/**
 * @file src/components/viewport/ViewportProTip.tsx
 * @description Píldora de consejos del visor con acceso directo a la guía de atajos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { HelpCircle, Lightbulb, X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

/** Píldora contextual de consejos y acceso a Atajos (?). */
export const ViewportProTip: React.FC = () => {
  const [tipDismissed, setTipDismissed] = useState(false);
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
          <span className="kura-protip-text">
            {t(language, `viewport.protip.${activeTool}`)}
          </span>
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
