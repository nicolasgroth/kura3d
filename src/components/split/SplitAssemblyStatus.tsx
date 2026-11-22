/**
 * @file src/components/split/SplitAssemblyStatus.tsx
 * @description Estado del armado de un grupo dividido, arriba de la sección "Uniones": si el resultado no
 * cierra (piezas que no entran, choques entre conectores, interferencias o huecos), un aviso visible con lo
 * que hay que hacer; y, si Kura3D pegó uniones o cambió tipos de conector para poder montarlo, cuántas.
 * También lista las uniones débiles. Toma el último "Validar armado" si existe y, si no, el informe completo
 * que devolvió la división (se guarda en el proyecto, así que se ve igual al reabrir).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { t } from '../../i18n';
import type { SplitGroupNotes, SplitValidationReport } from '../../core/scene/splitJointStatus';
import type { LanguageCode } from '../../types/kura';
import '../../styles/splitAssemblyStatus.css';

interface Props {
  language: LanguageCode;
  notes: SplitGroupNotes | null;
  validation: SplitValidationReport | null;
}

export const SplitAssemblyStatus: React.FC<Props> = ({ language, notes, validation }) => {
  const base = validation
    ? {
        ok: validation.ok,
        blocked: validation.blocked,
        clashes: validation.clashes,
        interference: validation.closure.interference.length,
        gaps: validation.closure.gaps.length,
      }
    : notes?.report ?? null;
  const fixed = (notes?.gluedByFix.length ?? 0) + (notes?.changedByFix.length ?? 0);
  // Uniones débiles medidas: de la última validación o del informe que dejó la división.
  const weak = validation ? validation.weak.map((w) => w.joint) : notes?.report?.weak?.map((w) => w.joint) ?? notes?.weakJoints ?? [];
  if (!base && fixed === 0 && weak.length === 0) return null;
  const failed = base !== null && !base.ok;
  const details: string[] = [];
  if (base) {
    if (base.blocked.length > 0) details.push(t(language, 'splitJoints.result.blocked', { codes: base.blocked.join(', ') }));
    if (base.clashes > 0) details.push(t(language, 'splitJoints.result.clashes', { count: base.clashes }));
    if (base.interference > 0) details.push(t(language, 'splitJoints.result.interference', { count: base.interference }));
    if (base.gaps > 0) details.push(t(language, 'splitJoints.result.gaps', { count: base.gaps }));
  }
  return (
    <div className="kura-split-assembly-status" data-testid="split-assembly-status">
      {failed && (
        <div role="alert" className="kura-split-assembly-alert" data-kind="fail">
          <AlertTriangle size={14} aria-hidden="true" />
          <div>
            <strong>{t(language, 'splitJoints.banner.fail')}</strong>
            {details.length > 0 && (
              <ul>
                {details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <p>{t(language, 'splitJoints.banner.action')}</p>
          </div>
        </div>
      )}
      {weak.length > 0 && (
        <p className="kura-split-assembly-alert" data-kind="info" data-testid="split-assembly-weak">
          <Info size={14} aria-hidden="true" />
          <span>{t(language, 'splitJoints.result.weak', { labels: weak.join(', ') })}</span>
        </p>
      )}
      {fixed > 0 && (
        <p className="kura-split-assembly-alert" data-kind="info">
          <Info size={14} aria-hidden="true" />
          <span>
            {t(language, 'splitJoints.banner.fixed', {
              glued: notes?.gluedByFix.length ?? 0,
              changed: notes?.changedByFix.length ?? 0,
            })}
          </span>
        </p>
      )}
    </div>
  );
};
