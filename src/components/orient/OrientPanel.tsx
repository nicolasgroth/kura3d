/**
 * @file src/components/orient/OrientPanel.tsx
 * @description Contenido del panel contextual de «Orientar para imprimir»: al abrirse calcula las orientaciones de
 * la pieza (Worker, con indicador, Cancelar y región `role="status"`), muestra el resumen (la actual ya es la
 * mejor, todas equivalentes o hay una recomendada), el ángulo de voladizo ajustable (recalcula), la lista de
 * opciones con vista previa en el visor, la leyenda de zonas en voladizo, «Conservar posición en la cama» y
 * «Aplicar orientación» (un paso de deshacer), más la nota honesta sobre lo aproximado. Al salir limpia la vista
 * previa. El cálculo y su vigencia viven en el store (`orientSlice`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCw, X } from 'lucide-react';
import { t } from '../../i18n';
import { ORIENT_ANGLE_RANGE } from '../../store/slices/orientSlice';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { helpAttrs } from '../shell/controlHelp';
import { OrientOptionList } from './OrientOptionList';
import { recommendedId, summaryText } from './orientView';
import '../../styles/orient.css';

const { min: ANGLE_MIN, max: ANGLE_MAX } = ORIENT_ANGLE_RANGE;

/** Ángulo escrito por la persona (acepta coma decimal); `null` si no es válido. */
export function parseOrientAngle(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(v)) return null;
  return v >= ANGLE_MIN && v <= ANGLE_MAX ? v : null;
}

