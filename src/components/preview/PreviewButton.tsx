/**
 * @file src/components/preview/PreviewButton.tsx
 * @description Botón "Previsualizar" para operaciones caras (molde, rosca): calcula bajo demanda
 * la vista previa fantasma en el Worker y muestra su estado. Si cambian los parámetros o se
 * cierra el panel, la vista previa obsoleta se limpia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { t } from '../../i18n';
import type { PreviewRequest } from '../../store/slices/previewSlice';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/operationPreview.css';

export const PreviewButton: React.FC<{
  previewKey: string;
  /** Petición de vista previa con los parámetros actuales (null si no se puede). */
  buildRequest: () => PreviewRequest | null;
  /** Firma de los parámetros: si cambia, la vista previa mostrada deja de valer. */
  signature: string;
  open: boolean;
}> = ({ previewKey, buildRequest, signature, open }) => {
  const language = useKuraStore((s) => s.language);
  const active = useKuraStore((s) => s.operationPreview.key === previewKey);
  const status = useKuraStore((s) => s.operationPreview.status);
  const request = useKuraStore((s) => s.requestOperationPreview);
  const clear = useKuraStore((s) => s.clearOperationPreview);

  useEffect(() => {
    clear(previewKey);
  }, [signature, open, previewKey, clear]);
  useEffect(() => () => clear(previewKey), [previewKey, clear]);

  const onClick = () => {
    if (active) {
      clear(previewKey);
      return;
    }
    const req = buildRequest();
    if (req) request({ ...req, key: previewKey, delayMs: 0 });
  };

  return (
    <div className="kura-preview-status" data-state={active ? status : 'idle'}>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        aria-pressed={active}
        title={t(language, active ? 'preview.hide' : 'preview.buttonTip')}
        onClick={onClick}
      >
        {active ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
        <span>{t(language, active ? 'preview.hide' : 'preview.button')}</span>
      </button>
      {active && (
        <span role="status">
          {status === 'pending' ? t(language, 'preview.computing') : status === 'error' ? t(language, 'preview.failed') : t(language, 'preview.ready')}
        </span>
      )}
    </div>
  );
};
