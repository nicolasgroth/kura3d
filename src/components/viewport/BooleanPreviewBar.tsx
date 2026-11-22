/**
 * @file src/components/viewport/BooleanPreviewBar.tsx
 * @description Barra flotante del visor con 2+ piezas seleccionadas: Unir/Restar/Intersectar con
 * vista previa fantasma al pasar el cursor o enfocar, rótulos de base y herramienta (con texto y
 * estilo de borde, no solo color) e "Invertir" para intercambiarlas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanOpType } from '../../types/kura';
import '../../styles/operationPreview.css';

const OPS: Array<{ op: BooleanOpType; key: 'inspector.op.union' | 'inspector.op.subtract' | 'inspector.op.intersect' }> = [
  { op: 'union', key: 'inspector.op.union' },
  { op: 'subtract', key: 'inspector.op.subtract' },
  { op: 'intersect', key: 'inspector.op.intersect' },
];

export const BooleanPreviewBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const activeDialog = useKuraStore((s) => s.activeDialog);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const previewKey = useKuraStore((s) => s.operationPreview.key);
  const previewStatus = useKuraStore((s) => s.operationPreview.status);
  const previewBoolean = useKuraStore((s) => s.previewBooleanOnSelection);
  const clearPreview = useKuraStore((s) => s.clearOperationPreview);
  const swapRoles = useKuraStore((s) => s.swapBooleanRoles);
  const runBoolean = useKuraStore((s) => s.runBooleanOnSelection);

  if (selectedIds.length < 2 || activeDialog !== null) return null;
  const base = objects.find((o) => o.id === selectedIds[0]);
  const tool = objects.find((o) => o.id === selectedIds[1]);
  if (!base || !tool) return null;

  const end = (op: BooleanOpType) => clearPreview(`boolean:${op}`);
  const previewing = previewKey?.startsWith('boolean:') ?? false;

  return (
    <div className="kura-bool-bar" role="toolbar" aria-label={t(language, 'boolPreview.title')}>
      {OPS.map(({ op, key }) => (
        <button
          key={op}
          type="button"
          className={op === 'subtract' ? 'kura-btn kura-btn-sm kura-btn-amber' : 'kura-btn kura-btn-sm'}
          disabled={busy}
          title={t(language, 'boolPreview.hint')}
          aria-pressed={previewKey === `boolean:${op}`}
          onPointerEnter={() => previewBoolean(op)}
          onPointerLeave={() => end(op)}
          onFocus={() => previewBoolean(op)}
          onBlur={() => end(op)}
          onClick={() => {
            clearPreview();
            void runBoolean(op);
          }}
        >
          {t(language, key)}
        </button>
      ))}
      <span className="kura-bool-bar-roles">
        <span className="kura-bool-chip" data-role="base" title={base.name}>
          {t(language, 'boolPreview.base')}: {base.name}
        </span>
        <span className="kura-bool-chip" data-role="tool" title={tool.name}>
          {t(language, 'boolPreview.tool')}: {tool.name}
        </span>
      </span>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={busy}
        title={t(language, 'boolPreview.invertTip')}
        aria-label={`${t(language, 'boolPreview.invert')} — ${t(language, 'boolPreview.roles', { base: base.name, tool: tool.name })}`}
        onClick={swapRoles}
      >
        <ArrowLeftRight size={12} aria-hidden="true" />
        <span>{t(language, 'boolPreview.invert')}</span>
      </button>
      {previewing && previewStatus === 'pending' && (
        <span className="kura-preview-status" role="status">
          {t(language, 'preview.computing')}
        </span>
      )}
    </div>
  );
};