export const OrientPanel: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const orient = useKuraStore((s) => s.orient);
  const running = useKuraStore((s) => s.orientRunning);
  const stale = useKuraStore((s) => s.orientStale);
  const keepXY = useKuraStore((s) => s.orientKeepXY);
  const overhang = useKuraStore((s) => s.orientOverhang);
  const busy = useKuraStore((s) => s.busyOperation);
  const analyzeOrient = useKuraStore((s) => s.analyzeOrient);
  const cancelOrient = useKuraStore((s) => s.cancelOrient);
  const clearOrient = useKuraStore((s) => s.clearOrient);
  const setKeepXY = useKuraStore((s) => s.setOrientKeepXY);
  const setPreview = useKuraStore((s) => s.setOrientPreview);
  const applyOrient = useKuraStore((s) => s.applyOrient);
  const analysis = orient && orient.objectId === primary.id ? orient.analysis : null;

  const [angleText, setAngleText] = useState(() => String(analysis?.overhangAngleDeg ?? ORIENT_ANGLE_RANGE.default));
  const [chosenId, setChosenId] = useState<string | null>(null);
  const angleId = useId();
  const angleHintId = useId();
  const keepHintId = useId();
  const angle = parseOrientAngle(angleText);
  const lastAngle = useRef<number>(ORIENT_ANGLE_RANGE.default);

  // Al abrir (y al cambiar de pieza) calcula; al salir cierra el análisis y la vista previa.
  useEffect(() => {
    lastAngle.current = ORIENT_ANGLE_RANGE.default;
    setAngleText(String(ORIENT_ANGLE_RANGE.default));
    void analyzeOrient(primary.id, ORIENT_ANGLE_RANGE.default);
    return () => clearOrient();
  }, [primary.id, analyzeOrient, clearOrient]);

  // Un análisis nuevo parte con la recomendada elegida (si la hay) y su vista previa.
  useEffect(() => {
    const next = analysis ? recommendedId(analysis) : null;
    setChosenId(next);
    setPreview(next);
  }, [analysis, setPreview]);

  const recalc = (value: number) => {
    if (running || value === lastAngle.current) return;
    lastAngle.current = value;
    void analyzeOrient(primary.id, value);
  };
  const commitAngle = () => {
    if (angle !== null) recalc(angle);
  };

  const chosen = analysis?.candidates.find((c) => c.id === chosenId) ?? null;
  const canApply = Boolean(analysis && chosen && chosen.id !== analysis.currentId && !running && !busy);

  const choose = (id: string) => {
    setChosenId(id);
    setPreview(id);
  };
  const apply = (id: string) => {
    if (!analysis || id === analysis.currentId || running || busy) return;
    void applyOrient(id);
  };
  // Al salir de la lista (cursor o foco) vuelve la vista previa de la opción elegida.
  const previewFromList = (id: string | null) => setPreview(id ?? chosenId);

  const empty = !analysis && !running;
  const currentPreview = Boolean(overhang && overhang.triangles.length > 0);

  return (
    <div className="kura-orient" data-testid="orient-panel">
      <div className="kura-orient-field">
        <label className="kura-field-label" htmlFor={angleId}>{t(language, 'orient.ui.angle')}</label>
        <input
          id={angleId}
          className="kura-input kura-orient-number"
          type="text"
          inputMode="decimal"
          value={angleText}
          aria-invalid={angle === null}
          aria-describedby={angleHintId}
          onChange={(e) => setAngleText(e.target.value)}
          onBlur={commitAngle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitAngle();
            }
          }}
          data-testid="orient-angle"
          {...helpAttrs('orient.angle', language)}
        />
      </div>
      <small id={angleHintId} className="kura-orient-hint">
        {angle === null
          ? t(language, 'orient.ui.angleInvalid', { min: ANGLE_MIN, max: ANGLE_MAX })
          : t(language, 'orient.ui.angleHint', { min: ANGLE_MIN, max: ANGLE_MAX })}
      </small>

      <div role="status" aria-live="polite" className="kura-orient-live" data-testid="orient-status">
        {running && (
          <div className="kura-orient-running" data-testid="orient-running">
            <span className="kura-orient-phase">
              <Loader2 size={13} aria-hidden="true" className="kura-orient-spin" />
              <span>{t(language, 'orient.ui.calculating')}</span>
            </span>
            <progress className="kura-orient-progress" aria-label={t(language, 'orient.ui.progress')} />
          </div>
        )}
        {!running && analysis && (
          <p className="kura-orient-summary" data-testid="orient-summary" data-kind={analysis.allEquivalent ? 'equivalent' : analysis.currentIsBest ? 'best' : 'better'}>
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>{summaryText(language, analysis)}</span>
          </p>
        )}
        {!running && !analysis && stale && (
          <p className="kura-orient-stale" data-testid="orient-stale">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{t(language, 'orient.ui.stale')}</span>
          </p>
        )}
        {empty && !stale && <p className="kura-orient-stale" data-testid="orient-cancelled"><span>{t(language, 'orient.ui.cancelled')}</span></p>}
      </div>

      {running && (
        <div className="kura-orient-actions">
          <button type="button" className="kura-btn kura-btn-sm" onClick={cancelOrient} data-testid="orient-cancel" {...helpAttrs('orient.cancel', language)}>
            <X size={13} aria-hidden="true" />
            <span>{t(language, 'orient.ui.cancel')}</span>
          </button>
        </div>
      )}
      {empty && (
        <div className="kura-orient-actions">
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            onClick={() => void analyzeOrient(primary.id, angle ?? ORIENT_ANGLE_RANGE.default)}
            data-testid="orient-recalc"
          >
            <RotateCw size={13} aria-hidden="true" />
            <span>{t(language, 'orient.ui.recalc')}</span>
          </button>
        </div>
      )}

      {analysis && (
        <>
          <OrientOptionList
            language={language}
            analysis={analysis}
            chosenId={chosenId}
            onChoose={choose}
            onApply={(id) => {
              choose(id);
              apply(id);
            }}
            onPreview={previewFromList}
          />
          <small className="kura-orient-hint">{t(language, 'orient.ui.listHint')}</small>

          {currentPreview && (
            <p className="kura-orient-legend" data-testid="orient-legend">
              <span className="kura-orient-swatch" aria-hidden="true" />
              <span>
                <strong>{t(language, 'orient.ui.legend')}</strong>
                <br />
                <span className="kura-orient-hint">{t(language, 'orient.ui.legendHint')}</span>
              </span>
            </p>
          )}

          <label className="kura-orient-check">
            <input
              type="checkbox"
              checked={keepXY}
              aria-describedby={keepHintId}
              onChange={(e) => setKeepXY(e.target.checked)}
              data-testid="orient-keep"
              {...helpAttrs('orient.keepXY', language)}
            />
            <span>{t(language, 'orient.ui.keepPosition')}</span>
          </label>
          <small id={keepHintId} className="kura-orient-hint">{t(language, 'orient.ui.keepPositionHint')}</small>

          <div className="kura-orient-actions">
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              disabled={!canApply}
              onClick={() => chosenId && apply(chosenId)}
              data-testid="orient-apply"
              {...helpAttrs('orient.apply', language)}
              title={canApply ? t(language, 'orient.ui.apply') : t(language, 'orient.ui.applyNeed')}
            >
              <RotateCw size={13} aria-hidden="true" />
              <span>{t(language, 'orient.ui.apply')}</span>
            </button>
          </div>
          {!canApply && !running && <small className="kura-orient-hint">{t(language, 'orient.ui.applyNeed')}</small>}
        </>
      )}

      <p className="kura-orient-note" data-testid="orient-note">
        <Info size={13} aria-hidden="true" />
        <span>{t(language, 'orient.ui.note')}</span>
      </p>
    </div>
  );
};
