/**
 * @file src/components/StatusBar.tsx
 * @description Barra de estado inferior de Kurra Studio con estado de runtime (Tauri/Web),
 * motor Manifold WASM, indicador de unidad e impresora (popover), conteo de triángulos, línea de ayuda del
 * control bajo el cursor o el foco (zona propia en el centro) y atajos rápidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { t } from '../i18n';
import type { RecoveryFailure, RecoveryStatus } from '../project/projectRecoveryAutosave';
import { useKuraStore } from '../store/useKuraStore';
import { isTauriRuntime } from '../utils/platformBridge';
import '../styles/statusFit1100.css';
import { RecoveryStatusNotice } from './RecoveryStatusNotice';
import { StatusBarCount } from './StatusBarCount';
import { StatusBarMeasures } from './StatusBarMeasures';
import { StatusHelpLine } from './shell/StatusHelpLine';
import { operationLabel } from './viewport/OperationProgressBar';

export const StatusBar: React.FC<{ recoveryStatus?: RecoveryStatus; recoveryFailure?: RecoveryFailure | null }> = ({
  recoveryStatus = 'idle', recoveryFailure = null,
}) => {
  const language = useKuraStore((s) => s.language);
  const engineReady = useKuraStore((s) => s.engineReady);
  const engineError = useKuraStore((s) => s.engineError);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const projectBusy = useKuraStore((s) => s.projectBusy);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  const isNative = useMemo(() => isTauriRuntime(), []);

  const engineLabel = engineError
    ? t(language, 'status.engine.error')
    : engineReady
      ? t(language, 'status.engine.ready')
      : t(language, 'status.engine.loading');


  return (
    <footer className="kura-statusbar">
      <div className="kura-statusbar-group">
        <span>
          {isNative
            ? t(language, 'status.runtime.tauri')
            : t(language, 'status.runtime.web')}
        </span>

        <span
          role="status"
          style={{
            color: engineError
              ? 'var(--accent-red)'
              : engineReady
                ? 'var(--accent-green)'
                : 'var(--accent-amber)',
            fontWeight: 600,
          }}
        >
          ● {projectBusy
            ? t(language, 'fileProject.working')
            : busyOperation ? `${engineLabel} (${operationLabel(language, busyOperation)})` : engineLabel}
        </span>

        <StatusBarMeasures />
        <StatusBarCount />
      </div>

      <StatusHelpLine />

      <div className="kura-statusbar-group">
        <RecoveryStatusNotice status={recoveryStatus} failure={recoveryFailure} />
        <button
          type="button"
          className="kura-statusbar-btn kura-statusbar-shortcuts"
          onClick={() => setActiveDialog('shortcuts')}
          title={t(language, 'cmd.view.shortcuts')}
        >
          <HelpCircle size={12} />
          <span>{t(language, 'status.shortcutsBtn')}</span>
        </button>
        <span className="kura-statusbar-copyright" title={t(language, 'status.copyright')}>
          <span className="kura-copyright-full">{t(language, 'status.copyright')}</span>
          <span className="kura-copyright-short" aria-hidden="true">{t(language, 'ux8.status.copyrightShort')}</span>
        </span>
      </div>
    </footer>
  );
};
