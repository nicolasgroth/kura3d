/**
 * @file src/components/ConfirmDialogHost.tsx
 * @description Dibuja el diálogo de decisión accesible (reemplazo de `confirm()` nativo) sobre `NativeModal`:
 * foco inicial en la acción segura, Escape o cerrar = Cancelar, acciones con texto (no solo color).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useCallback, useEffect, useRef } from 'react';
import { CANCEL_DECISION, settleDecision, useDecisionStore } from '../utils/confirmDialog';
import { NativeModal } from './NativeModal';

export function ConfirmDialogHost() {
  const request = useDecisionStore((state) => state.request);
  const footer = useRef<HTMLDivElement>(null);
  const safeId = request?.safeId;
  const token = request?.token;

  // Cierre por Escape, clic fuera o la X: equivale a Cancelar.
  const onClose = useCallback(() => settleDecision(CANCEL_DECISION), []);

  useEffect(() => {
    if (token === undefined) return;
    const frame = requestAnimationFrame(() => {
      footer.current?.querySelector<HTMLButtonElement>('[data-safe="true"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [token, safeId]);

  return (
    <NativeModal
      open={Boolean(request)}
      onClose={onClose}
      title={request?.title ?? ''}
      className="kura-dialog-confirm"
      footer={request && (
        <div ref={footer} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {request.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-safe={action.id === request.safeId ? 'true' : undefined}
              className={`kura-btn ${action.tone === 'primary' ? 'kura-btn-primary' : ''} ${action.tone === 'danger' ? 'kura-btn-danger' : ''}`}
              onClick={() => settleDecision(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }} role="alert">{request?.message}</p>
    </NativeModal>
  );
}
