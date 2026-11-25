/**
 * @file src/components/inspector/SimplifyReportView.tsx
 * @description Informe antes → después del último Simplificar de la pieza: triángulos, volumen, agujeros pasantes
 * (género), desviación medida, tolerancia usada y los avisos tipados traducidos. Si no se aplicó, lo dice; si fue
 * porque el resultado era destructivo, ofrece la versión segura o aplicarlo igual (`SimplifyBlockedChoice`) y muestra
 * el informe de lo que se aplicó después. Con `onUndo` trae «Deshacer» (mientras ese paso siga siendo el último).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyWarningSentence } from '../../i18n/simplifyWarnings';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { SimplifyBlockedChoice } from './SimplifyBlockedChoice';

type UndoStep = ReturnType<typeof undoToastAction>;

export const SimplifyReportView: React.FC<{ report: SimplifyReport; language: LanguageCode; onUndo?: () => void }> = ({ report: given, language, onUndo }) => {
  const busy = Boolean(useKuraStore((s) => s.busyOperation));
  useKuraStore((s) => s.past); // re-render: «Deshacer» del paso aplicado desde aquí se oculta al dejar de ser el último
  // Lo aplicado desde la elección (versión segura o de todos modos) reemplaza al informe recibido mientras éste no cambie.
  const [chosen, setChosen] = useState<{ base: SimplifyReport; report: SimplifyReport; undo: UndoStep | null } | null>(null);
  const own = chosen && chosen.base === given ? chosen : null;
  const report = own ? own.report : given;
  const undo = own ? (own.undo?.applicable?.() ? own.undo.run : undefined) : onUndo;
  const apply = (request: SimplifyRequest) => {
    const id = given.objectId;
    if (!id) return;
    let next: SimplifyReport | null = null;
    void useKuraStore.getState().simplifySelectedMesh(id, request, { onReport: (r) => { next = r; } }).then((ok) => {
      if (!next) return;
      const st = useKuraStore.getState();
      const step = ok ? undoToastAction(t(st.language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo()) : null;
      setChosen({ base: given, report: next, undo: step });
    });
  };
  const n = (v: number, maxFrac: number) => formatLocaleNumber(language, v, { maxFrac, grouping: maxFrac === 0 });
  const pct = new Intl.NumberFormat(language, { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(report.volumeChangePct);
  const warnings = report.warnings;
  const blocked = !report.applied && (report.destructive?.length ?? 0) > 0;
  return (
    <div className="kura-simplify-report" role="status" aria-live="polite" data-testid="simplify-report">
      <strong className="kura-field-label">{t(language, 'simplify.report.title')}</strong>
      {!report.applied && !blocked && <p className="kura-cut-hint">{t(language, 'simplify.report.notApplied')}</p>}
      {blocked && <SimplifyBlockedChoice report={report} language={language} busy={busy || !report.objectId} onApply={apply} />}
      <ul className="kura-simplify-report-list">
        <li>{t(language, 'simplify.report.triangles', { before: n(report.trianglesBefore, 0), after: n(report.trianglesAfter, 0) })}</li>
        {report.applied && (
          <>
            <li>{t(language, 'simplify.report.volume', { pct })}</li>
            <li>{t(language, 'simplify.report.genus', { before: report.genusBefore, after: report.genusAfter })}</li>
            <li>{t(language, 'simplify.report.deviation', { mm: n(report.maxDeviationMm, 3) })}</li>
            <li>{t(language, 'simplify.report.tolerance', { mm: n(report.toleranceMm, 4) })}</li>
          </>
        )}
      </ul>
      {report.applied && <p className="kura-cut-hint">{t(language, 'simplify.report.toleranceHelp')}</p>}
      {warnings.length > 0 && (
        <ul className="kura-simplify-report-warnings" data-testid="simplify-report-warnings">
          {warnings.map((code) => (
            <li key={code} data-code={code}>{simplifyWarningSentence(language, report, code)}</li>
          ))}
        </ul>
      )}
      {undo && (
        <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-report-undo" title={t(language, 'toast.undo')} onClick={undo}>
          {t(language, 'toast.undo')}
        </button>
      )}
    </div>
  );
};
