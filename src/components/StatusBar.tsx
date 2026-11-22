/**
 * @file src/components/StatusBar.tsx
 * @description Barra de estado inferior de Kura3D con estado de runtime (Tauri/Web),
 * motor Manifold WASM, perfil de impresora, conteo de triángulos y atajos rápidos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { getLocalizedPrinterName, t } from '../i18n';
import type { RecoveryStatus } from '../project/projectRecoveryAutosave';
import { useKuraStore } from '../store/useKuraStore';
import { formatNumber } from '../utils/plural';
import { isTauriRuntime } from '../utils/platformBridge';

export const StatusBar: React.FC<{ recoveryStatus?: RecoveryStatus }> = ({ recoveryStatus = 'idle' }) => {
  const language = useKuraStore((s) => s.language);
  const engineReady = useKuraStore((s) => s.engineReady);
  const engineError = useKuraStore((s) => s.engineError);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const projectBusy = useKuraStore((s) => s.projectBusy);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const objects = useKuraStore((s) => s.objects);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  const isNative = useMemo(() => isTauriRuntime(), []);
  const totalTriangles = useMemo(
    () => objects.reduce((acc, obj) => acc + obj.stats.triangles, 0),
    [objects],
  );

  const engineLabel = engineError
    ? t(language, 'status.engine.error')
    : engineReady
      ? t(language, 'status.engine.ready')
      : t(language, 'status.engine.loading');

  const recoveryLabel = recoveryStatus === 'ready'
    ? t(language, 'recovery.status.ready')
    : recoveryStatus === 'unavailable'
      ? t(language, 'recovery.status.unavailable')
      : recoveryStatus === 'idle' ? null : t(language, 'recovery.status.working');

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
            : busyOperation ? `${engineLabel} (${busyOperation})` : engineLabel}
        </span>

        <span>{getLocalizedPrinterName(language, printerProfile)}</span>
        <span>{unitSystem}</span>
        <span>
          {t(language, 'status.objects', { count: objects.length })} ·{' '}
          {t(language, 'status.triangles', { count: formatNumber(language, totalTriangles) })}
        </span>
      </div>

      <div className="kura-statusbar-group">
        {recoveryLabel && <span role="status">{recoveryLabel}</span>}
        <span className="kura-statusbar-hint" style={{ opacity: 0.78 }}>
          {t(language, 'status.shortcuts')}
        </span>
        <button
          type="button"
          className="kura-statusbar-btn"
          onClick={() => setActiveDialog('shortcuts')}
          title={t(language, 'cmd.view.shortcuts')}
        >
          <HelpCircle size={12} />
          <span>{t(language, 'status.shortcutsBtn')}</span>
        </button>
        <span>{t(language, 'status.copyright')}</span>
      </div>
    </footer>
  );
};
