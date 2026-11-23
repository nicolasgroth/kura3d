/**
 * @file src/components/inspector/PrintCheckPanel.tsx
 * @description Validador de imprimibilidad del inspector: pared mínima, botón de validar, informe
 * con puntaje, peso (y cómo se calcula), voladizos y avisos traducidos con icono y, cuando aplica,
 * una acción directa (apoyar en la cama, ver voladizos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Eye, EyeOff, FlipVertical, Grid3x3,
  Layers, Maximize2, PackageOpen, Ruler, ShieldAlert, ShieldCheck, type LucideIcon,
} from 'lucide-react';
import '../../styles/printCheckPanel.css';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../../engine/operationLimits';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { currentPrintReport } from '../../store/printReportSelectors';
import type { PrintWarningCode, SceneObject } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { MeshRepairSummary } from './MeshRepairSummary';
import { formatLocaleNumber, formatQuantity } from '../../i18n/numberLocale';

/** Icono de cada aviso (el estado no depende solo del color). */
const ISSUE_ICONS: Record<PrintWarningCode, LucideIcon> = {
  NOT_MANIFOLD: ShieldAlert,
  WALL_NOT_MEASURED: Ruler,
  EXCEEDS_BED: Maximize2,
  BELOW_BED: ArrowDownToLine,
  FLOATING: ArrowUpFromLine,
  OVERHANG: Layers,
  LOW_DENSITY: Grid3x3,
  HIGH_DENSITY: Boxes,
  THIN_WALL: Ruler,
  INVERTED_NORMALS: FlipVertical,
  SEALED_CAVITY: PackageOpen,
};

const WALL = OPERATION_RANGES.printability.minWallMm;

