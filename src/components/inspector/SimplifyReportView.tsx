/**
 * @file src/components/inspector/SimplifyReportView.tsx
 * @description Informe antes → después del último Simplificar de la pieza: triángulos, volumen, agujeros pasantes
 * (género), desviación medida, tolerancia usada y los avisos tipados traducidos. Si no se aplicó, lo dice; si fue
 * porque el resultado era destructivo, ofrece la versión segura o aplicarlo igual (`SimplifyBlockedChoice`) y muestra
 * el informe de lo que se aplicó después. Si se aplicó la versión segura en lugar de lo pedido, lo dice y ofrece
 * «Aplicar de todos modos» (deshace la segura y aplica lo pedido: queda un solo paso). Con `onUndo` trae «Deshacer»
 * (mientras ese paso siga siendo el último). Con `preview` es el informe de la vista previa: mismo contenido, sin
 * botones que apliquen ni «Deshacer». Si lo pedido se aplicó con aviso de forma (volumen o desviación sobre el tope de
 * aviso, sin ser destructivo), lo dice en negrita antes de la lista de avisos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyHasShapeNotice, simplifyWarningSentence } from '../../i18n/simplifyWarnings';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { SimplifyBlockedChoice } from './SimplifyBlockedChoice';

type UndoStep = ReturnType<typeof undoToastAction>;

interface Props {
  report: SimplifyReport;
  language: LanguageCode;
  onUndo?: () => void;
  /** Informe de la vista previa (nada aplicado todavía). */
  preview?: boolean;
}

export const SimplifyReportView: React.FC<Props> = ({ report: given, language, onUndo, preview = false }) => {
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
    // Se aplicó la segura: «Aplicar de todos modos» la reemplaza (se deshace y se aplica lo pedido sobre la original).
    if (report.appliedVariant === 'safe') {
      if (!undo) return;
      undo();
    }
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
  const safeApplied = report.applied && report.appliedVariant === 'safe';
  // Reemplazar la segura exige poder deshacerla (si no, se forzaría sobre la malla ya simplificada).
  const onApply = preview || (safeApplied && !undo) ? undefined : apply;
  return (
    <div className="kura-simplify-report" role="status" aria-live="polite" data-testid="simplify-report">
      <strong className="kura-field-label">{t(language, preview ? 'simplify.preview.title' : 'simplify.report.title')}</strong>
      {!report.applied && !blocked && <p className="kura-cut-hint">{t(language, 'simplify.report.notApplied')}</p>}
      {preview && report.applied && !safeApplied && !simplifyHasShapeNotice(report) && <p className="kura-cut-hint">{t(language, 'simplify.preview.wouldApply')}</p>}
      {simplifyHasShapeNotice(report) && (
        <p className="kura-cut-hint" data-testid="simplify-notice">
          <strong>{t(language, preview ? 'simplify.preview.wouldNotice' : 'simplify.report.notice')}</strong>
        </p>
      )}
      {(blocked || safeApplied) && (
        <SimplifyBlockedChoice report={report} language={language} busy={busy || !report.objectId} onApply={onApply} preview={preview} />
      )}
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
      {undo && !preview && (
        <button type="button" className="kura-btn kura-btn-sm" data-testid="simplify-report-undo" title={t(language, 'toast.undo')} onClick={undo}>
          {t(language, 'toast.undo')}
        </button>
      )}
    </div>
  );
};
