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
 * @license AGPL-3.0-or-later
 */

import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import type { SimplifyReport, SimplifyRequest } from '../../engine/simplify';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { simplifyMm, simplifyPct } from '../../i18n/simplifyNumbers';
import { simplifyHasShapeNotice, simplifyWarningSentence } from '../../i18n/simplifyWarnings';
import { undoToastAction } from '../../store/toastActionState';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { restoreFocusAfter } from '../toastFocus';
import { SimplifyBlockedChoice } from './SimplifyBlockedChoice';

type UndoStep = ReturnType<typeof undoToastAction>;

interface Props {
  report: SimplifyReport;
  language: LanguageCode;
  onUndo?: () => void;
  /** Informe de la vista previa (nada aplicado todavía). */
  preview?: boolean;
  /** Vista previa: qué muestra el fantasma del visor (null: no se dibuja). */
  ghost?: 'requested' | 'safe' | null;
  /**
   * Lo aplicado desde la elección (versión segura o «de todos modos»): lo recibe quien guarda el informe (el panel), para
   * que el informe y su «Deshacer» sobrevivan a que este componente se desmonte mientras se deshace la segura.
   */
  onApplied?: (report: SimplifyReport, undo: UndoStep | null) => void;
  /** Antes de deshacer la versión segura para reemplazarla: el panel no debe tomarlo por un «deshacer» del usuario. */
  onReplacing?: () => void;
  /** Avisa al panel cuando empieza y cuando termina lo que se aplica desde aquí (el panel mantiene el foco y el avance). */
  onWorking?: (working: boolean) => void;
}

/** Clave del resumen de una o dos líneas que abre el informe. */
const summaryKey = (preview: boolean, safe: boolean) =>
  preview ? (safe ? 'simplify.preview.summarySafe' : 'simplify.preview.summary') : (safe ? 'simplify.report.summarySafe' : 'simplify.report.summary');

export const SimplifyReportView: React.FC<Props> = ({ report: given, language, onUndo, preview = false, ghost = null, onApplied, onReplacing, onWorking }) => {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Un informe nuevo se desplaza hasta quedar a la vista dentro del panel (sin animar con «reducir movimiento»).
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rootRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [given]);
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
    const replacing = report.appliedVariant === 'safe';
    if (replacing && !undo) return;
    // Desde aquí el panel mantiene el foco (en «Cancelar») y muestra el avance hasta que termine.
    onWorking?.(true);
    if (replacing && undo) {
      onReplacing?.();
      undo();
    }
    let next: SimplifyReport | null = null;
    void useKuraStore.getState().simplifySelectedMesh(id, request, { onReport: (r) => { next = r; }, inPanel: true }).then((ok) => {
      if (next) {
        const st = useKuraStore.getState();
        const step = ok ? undoToastAction(t(st.language, 'toast.undo'), () => useKuraStore.getState().past, () => useKuraStore.getState().undo()) : null;
        if (onApplied) onApplied(next, step);
        else setChosen({ base: given, report: next, undo: step });
      }
      onWorking?.(false);
      // El botón pulsado ya no existe: el foco va al informe del resultado (o al visor), nunca a `document.body`.
      restoreFocusAfter(rootRef.current);
    });
  };
  const n = (v: number) => formatLocaleNumber(language, v, { maxFrac: 0, grouping: true });
  const pct = simplifyPct(language, report.volumeChangePct, true);
  const tense = preview ? 'conditional' : 'past';
  const warnings = report.warnings;
  const blocked = !report.applied && (report.destructive?.length ?? 0) > 0;
  const safeApplied = report.applied && report.appliedVariant === 'safe';
  // «Por tolerancia»: la pedida es la que escribió el usuario (con la segura aplicada, el informe trae la de la segura
  // y la pedida viaja en `requested`); si el motor usó otra, se muestra aparte como «usada».
  // El motor trae la pedida en `askedToleranceMm` (y usa un peldaño de su escalera ≤ la pedida).
  const askedToleranceMm = report.askedToleranceMm ?? (safeApplied && report.requested ? report.requested.toleranceMm : report.toleranceMm);
  const usedDiffers = Math.abs(report.toleranceMm - askedToleranceMm) > 1e-9;
  // Reemplazar la segura exige poder deshacerla (si no, se forzaría sobre la malla ya simplificada).
  const onApply = preview || (safeApplied && !undo) ? undefined : apply;
  return (
    // `tabIndex={-1}`: al terminar la vista previa el foco llega aquí (se lee el resultado antes de decidir aplicar).
    <div className="kura-simplify-report" ref={rootRef} role="status" aria-live="polite" aria-labelledby={titleId} tabIndex={-1} data-testid="simplify-report">
      <strong id={titleId} className="kura-field-label">{t(language, preview ? 'simplify.preview.title' : 'simplify.report.title')}</strong>
      {report.applied && (
        <p className="kura-simplify-summary" data-testid="simplify-report-summary">
          <strong>
            {t(language, summaryKey(preview, safeApplied), { before: n(report.trianglesBefore), after: n(report.trianglesAfter) })}
          </strong>
          {preview && ghost && <> {t(language, ghost === 'safe' ? 'simplify.preview.ghostSafe' : 'simplify.preview.ghostRequested')}</>}
        </p>
      )}
      {!report.applied && !blocked && <p className="kura-cut-hint">{t(language, preview ? 'simplify.preview.notApplied' : 'simplify.report.notApplied')}</p>}
      {preview && report.applied && !safeApplied && !simplifyHasShapeNotice(report) && <p className="kura-cut-hint">{t(language, 'simplify.preview.wouldApply')}</p>}
      {simplifyHasShapeNotice(report) && (
        <p className="kura-simplify-notice" role="note" data-testid="simplify-notice">
          <AlertTriangle size={14} aria-hidden="true" />
          <strong>{t(language, preview ? 'simplify.preview.wouldNotice' : 'simplify.report.notice')}</strong>
        </p>
      )}
      {(blocked || safeApplied) && (
        <SimplifyBlockedChoice report={report} language={language} busy={busy || !report.objectId} onApply={onApply} preview={preview} />
      )}
      {/* Con la segura aplicada o un resultado bloqueado, los números van en bloques con encabezado (SimplifyBlockedChoice). */}
      {!blocked && !safeApplied && (
        <ul className="kura-simplify-report-list">
          <li>{t(language, 'simplify.report.triangles', { before: n(report.trianglesBefore), after: n(report.trianglesAfter) })}</li>
          {report.applied && (
            <>
              <li>{t(language, 'simplify.report.volume', { pct })}</li>
              <li>{t(language, 'simplify.report.genus', { before: report.genusBefore, after: report.genusAfter })}</li>
              <li>{t(language, 'simplify.report.deviation', { mm: simplifyMm(language, report.maxDeviationMm) })}</li>
              {report.mode === 'tolerance' && <li>{t(language, 'simplify.report.toleranceAsked', { mm: simplifyMm(language, askedToleranceMm) })}</li>}
              {(report.mode !== 'tolerance' || usedDiffers) && <li>{t(language, 'simplify.report.tolerance', { mm: simplifyMm(language, report.toleranceMm) })}</li>}
            </>
          )}
        </ul>
      )}
      {report.applied && <p className="kura-cut-hint">{t(language, 'simplify.report.toleranceHelp')}</p>}
      {warnings.length > 0 && (
        <ul className="kura-simplify-report-warnings" data-testid="simplify-report-warnings">
          {warnings.map((code) => (
            <li key={code} data-code={code}>{simplifyWarningSentence(language, report, code, tense)}</li>
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
