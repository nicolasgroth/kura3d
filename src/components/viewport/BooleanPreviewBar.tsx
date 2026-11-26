/**
 * @file src/components/viewport/BooleanPreviewBar.tsx
 * @description Barra flotante del visor con 2+ piezas seleccionadas: Unir/Restar/Intersectar con
 * vista previa fantasma al pasar el cursor o enfocar, rótulos de base y herramienta (con texto y
 * estilo de borde, no solo color) e "Invertir" para intercambiarlas. La lógica es el hook común
 * `useBooleanPreview`, compartido con el inspector. Solo aparece cuando el inspector no se ve.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { BooleanOpType } from '../../types/kura';
import { BooleanRoles } from '../booleanPreview/BooleanRoles';
import { useBooleanPreview } from '../booleanPreview/useBooleanPreview';
import { useMagnetPanel } from '../../store/magnetPanel';
import { useScrewBossPanel } from '../../store/screwBossPanel';
import { useKeyholePanel } from '../../store/keyholePanel';
import { useCablePassPanel } from '../../store/cablePassPanel';
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
  // Con el panel de imán abierto la barra flotante taparía el visor donde se coloca: se oculta.
  const magnetOpen = useMagnetPanel((s) => s.open);
  const screwBossOpen = useScrewBossPanel((s) => s.open);
  const keyholeOpen = useKeyholePanel((s) => s.open);
  const cablePassOpen = useCablePassPanel((s) => s.open);
  const visible = !(magnetOpen || screwBossOpen || keyholeOpen || cablePassOpen || selectedCount < 2 || activeDialog !== null || inspectorVisible || !api.base || !api.tool);
  const barRef = useRef<HTMLDivElement | null>(null);

  // Publica su alto real (`--kura-bool-bar-h`) para que otros paneles flotantes del visor (p. ej. "Armado" en
  // móvil) se coloquen encima y no tapen Unir / Restar / Intersectar aunque los rótulos ocupen varias filas.
  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!visible || !el) return;
    const publish = () => root.style.setProperty('--kura-bool-bar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--kura-bool-bar-h');
    const observer = new ResizeObserver(publish);
    observer.observe(el, { box: 'border-box' });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--kura-bool-bar-h');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div ref={barRef} className="kura-bool-bar" role="toolbar" aria-label={t(language, 'boolPreview.title')}>
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
