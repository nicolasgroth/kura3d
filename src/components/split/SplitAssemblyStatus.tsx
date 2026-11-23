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
import { tCount } from '../../utils/plural';
import '../../styles/splitAssemblyStatus.css';

import type { GlueCount } from '../../store/splitGlueSummary';

interface Props {
  language: LanguageCode;
  notes: SplitGroupNotes | null;
  validation: SplitValidationReport | null;
  /** Uniones para pegar del grupo (todas las causas) y total de uniones: la cifra única del aviso, la cabecera y la lista. */
  glue?: GlueCount;
}

/** Frase de los arreglos del motor: solo nombra lo que ocurrió (nada de «0 uniones») y respeta el singular. */
export function fixedSummary(language: LanguageCode, glued: number, changed: number, glue?: GlueCount): string {
  const parts: string[] = [];
  // Con el total de uniones para pegar a mano (la misma cifra del aviso y de la lista), se nombra completo:
  // «19 de 26 para pegar (2 por impedir el montaje)» y no solo las 2 que arregló el motor.
  if (glued > 0 && glue && glue.count > glued) parts.push(t(language, 'splitUx.fixed.glued.ofTotal', { glue: glue.count, total: glue.total, count: glued }));
  else if (glued > 0) parts.push(tCount(language, { one: 'splitUx.fixed.glued.one', other: 'splitUx.fixed.glued.other' }, glued));
  if (changed > 0) parts.push(tCount(language, { one: 'splitUx.fixed.changed.one', other: 'splitUx.fixed.changed.other' }, changed));
  return t(language, 'splitUx.fixed.intro', { actions: parts.join(t(language, 'splitUx.fixed.and')) });
}

export const SplitAssemblyStatus: React.FC<Props> = ({ language, notes, validation, glue }) => {
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
  if (!base && fixed === 0) return null;
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
      {fixed > 0 && (
        <p className="kura-split-assembly-alert" data-kind="info">
          <Info size={14} aria-hidden="true" />
          <span>
            {fixedSummary(language, notes?.gluedByFix.length ?? 0, notes?.changedByFix.length ?? 0, glue)}
          </span>
        </p>
      )}
    </div>
  );
};
