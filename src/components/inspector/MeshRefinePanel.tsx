/**
 * @file src/components/inspector/MeshRefinePanel.tsx
 * @description Panel Simplificar / Refinar malla del inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { Box, Wand2 } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { type InspectorSectionProps } from './inspectorTypes';
import { SIMPLIFY_REQUEST_FRESH_MS } from './simplifyPanelRequest';

/** Simplificar / refinar malla dentro de Herramientas Maker. */
export const MeshRefinePanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const { simplifyTolMm, setSimplifyTolMm, refineEdgeMm, setRefineEdgeMm, refineSmooth, setRefineSmooth } = ui;
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const simplifySelectedMesh = useKuraStore((s) => s.simplifySelectedMesh);
  const refineSelectedMesh = useKuraStore((s) => s.refineSelectedMesh);
  const runConvexHull = useKuraStore((s) => s.runConvexHull);
  const isBusy = Boolean(busyOperation);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const request = useKuraStore((s) => s.simplifyRequest);

  // Abierto desde el aviso de malla pesada: el panel entra a la vista y la tolerancia queda enfocada.
  useEffect(() => {
    if (!request || request.id !== primary.id || Date.now() - request.at > SIMPLIFY_REQUEST_FRESH_MS) return;
    const root = rootRef.current;
    if (!root) return;
    root.scrollIntoView({ block: 'nearest' });
    root.querySelector<HTMLInputElement>('input')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  return (
    <div className="kura-form-field" ref={rootRef}>
      <label>{t(language, 'inspector.pro.meshTitle')}</label>
      <div className="kura-field-row">
        <span className="kura-field-label">{t(language, 'inspector.pro.simplifyTol')}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <PrecisionNumberInput
            style={{ width: 92 }}
            min={0.01}
            max={5}
            step={0.05}
            precision={2}
            defaultValue={0.15}
            value={simplifyTolMm}
            onChange={setSimplifyTolMm}
            ariaLabel={t(language, 'inspector.pro.simplifyTol')}
          />
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={isBusy || primary.locked}
            onClick={() => void simplifySelectedMesh(primary.id, simplifyTolMm)}
          >
            {t(language, 'inspector.pro.simplifyBtn')}
          </button>
        </div>
      </div>

      <div className="kura-field-row">
        <span className="kura-field-label">{t(language, 'inspector.pro.refineEdge')}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <PrecisionNumberInput
            style={{ width: 92 }}
            min={0.2}
            max={10}
            step={0.2}
            precision={2}
            defaultValue={1.5}
            value={refineEdgeMm}
            onChange={setRefineEdgeMm}
            ariaLabel={t(language, 'inspector.pro.refineEdge')}
          />
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={isBusy || primary.locked}
            onClick={() => void refineSelectedMesh(primary.id, refineEdgeMm, refineSmooth)}
          >
            <Wand2 size={12} />
            <span>{t(language, 'inspector.pro.refineBtn')}</span>
          </button>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
        <input
          type="checkbox"
          checked={refineSmooth}
          onChange={(e) => setRefineSmooth(e.target.checked)}
        />
        <span>{t(language, 'inspector.pro.refineSmooth')}</span>
      </label>

      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={isBusy}
        onClick={() => void runConvexHull([primary.id])}
      >
        <Box size={13} />
        <span>{t(language, 'inspector.pro.hull')}</span>
      </button>
    </div>
  );
};
