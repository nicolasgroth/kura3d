/**
 * @file src/components/inspector/SimplifyPreviewExtras.tsx
 * @description Piezas de la vista previa de Simplificar que acompañan al fantasma del visor: `SimplifyPreviewProgress`
 * (barra por pasos «intento i de n» / «paso i de n» de la versión segura mientras calcula, con el texto de la fase) y
 * `SimplifyGhostControls` («Ocultar la vista previa», «Mostrar las aristas», conmutador «Ver lo pedido» / «Ver la
 * versión segura» solo si la malla pedida se guardó, y el aviso cuando el resultado es demasiado grande para dibujarse).
 * Todo el estado vive en `simplifyPreviewSlice`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { SimplifyPreviewSession } from '../../store/slices/simplifyPreviewSlice';
import { SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES } from '../../store/simplifyGhostLimits';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { parseSimplifyStep, simplifyPhaseLabel, simplifyStepLabel } from '../viewport/simplifyProgress';

interface ProgressProps {
  session: SimplifyPreviewSession;
  language: LanguageCode;
}

export const SimplifyPreviewProgress: React.FC<ProgressProps> = ({ session, language }) => {
  const step = parseSimplifyStep(session.phase);
  const label = step ? simplifyStepLabel(language, step) : simplifyPhaseLabel(language, session.phase);
  return (
    <div className="kura-simplify-progress" data-testid="simplify-preview-progress">
      <span>{t(language, 'simplify.preview.computing')}</span>
      {step && (
        <progress
          className="kura-simplify-progress-bar"
          data-testid="simplify-preview-steps"
          max={step.total}
          value={step.done}
          aria-label={t(language, 'simplify.progress.bar')}
          aria-valuetext={label ?? undefined}
        />
      )}
      {label && <span className="kura-cut-hint" data-testid="simplify-preview-phase">{label}</span>}
    </div>
  );
};

export const SimplifyGhostControls: React.FC<ProgressProps> = ({ session, language }) => {
  const uid = useId();
  const setComparing = useKuraStore((s) => s.setSimplifyComparing);
  const setEdges = useKuraStore((s) => s.setSimplifyGhostEdges);
  const setVariant = useKuraStore((s) => s.setSimplifyGhostVariant);
  const tris = formatLocaleNumber(language, session.ghostTriangles, { grouping: true, maxFrac: 0 });
  const showingRequested = session.variant === 'requested';

  if (session.ghost === 'heavy') {
    return <p className="kura-cut-hint" role="status" data-testid="simplify-ghost-heavy">{t(language, 'simplify.ghost.heavy', { tris })}</p>;
  }
  if (session.ghost === 'none') {
    return <p className="kura-cut-hint" data-testid="simplify-ghost-none">{t(language, 'simplify.ghost.none')}</p>;
  }
  const lightOnly = session.ghostTriangles > SIMPLIFY_GHOST_WIRE_MAX_TRIANGLES;
  return (
    <div className="kura-simplify-ghost" data-testid="simplify-ghost-controls">
      <label className="kura-simplify-check" title={t(language, 'simplify.ghost.compare.help')}>
        <input
          type="checkbox"
          data-testid="simplify-ghost-compare"
          checked={session.comparing}
          aria-describedby={`${uid}-compare-help`}
          onChange={(e) => setComparing(e.target.checked)}
        />
        <span>{t(language, 'simplify.ghost.compare')}</span>
      </label>
      <p id={`${uid}-compare-help`} className="kura-cut-hint">{t(language, 'simplify.ghost.compare.help')}</p>
      <label className="kura-simplify-check" title={t(language, 'simplify.ghost.edges.help')}>
        <input
          type="checkbox"
          data-testid="simplify-ghost-edges"
          checked={session.edges}
          disabled={lightOnly}
          aria-describedby={`${uid}-edges-help`}
          onChange={(e) => setEdges(e.target.checked)}
        />
        <span>{t(language, 'simplify.ghost.edges')}</span>
      </label>
      <p id={`${uid}-edges-help`} className="kura-cut-hint">
        {t(language, lightOnly ? 'simplify.ghost.edges.light' : 'simplify.ghost.edges.help', { tris })}
      </p>
      {session.hasRequested && (
        <div className="kura-simplify-variant">
          <p className="kura-cut-hint" data-testid="simplify-ghost-variant-now">
            {t(language, showingRequested ? 'simplify.ghost.variant.nowRequested' : 'simplify.ghost.variant.nowSafe')}
          </p>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            data-testid="simplify-ghost-variant"
            onClick={() => setVariant(showingRequested ? 'applied' : 'requested')}
          >
            {t(language, showingRequested ? 'simplify.ghost.variant.showSafe' : 'simplify.ghost.variant.showRequested')}
          </button>
        </div>
      )}
    </div>
  );
};
