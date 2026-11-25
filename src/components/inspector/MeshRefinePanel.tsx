/**
 * @file src/components/inspector/MeshRefinePanel.tsx
 * @description Panel Simplificar / Refinar malla del inspector (Simplificar con modos e informe en `SimplifySection`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef } from 'react';
import { Box, Wand2 } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { type InspectorSectionProps } from './inspectorTypes';
import { SIMPLIFY_REQUEST_FRESH_MS } from './simplifyPanelRequest';
import { SimplifySection } from './SimplifySection';

/** Simplificar / refinar malla dentro de Herramientas Maker. */
export const MeshRefinePanel: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const { simplifyTolMm, setSimplifyTolMm, refineEdgeMm, setRefineEdgeMm, refineSmooth, setRefineSmooth } = ui;
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const refineSelectedMesh = useKuraStore((s) => s.refineSelectedMesh);
  const runConvexHull = useKuraStore((s) => s.runConvexHull);
  const isBusy = Boolean(busyOperation);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const request = useKuraStore((s) => s.simplifyRequest);

  // Abierto desde el aviso de malla pesada: el panel entra a la vista y la tolerancia queda enfocada.
  useEffect(() => {
    if (!request || request.id !== primary.id || Date.now() - request.at > SIMPLIFY_REQUEST_FRESH_MS) return;
    const root = rootRef.current;
    if (!root) return;
    // El foco al primer campo del modo lo da `SimplifySection` (conoce el modo pedido).
    root.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  return (
    <div className="kura-form-field" ref={rootRef}>
      <label>{t(language, 'inspector.pro.meshTitle')}</label>
      <div role="group" aria-labelledby={`${uid}-simplify`} className="kura-mesh-group">
        <h4 id={`${uid}-simplify`} className="kura-mesh-group-title">{t(language, 'simplify.section.simplify')}</h4>
        <SimplifySection primary={primary} toleranceMm={simplifyTolMm} setToleranceMm={setSimplifyTolMm} invalid={invalid} />
      </div>

      <div role="group" aria-labelledby={`${uid}-refine`} className="kura-mesh-group">
        <h4 id={`${uid}-refine`} className="kura-mesh-group-title">{t(language, 'simplify.section.refine')}</h4>
      <div className="kura-field-row">
        <span className="kura-field-label">{t(language, 'inspector.pro.refineEdge')}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f2')}
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
            disabled={isBusy || primary.locked || invalid.blocked}
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
      </div>

      <div role="group" aria-labelledby={`${uid}-hull`} className="kura-mesh-group">
        <h4 id={`${uid}-hull`} className="kura-mesh-group-title">{t(language, 'simplify.section.hull')}</h4>
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
    </div>
  );
};
