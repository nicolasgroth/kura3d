/**
 * @file src/components/viewport/BooleanPreviewBar.tsx
 * @description Barra flotante del visor con 2+ piezas seleccionadas: Unir/Restar/Intersectar con
 * vista previa fantasma al pasar el cursor o enfocar, rótulos de base y herramienta (con texto y
 * estilo de borde, no solo color) e "Invertir" para intercambiarlas. La lógica es el hook común
 * `useBooleanPreview`, compartido con el inspector. Solo aparece cuando el inspector no se ve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanOpType } from '../../types/kura';
import { BooleanRoles } from '../booleanPreview/BooleanRoles';
import { useBooleanPreview } from '../booleanPreview/useBooleanPreview';
import { useInspectorVisible } from './useInspectorVisible';
import '../../styles/operationPreview.css';
import '../../styles/booleanBar.css';

const OPS: Array<{ op: BooleanOpType; key: 'inspector.op.union' | 'inspector.op.subtract' | 'inspector.op.intersect' }> = [
  { op: 'union', key: 'inspector.op.union' },
  { op: 'subtract', key: 'inspector.op.subtract' },
  { op: 'intersect', key: 'inspector.op.intersect' },
];

export const BooleanPreviewBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const selectedCount = useKuraStore((s) => s.selectedIds.length);
  const activeDialog = useKuraStore((s) => s.activeDialog);
  const api = useBooleanPreview();
  // Con el inspector a la vista los controles viven solo allí: la barra no los duplica.
  const inspectorVisible = useInspectorVisible();

  if (selectedCount < 2 || activeDialog !== null || inspectorVisible || !api.base || !api.tool) return null;

  return (
    <div className="kura-bool-bar" role="toolbar" aria-label={t(language, 'boolPreview.title')}>
      {OPS.map(({ op, key }) => (
        <button
          key={op}
          type="button"
          className={op === 'subtract' ? 'kura-btn kura-btn-sm kura-btn-amber' : 'kura-btn kura-btn-sm'}
          disabled={api.busy}
          title={t(language, 'boolPreview.hint')}
          {...api.buttonProps(op)}
        >
          {t(language, key)}
        </button>
      ))}
      <BooleanRoles api={api} />
      {api.previewing && api.previewStatus === 'pending' && (
        <span className="kura-preview-status" role="status">
          {t(language, 'preview.computing')}
        </span>
      )}
    </div>
  );
};
