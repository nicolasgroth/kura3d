/**
 * @file src/components/booleanPreview/useBooleanPreview.ts
 * @description Hook común de las booleanas con vista previa fantasma (barra del visor e inspector):
 * base y herramienta de la selección, props de cada botón (cursor, foco, clic) e inversión de roles.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useCallback } from 'react';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanOpType, SceneObject } from '../../types/kura';

export interface BooleanPreviewApi {
  base: SceneObject | undefined;
  tool: SceneObject | undefined;
  busy: boolean;
  previewStatus: string;
  /** Hay una vista previa booleana en curso o mostrada. */
  previewing: boolean;
  swapRoles: () => void;
  /** Props de un botón de operación: previsualiza al pasar el cursor o enfocar y ejecuta al activar. */
  buttonProps: (op: BooleanOpType) => {
    'aria-pressed': boolean;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onClick: () => void;
  };
}

export function useBooleanPreview(): BooleanPreviewApi {
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const previewKey = useKuraStore((s) => s.operationPreview.key);
  const previewStatus = useKuraStore((s) => s.operationPreview.status);
  const previewBoolean = useKuraStore((s) => s.previewBooleanOnSelection);
  const clearPreview = useKuraStore((s) => s.clearOperationPreview);
  const swapRoles = useKuraStore((s) => s.swapBooleanRoles);
  const runBoolean = useKuraStore((s) => s.runBooleanOnSelection);

  const buttonProps = useCallback(
    (op: BooleanOpType) => ({
      'aria-pressed': previewKey === `boolean:${op}`,
      onPointerEnter: () => previewBoolean(op),
      onPointerLeave: () => clearPreview(`boolean:${op}`),
      onFocus: () => previewBoolean(op),
      onBlur: () => clearPreview(`boolean:${op}`),
      onClick: () => {
        clearPreview();
        void runBoolean(op);
      },
    }),
    [previewKey, previewBoolean, clearPreview, runBoolean],
  );

  return {
    base: objects.find((o) => o.id === selectedIds[0]),
    tool: objects.find((o) => o.id === selectedIds[1]),
    busy,
    previewStatus,
    previewing: previewKey?.startsWith('boolean:') ?? false,
    swapRoles,
    buttonProps,
  };
}
