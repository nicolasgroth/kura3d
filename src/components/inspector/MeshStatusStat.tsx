/**
 * @file src/components/inspector/MeshStatusStat.tsx
 * @description Estado de la malla en la tarjeta de geometría del inspector: rótulo neutro "Malla"
 * con valor "Cerrada", "Abierta: N bordes libres" o "Con defectos" (icono + texto, no solo color) y,
 * cuando hay algo que reparar, los botones persistentes "Reparar malla" y "Ver bordes" (resalta los
 * bordes libres en el visor). El diagnóstico se pide al motor en el Worker sin resaltar nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Wrench } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { formatNumber, pickPlural } from '../../utils/plural';
import '../../styles/realesUi.css';

export const MeshStatusStat: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const state = useKuraStore((s) => s.meshDiagnosis);
  const diagnose = useKuraStore((s) => s.diagnoseObjectMesh);
  const repair = useKuraStore((s) => s.repairObjectMesh);
  const setEdgesVisible = useKuraStore((s) => s.setOpenEdgesVisible);
  const closed = primary.stats.isManifold;
  const current = state && state.objectId === primary.id && state.mesh === primary.mesh ? state : null;
  const diagnosis = current?.diagnosis ?? null;

  useEffect(() => {
    if (!closed && !current) void diagnose(primary.id, { highlight: false });
    // Solo al cambiar de objeto o de malla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary.id, primary.mesh, closed]);

  const edges = diagnosis?.boundaryEdges ?? 0;
  const value = closed
    ? t(language, 'realesUi.mesh.closed')
    : !diagnosis
      ? t(language, 'realesUi.mesh.checking')
      : edges > 0
        ? t(language, pickPlural(language, edges, { one: 'realesUi.mesh.openOne', other: 'realesUi.mesh.openOther' }), { count: formatNumber(language, edges) })
        : t(language, 'realesUi.mesh.defects');
  const highlighted = Boolean(current && current.highlight !== false && edges > 0);
  const Icon = closed ? CheckCircle2 : AlertTriangle;

  return (
    <div className="kura-stat-box" style={{ gridColumn: closed ? undefined : '1 / -1' }} data-testid="mesh-status">
      <div className="kura-stat-title">{t(language, 'realesUi.mesh.label')}</div>
      <div className={`kura-stat-val ${closed ? 'kura-badge-ok' : 'kura-badge-warn'}`} role="status">
        <Icon size={12} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
        {value}
      </div>
      {!closed && (
        <div className="kura-mesh-status-actions">
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
          {edges > 0 && (
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              aria-pressed={highlighted}
              title={t(language, 'realesUi.mesh.showEdgesTip')}
              onClick={() => void setEdgesVisible(primary.id, !highlighted)}
            >
              {highlighted ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
              <span>{t(language, highlighted ? 'realesUi.mesh.hideEdges' : 'realesUi.mesh.showEdges')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