export const PrintCheckPanel: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const activePrintReport = useKuraStore((s) => s.activePrintReport);
  const showOverhangs = useKuraStore((s) => s.showOverhangs);
  const setShowOverhangs = useKuraStore((s) => s.setShowOverhangs);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const [minWall, setMinWall] = useState<number>(OPERATION_DEFAULTS.printability.minWallMm);
  const isBusy = Boolean(busyOperation);
  const printReportSource = useKuraStore((s) => s.printReportSource);
  const objects = useKuraStore((s) => s.objects);
  // Tras editar, transformar o deshacer, el informe anterior ya no describe la pieza: se oculta.
  const report = currentPrintReport({ activePrintReport, printReportSource, objects }, primary.id);

  const validate = (wall = minWall) => void runPrintabilityCheck(primary.id, undefined, undefined, wall);
  const dropAndRevalidate = () => {
    dropObjectToBed(primary.id);
    // El objeto cambió de posición: se vuelve a validar sobre el estado nuevo.
    setTimeout(() => validate(), 0);
  };
  const rangeTip = t(language, 'precision.rangeTip', { min: String(WALL.min), max: `${WALL.max} mm` });
  const assumptions = report?.weightAssumptions;

  return (
    <>
      <div className="kura-field-row kura-param-row kura-printcheck-wall">
        <label className="kura-field-label" htmlFor="kura-print-minwall">
          {t(language, 'inspector.pro.minWall')}
          <span className="kura-param-range" title={rangeTip}>{`${WALL.min}–${WALL.max} mm`}</span>
        </label>
        <PrecisionNumberInput
          id="kura-print-minwall"
          style={{ width: 104 }}
          value={minWall}
          min={WALL.min}
          max={WALL.max}
          step={0.1}
          precision={2}
          suffix="mm"
          defaultValue={OPERATION_DEFAULTS.printability.minWallMm}
          commitOnBlur
          strictRange
          ariaLabel={t(language, 'inspector.pro.minWall')}
          title={rangeTip}
          onChange={setMinWall}
          onCommit={(v) => { setMinWall(v); if (report) validate(v); }}
        />
      </div>

      <button type="button" className="kura-btn kura-btn-sm" disabled={isBusy} onClick={() => validate()}>
        <ShieldCheck size={13} style={{ color: 'var(--accent-green)' }} />
        <span>{t(language, 'inspector.pro.validate')}</span>
      </button>

      {report && (
        <div className="kura-report-card" id="kura-print-report" tabIndex={-1}>
          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'inspector.pro.score')}</span>
            <span className={`kura-score-pill ${report.score >= 80 ? 'is-good' : report.score >= 55 ? 'is-warn' : 'is-bad'}`}>
              {report.score}/100
            </span>
          </div>

          <div className="kura-stats-grid">
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.pro.overhangs')}</div>
              <div className="kura-stat-val">{formatQuantity(language, report.overhangPercent, '%', { maxFrac: 1, minFrac: 1 })}</div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'viewport.bedLabel')}</div>
              <div className={`kura-stat-val ${report.fitsInBed && !report.isFloating ? 'kura-badge-ok' : 'kura-badge-warn'}`}>
                {!report.fitsInBed
                  ? t(language, 'inspector.pro.outOfBed')
                  : report.isFloating
                    ? t(language, 'inspector.pro.floating', { mm: formatLocaleNumber(language, report.minYWorldMm, { maxFrac: 1, minFrac: 1 }) })
                    : t(language, 'inspector.pro.grounded')}
              </div>
            </div>
          </div>

          <div className="kura-printcheck-estimate" data-testid="print-material-estimate">
            <span>
              {t(language, 'inspector.pro.weight')} ≈ {formatQuantity(language, report.estimatedWeightGrams, 'g', { maxFrac: 1, minFrac: 1 })} · {t(language, 'inspector.pro.filament')} ≈{' '}
              {formatQuantity(language, report.estimatedFilamentMeters, 'm', { maxFrac: 1, minFrac: 1 })}
            </span>
            <span className="kura-printcheck-estimate-note">{t(language, 'inspector.pro.estimateNote')}</span>
          </div>

          {assumptions && (
            <details className="kura-printcheck-how">
              <summary>{t(language, 'inspector.pro.howCalculated')}</summary>
              <p>
                {t(language, 'inspector.pro.assumptions', {
                  material: t(language, `material.${assumptions.materialId}` as TranslationKey),
                  density: formatLocaleNumber(language, assumptions.densityGCm3, { maxFrac: 2, minFrac: 2 }),
                  infill: String(assumptions.infillPercent),
                  shell: String(Math.round(assumptions.shellFraction * 100)),
                  filament: formatLocaleNumber(language, assumptions.filamentDiameterMm, { maxFrac: 2 }),
                })}
              </p>
            </details>
          )}

          {report.overhangFaceCount > 0 && (
            <button
              type="button"
              className={`kura-btn kura-btn-sm ${showOverhangs ? 'is-active' : ''}`}
              aria-pressed={showOverhangs}
              onClick={() => setShowOverhangs(!showOverhangs)}
            >
              {showOverhangs ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showOverhangs ? t(language, 'inspector.pro.hideOverhangs') : t(language, 'inspector.pro.showOverhangs')}</span>
            </button>
          )}

          {!report.isManifold && <MeshRepairSummary primary={primary} />}

          {report.issues.length > 0 ? (
            <ul className="kura-warning-list kura-printcheck-issues">
              {report.issues.map((w) => {
                const Icon = ISSUE_ICONS[w.code] ?? AlertTriangle;
                return (
                  <li key={w.code} className="kura-printcheck-issue">
                    <Icon size={14} aria-hidden="true" />
                    <span className="kura-printcheck-issue-text">{t(language, `printWarning.${w.code}` as TranslationKey, w.params)}</span>
                    {w.code === 'BELOW_BED' && (
                      <button type="button" className="kura-btn kura-btn-sm" disabled={isBusy || primary.locked} onClick={dropAndRevalidate}>
                        {t(language, 'inspector.pro.actionDropToBed')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="kura-printcheck-ok">{t(language, 'inspector.pro.noWarnings')}</span>
          )}
        </div>
      )}
    </>
  );
};
