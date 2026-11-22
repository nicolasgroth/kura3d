/**
 * @file src/components/OperationFailureAlert.tsx
 * @description Aviso de fallo de operación para diálogos: el diálogo queda abierto con sus valores
 * y el mensaje del motor visible con `role="alert"`. El hook ejecuta la operación, lee el fallo que
 * registró el store y lo expone; la lógica de la operación sigue en el store.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useKuraStore } from '../store/useKuraStore';

/** Estado de fallo de un diálogo de operación; se limpia al cerrarse el diálogo. */
export function useOperationFailure(open: boolean) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  /** Ejecuta `op`; devuelve su resultado y `failed` si el store registró un error. */
  const run = useCallback(async <T,>(op: () => Promise<T>): Promise<{ result: T; failed: boolean }> => {
    useKuraStore.setState({ lastOperationError: null });
    setError(null);
    const result = await op();
    const message = useKuraStore.getState().lastOperationError;
    setError(message);
    return { result, failed: message !== null };
  }, []);

  return { error, run };
}

export const OperationFailureAlert: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="kura-op-failure"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '8px 10px',
        marginBottom: 10,
        borderRadius: 6,
        border: '1px solid var(--accent-red)',
        background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
        color: 'var(--text-primary, inherit)',
        fontSize: 12,
      }}
    >
      <AlertTriangle size={14} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
};
