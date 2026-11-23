/**
 * @file src/components/inspector/MeshRepairSummary.tsx
 * @description Diagnóstico de malla en el panel de análisis cuando la pieza no es un sólido cerrado:
 * lo pide al motor (Worker, solo lectura), enumera los defectos (agujeros con su tamaño, aristas con
 * más de dos caras, caras duplicadas o degeneradas, normales, astillas), resalta los bordes abiertos
 * en el visor y ofrece "Reparar malla".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import { formatLocaleNumber } from '../../i18n/numberLocale';

export const MeshRepairSummary: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const state = useKuraStore((s) => s.meshDiagnosis);
  const diagnose = useKuraStore((s) => s.diagnoseObjectMesh);
  const repair = useKuraStore((s) => s.repairObjectMesh);
  const current = state && state.objectId === primary.id && state.mesh === primary.mesh ? state.diagnosis : null;

  useEffect(() => {
    if (!current) void diagnose(primary.id);
    // Se vuelve a diagnosticar solo si cambia la malla del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary.id, primary.mesh]);

  const n = (x: number) => formatNumber(language, x);
  const lines: string[] = [];
  if (current) {
    if (current.boundaryEdges > 0) {
      lines.push(t(language, 'repair.diag.open', { edges: n(current.boundaryEdges), holes: n(current.holeCount), sizeMm: formatLocaleNumber(language, current.holes[0]?.sizeMm ?? 0, { maxFrac: 2, minFrac: 2 }) }));
    }
    if (current.nonManifoldEdges > 0) lines.push(t(language, 'repair.diag.nonManifold', { count: n(current.nonManifoldEdges) }));
    if (current.duplicateFaces + current.degenerateFaces > 0) lines.push(t(language, 'repair.diag.faces', { count: n(current.duplicateFaces + current.degenerateFaces) }));
    if (current.misorientedEdges > 0 || current.invertedShells > 0) lines.push(t(language, 'repair.diag.orientation'));
    if (current.tinyShells > 0) lines.push(t(language, 'repair.diag.tiny', { count: n(current.tinyShells) }));
  }

  return (
    <div className="kura-printcheck-repair" data-testid="mesh-repair-summary">
      <span className="kura-field-label">{t(language, 'repair.diag.title')}</span>
      {current && current.clean && <span className="kura-printcheck-ok">{t(language, 'repair.diag.closed')}</span>}
      {lines.length > 0 && (
        <ul className="kura-warning-list">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={busy || primary.locked}
        title={t(language, 'repair.actionTip')}
        onClick={() => void repair(primary.id)}
      >
        <Wrench size={13} aria-hidden="true" />
        <span>{t(language, 'repair.action')}</span>
      </button>
    </div>
  );
};
