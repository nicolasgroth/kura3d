/**
 * @file src/components/inspector/SimplifyOpenMeshNotice.tsx
 * @description Aviso de Simplificar cuando la malla no es un sólido cerrado. Al abrir el panel es una ADVERTENCIA que deja
 * seguir (`warn`: al simplificar sin reparar el motor intenta soldar los vértices cercanos y, si no logra cerrarla, no
 * aplica nada); si el motor ya la rechazó es el bloqueo (`blocked`: repárala antes). Mismo estilo: aviso con el mismo estilo que el de
 * cambio de forma (icono y texto, no solo color), sin el término técnico a la vista (queda en un «Detalle técnico»
 * plegado) y un botón «Reparar malla» que lanza la reparación existente de esa pieza. Mientras repara, el botón sigue
 * en su sitio con el foco (`aria-disabled`, no `disabled`) y un estado «Reparando la malla…» al lado.
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
  /** Reparando desde este aviso: el botón no actúa pero conserva el foco, y se dice el estado. */
  repairing?: boolean;
  /** `warn`: advertencia previa (se puede seguir); `blocked`: el motor rechazó la malla. */
  variant?: 'warn' | 'blocked';
  onRepair: () => void;
}

export const SimplifyOpenMeshNotice: React.FC<Props> = ({ language, detail, busy, repairing = false, variant = 'blocked', onRepair }) => (
  <div className="kura-simplify-open-mesh" data-testid="simplify-open-mesh">
    <p className="kura-simplify-notice" role={variant === 'warn' ? 'note' : 'alert'} data-testid="simplify-open-mesh-text">
      <AlertTriangle size={14} aria-hidden="true" />
      <strong>{t(language, variant === 'warn' ? 'simplify.error.meshOpenWarn' : 'simplify.error.meshInvalid')}</strong>
    </p>
    <div className="kura-simplify-blocked-actions">
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-btn-primary"
        data-testid="simplify-open-mesh-repair"
        title={t(language, 'simplify.error.repairTip')}
        disabled={busy && !repairing}
        aria-disabled={repairing || undefined}
        onClick={onRepair}
      >
        <Wrench size={13} aria-hidden="true" />
        <span>{t(language, 'simplify.error.repair')}</span>
      </button>
      {repairing && <span className="kura-cut-hint" role="status" data-testid="simplify-open-mesh-repairing">{t(language, 'simplify.error.repairing')}</span>}
    </div>
    {detail && (
      <details className="kura-simplify-technical">
        <summary>{t(language, 'simplify.error.technical')}</summary>
        <code>{detail}</code>
      </details>
    )}
  </div>
);
