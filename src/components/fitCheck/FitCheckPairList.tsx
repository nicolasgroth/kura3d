/**
 * @file src/components/fitCheck/FitCheckPairList.tsx
 * @description Lista de pares de «Comprobar encaje», del más grave al menos (`role="listbox"`): cada par con
 * sus nombres, estado (icono y texto, no solo color), cifra, marcas «Aproximado» / «Estimado» / copia
 * simplificada y la recomendación. Flechas, Inicio y Fin recorren y resaltan el par en el visor; Enter o
 * clic además lo encuadran.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useRef } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonX } from 'lucide-react';
import { FIT_QUALIFIER_KEYS, FIT_STATUS_KEYS, localizeFitMessage } from '../../core/scene/fitCheckText';
import type { FitCheckReport, FitPairResult, FitPairStatus } from '../../engine/fitCheck';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { helpAttrs } from '../shell/controlHelp';
import { pairFigure, pairKey, pairsBySeverity } from './fitCheckView';

const STATUS_ICON: Record<FitPairStatus, React.ReactNode> = {
  interferes: <OctagonX size={14} aria-hidden="true" />,
  tight: <AlertTriangle size={14} aria-hidden="true" />,
  cutJoint: <CheckCircle2 size={14} aria-hidden="true" />,
  ok: <CheckCircle2 size={14} aria-hidden="true" />,
  far: <CircleDashed size={14} aria-hidden="true" />,
};

export const FitCheckPairList: React.FC<{ report: FitCheckReport }> = ({ report }) => {
  const language = useKuraStore((s) => s.language);
  const highlight = useKuraStore((s) => s.fitCheckHighlight);
  const setHighlight = useKuraStore((s) => s.setFitCheckHighlight);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const listRef = useRef<HTMLUListElement | null>(null);
  const pairs = pairsBySeverity(report.pairs);
  const current = highlight ? pairs.findIndex((p) => p.aId === highlight.aId && p.bId === highlight.bId) : -1;
  // Foco itinerante: el par resaltado, o el primero.
  const tabStop = current >= 0 ? current : 0;

  const pick = (pair: FitPairResult, frame: boolean) => {
    setHighlight({ aId: pair.aId, bId: pair.bId });
    if (frame) requestCameraPreset('focus', [pair.aId, pair.bId]);
  };

  const focusAt = (index: number) => {
    const next = pairs[index];
    if (!next) return;
    pick(next, false);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, index: number) => {
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: pairs.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      focusAt(Math.max(0, Math.min(pairs.length - 1, moves[e.key])));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(pairs[index], true);
    }
  };

  const help = helpAttrs('fitCheck.pair', language);
  return (
    <ul ref={listRef} className="kura-fitcheck-list" role="listbox" aria-label={t(language, 'fitCheck.ui.list')} data-testid="fit-check-pairs">
      {pairs.map((pair, index) => {
        const selected = index === current;
        const names = t(language, 'fitCheck.ui.pair.names', { a: pair.aName, b: pair.bName });
        const status = t(language, FIT_STATUS_KEYS[pair.status]);
        const figure = pairFigure(language, pair, report);
        const marks = [
          pair.approximate ? t(language, FIT_QUALIFIER_KEYS.approximate) : null,
          pair.recommendation?.estimate ? t(language, FIT_QUALIFIER_KEYS.estimate) : null,
          pair.simplified ? t(language, 'fitCheck.ui.pair.simplified') : null,
        ].filter((m): m is string => Boolean(m));
        const recommendation = pair.recommendation ? localizeFitMessage(language, pair.recommendation) : null;
        return (
          <li
            key={pairKey(pair)}
            role="option"
            aria-selected={selected}
            tabIndex={index === tabStop ? 0 : -1}
            className={`kura-fitcheck-pair is-${pair.status}${selected ? ' is-selected' : ''}`}
            data-status={pair.status}
            onClick={() => pick(pair, true)}
            onKeyDown={(e) => onKeyDown(e, index)}
            {...help}
            title={recommendation ?? `${names} · ${status}`}
          >
            <div className="kura-fitcheck-pair-head">
              <span className="kura-fitcheck-status">
                {STATUS_ICON[pair.status]}
                <span>{status}</span>
              </span>
              <span className="kura-fitcheck-figure">{figure}</span>
            </div>
            <div className="kura-fitcheck-names">{names}</div>
            {marks.length > 0 && (
              <div className="kura-fitcheck-marks">
                {marks.map((m) => (
                  <span key={m} className="kura-fitcheck-mark">{m}</span>
                ))}
              </div>
            )}
            {recommendation && <p className="kura-fitcheck-rec">{recommendation}</p>}
          </li>
        );
      })}
    </ul>
  );
};
