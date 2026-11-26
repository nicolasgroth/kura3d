/**
 * @file src/components/inspector/SimplifyOpenMeshNotice.tsx
 * @description Bloqueo de Simplificar cuando la malla no es un sólido cerrado: aviso con el mismo estilo que el de
 * cambio de forma (icono y texto, no solo color), sin el término técnico a la vista (queda en un «Detalle técnico»
 * plegado) y un botón «Reparar malla» que lanza la reparación existente de esa pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { AlertTriangle, Wrench } from 'lucide-react';
import React from 'react';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';

interface Props {
  language: LanguageCode;
  /** Causa técnica del motor (p. ej. `NotManifold`), si la hay. */
  detail?: string;
  busy: boolean;
  onRepair: () => void;
}

export const SimplifyOpenMeshNotice: React.FC<Props> = ({ language, detail, busy, onRepair }) => (
  <div className="kura-simplify-open-mesh" data-testid="simplify-open-mesh">
    <p className="kura-simplify-notice" role="alert" data-testid="simplify-open-mesh-text">
      <AlertTriangle size={14} aria-hidden="true" />
      <strong>{t(language, 'simplify.error.meshInvalid')}</strong>
    </p>
    <div className="kura-simplify-blocked-actions">
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        data-testid="simplify-open-mesh-repair"
        title={t(language, 'simplify.error.repairTip')}
        disabled={busy}
        onClick={onRepair}
      >
        <Wrench size={13} aria-hidden="true" />
        <span>{t(language, 'simplify.error.repair')}</span>
      </button>
    </div>
    {detail && (
      <details className="kura-simplify-technical">
        <summary>{t(language, 'simplify.error.technical')}</summary>
        <code>{detail}</code>
      </details>
    )}
  </div>
);
