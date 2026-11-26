/**
 * @file src/components/assistants/AssistantPreviewBar.tsx
 * @description Barra «Vista previa» del formulario del asistente: interruptor (activado por defecto y recordado en la
 * sesión), indicador discreto mientras calcula y, si el cálculo es demasiado pesado, el aviso «pausada» con un botón para
 * actualizarla a mano. El estado se anuncia sin interrumpir (`aria-live="polite"`) y nunca solo por color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { CircleAlert, Eye, LoaderCircle, RefreshCw } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { refreshAssistantPreview, setAssistantPreviewEnabled, useAssistantPreview, type AssistantPreviewStatus } from '../../store/assistantPreview';
import { useKuraStore } from '../../store/useKuraStore';
import { AssistantScrewFitNotice } from './AssistantScrewFitNotice';
import '../../styles/assistantsPreview.css';

const STATUS_TEXT: Partial<Record<AssistantPreviewStatus, TranslationKey>> = {
  computing: 'asis.preview.computing',
  ready: 'asis.preview.ready',
  invalid: 'asis.preview.invalid',
  heavy: 'asis.preview.heavy',
  failed: 'asis.preview.failed',
};

export const AssistantPreviewBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const enabled = useAssistantPreview((s) => s.enabled);
  const status = useAssistantPreview((s) => s.status);
  const uid = useId();
  const key = enabled ? STATUS_TEXT[status] : undefined;
  const warn = enabled && (status === 'heavy' || status === 'failed');
  return (
    <div className="kura-asis-preview">
      <label className="kura-asis-preview-toggle" htmlFor={`${uid}-toggle`} title={t(language, 'asis.preview.tip')}>
        <input
          id={`${uid}-toggle`}
          type="checkbox"
          className="kura-asis-check"
          checked={enabled}
          onChange={(e) => setAssistantPreviewEnabled(e.target.checked)}
        />
        <Eye size={14} aria-hidden="true" />
        <span>{t(language, 'asis.preview.label')}</span>
      </label>
      <div className={`kura-asis-preview-status${warn ? ' is-warn' : ''}`} aria-live="polite" aria-atomic="true" data-status={enabled ? status : 'off'}>
        {key && (
          <>
            {status === 'computing' && <LoaderCircle size={13} className="kura-asis-spin" aria-hidden="true" />}
            {warn && <CircleAlert size={13} aria-hidden="true" />}
            <span>{t(language, key)}</span>
          </>
        )}
      </div>
      {enabled && status === 'ready' && <AssistantScrewFitNotice />}
      {enabled && status === 'heavy' && (
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'asis.preview.refreshTip')}
          onClick={() => refreshAssistantPreview()}
        >
          <RefreshCw size={13} aria-hidden="true" />
          <span>{t(language, 'asis.preview.refresh')}</span>
        </button>
      )}
    </div>
  );
};
