/**
 * @file src/components/inspector/MakerToolsSection.tsx
 * @description Sección Herramientas Maker del inspector: moldes, proyección, roscas y validador estructural.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Bolt, Eye, EyeOff, PaintBucket, ShieldCheck, Type } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type InspectorSectionProps } from './inspectorTypes';
import { StructureDetectionPanel } from './StructureDetectionPanel';
import { MeshRefinePanel } from './MeshRefinePanel';

/** Sección 4: herramientas Maker y validador estructural. */
export const MakerToolsSection: React.FC<InspectorSectionProps> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const activePrintReport = useKuraStore((s) => s.activePrintReport);
  const showOverhangs = useKuraStore((s) => s.showOverhangs);
  const setShowOverhangs = useKuraStore((s) => s.setShowOverhangs);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const isBusy = Boolean(busyOperation);
  const currentReport =
    activePrintReport && activePrintReport.objectId === primary.id
      ? activePrintReport
      : null;

  return (
    <section className="kura-card">
      <h3 className="kura-section-label">{t(language, 'inspector.pro.title')}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={isBusy}
          onClick={() => setActiveDialog('mold')}
        >
          <PaintBucket size={13} />
          <span>{t(language, 'inspector.pro.mold')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy || primary.locked}
          onClick={() => setActiveDialog('project')}
        >
          <Type size={13} />
          <span>{t(language, 'inspector.pro.project')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy}
          onClick={() => setActiveDialog('thread')}
        >
          <Bolt size={13} />
          <span>{t(language, 'inspector.pro.thread')}</span>
        </button>

        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={isBusy}
          onClick={() => runPrintabilityCheck(primary.id)}
        >
          <ShieldCheck size={13} style={{ color: 'var(--accent-green)' }} />
          <span>{t(language, 'inspector.pro.validate')}</span>
        </button>
      </div>

      {/* Tarjeta de resultados del Validador Estructural */}
      {currentReport && (
        <div className="kura-report-card">
          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'inspector.pro.score')}</span>
            <span
              className={`kura-score-pill ${
                currentReport.score >= 80
                  ? 'is-good'
                  : currentReport.score >= 55
                    ? 'is-warn'
                    : 'is-bad'
              }`}
            >
              {currentReport.score}/100
            </span>
          </div>

          <div className="kura-stats-grid">
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.pro.weight')}</div>
              <div className="kura-stat-val">
                {currentReport.estimatedWeightGrams.toFixed(1)} g
              </div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.pro.filament')}</div>
              <div className="kura-stat-val">
                {currentReport.estimatedFilamentMeters.toFixed(2)} m
              </div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.pro.overhangs')}</div>
              <div className="kura-stat-val">
                {currentReport.overhangPercent.toFixed(1)}%
              </div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'viewport.bedLabel')}</div>
              <div
                className={`kura-stat-val ${
                  currentReport.fitsInBed && !currentReport.isFloating
                    ? 'kura-badge-ok'
                    : 'kura-badge-warn'
                }`}
              >
                {!currentReport.fitsInBed
                  ? t(language, 'inspector.pro.outOfBed')
                  : currentReport.isFloating
                    ? t(language, 'inspector.pro.floating', {
                        mm: currentReport.minYWorldMm.toFixed(1),
                      })
                    : t(language, 'inspector.pro.grounded')}
              </div>
            </div>
          </div>

          {currentReport.overhangFaceCount > 0 && (
            <button
              type="button"
              className={`kura-btn kura-btn-sm ${showOverhangs ? 'is-active' : ''}`}
              onClick={() => setShowOverhangs(!showOverhangs)}
            >
              {showOverhangs ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>
                {showOverhangs
                  ? t(language, 'inspector.pro.hideOverhangs')
                  : t(language, 'inspector.pro.showOverhangs')}
              </span>
            </button>
          )}

          {currentReport.issues.length > 0 ? (
            <ul className="kura-warning-list">
              {currentReport.issues.map((w) => (
                <li key={w.code}>{t(language, `printWarning.${w.code}` as TranslationKey, w.params)}</li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>
              {t(language, 'inspector.pro.noWarnings')}
            </span>
          )}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Detección de Estructuras (100 % Local) */}
      <StructureDetectionPanel primary={primary} ui={ui} />

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

      {/* Simplificar / Refinar Malla */}
      <MeshRefinePanel primary={primary} ui={ui} />
    </section>
  );
};
