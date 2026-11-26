/**
 * @file src/components/useBoundOperationTarget.ts
 * @description Liga un panel de operación (dividir, cortar, molde, proyectar) al objeto con el que se
 * abrió: guarda su id al abrir, de modo que los clics en el visor (que cambian o vacían la selección)
 * no cambian el objetivo ni borran los ajustes. Si el objeto deja de existir mientras el panel está
 * abierto (y no fue la propia operación la que lo reemplazó), avisa y cierra el panel.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { SceneObject } from '../types/kura';

export interface BoundOperationTarget {
  target: SceneObject | null;
  targetId: string | null;
  /** Llamar antes de ejecutar la operación: el objeto desaparecerá por ella y no debe avisarse. */
  markConsumed: () => void;
}

export function useBoundOperationTarget(open: boolean, onClose: () => void): BoundOperationTarget {
  const [boundId, setBoundId] = useState<string | null>(null);
  const consumed = useRef(false);
  const target = useKuraStore((s) => (boundId ? s.objects.find((o) => o.id === boundId) ?? null : null));
  const busy = useKuraStore((s) => Boolean(s.busyOperation));

  // Al abrir se fija el objetivo: la selección vigente o, si no hay, el primer objeto.
  useEffect(() => {
    if (!open) {
      setBoundId(null);
      consumed.current = false;
      return;
    }
    const { selectedIds, objects } = useKuraStore.getState();
    setBoundId(selectedIds[0] ?? objects[0]?.id ?? null);
    consumed.current = false;
  }, [open]);

  // Sin objetivo ligado (panel abierto con la escena vacía), adopta el primero que se seleccione.
  const selectedFirst = useKuraStore((s) => s.selectedIds[0] ?? null);
  useEffect(() => {
    if (open && !boundId && selectedFirst) setBoundId(selectedFirst);
  }, [open, boundId, selectedFirst]);

  useEffect(() => {
    if (!open || !boundId || target || busy || consumed.current) return;
    const { addToast, language } = useKuraStore.getState();
    addToast(t(language, 'operation.targetGone'), 'info');
    onClose();
  }, [open, boundId, target, busy, onClose]);

  return {
    target,
    targetId: target?.id ?? null,
    markConsumed: () => {
      consumed.current = true;
    },
  };
}
