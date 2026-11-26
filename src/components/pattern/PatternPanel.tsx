/**
 * @file src/components/pattern/PatternPanel.tsx
 * @description Panel «Patrón» (no modal, en el lugar del inspector, como los demás paneles de operación): un selector de
 * tipo (lineal, circular, espejo), el formulario del tipo con deslizadores junto a los campos y la vista previa fantasma
 * de las copias en el visor, que se recalcula al cambiar un valor (con un pequeño retardo). El pie lleva el resumen
 * (`role=status`, con aviso de solape o del problema que impide aplicar) y «Aplicar patrón», que crea las copias en un
 * grupo y en un solo paso de deshacer. «Volver» y Esc los da `OperationPanel`. La lógica vive en `store/patternPanel.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Info } from 'lucide-react';
import { t } from '../../i18n';
import { MAX_PATTERN_UNION_PIECES } from '../../core/scene/patterns';
import {
  applyPatternPanel, closePatternPanel, patternRequestOf, patternTargetIds, setPatternOptions, usePatternPanel, type PatternKind,
} from '../../store/patternPanel';
import { resolvePattern, type PatternRequest } from '../../store/patternPlanning';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { useInvalidFields } from '../useInvalidFields';
import { CircularForm, LinearForm, MirrorForm, PatternCheck, RadioChoice } from './PatternForms';
import '../../styles/patternPanel.css';

/** Retardo antes de recalcular la vista previa tras un cambio de valor. */
export const PATTERN_PREVIEW_DELAY_MS = 120;

const KINDS: readonly PatternKind[] = ['linear', 'circular', 'mirror'];

export const PatternPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = usePatternPanel((s) => s.open);
  const panel = usePatternPanel();
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const plates = useKuraStore((s) => s.plates);
  const busy = useKuraStore((s) => s.busyOperation !== null);
  const invalid = useInvalidFields();
  const uid = useId();
  const close = useCallback(() => closePatternPanel(), []);

  const ids = useMemo(() => patternTargetIds(objects, selectedIds), [objects, selectedIds]);
  const request = patternRequestOf(panel, ids);
  const key = JSON.stringify(request);

  // Vista previa en vivo: se recalcula tras un breve retardo cuando cambia cualquier valor.
  const [settled, setSettled] = useState<{ key: string; request: PatternRequest }>({ key, request });
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => setSettled({ key, request }), PATTERN_PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // `request` se deriva de `key`: basta con la clave serializada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const resolved = useMemo(
    () => (open && ids.length > 0 ? resolvePattern(useKuraStore.getState(), settled.request) : null),
    // La escena cambia con `objects` y `plates`; el resto del estado lo lee `resolvePattern` al calcular.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, settled, objects, plates, ids.length],
  );
  useEffect(() => {
    usePatternPanel.setState({ ghost: open ? resolved?.ghost ?? null : null });
  }, [open, resolved]);

  // Si la selección se vacía con el panel abierto, no hay nada que repetir: se cierra.
  useEffect(() => {
    if (open && ids.length === 0) closePatternPanel();
  }, [open, ids.length]);

  const stale = settled.key !== key;
  const problem = resolved?.problem ?? null;
  const copies = panel.kind === 'mirror' ? (panel.keepOriginal ? resolved?.sources.length ?? 0 : 0) : resolved?.plan.limit.copies ?? 0;
  const canApply = open && ids.length > 0 && !busy && !invalid.blocked && !stale && !problem && (copies > 0 || (panel.kind === 'mirror' && !panel.keepOriginal));
  const tracked = invalid.track;
  const kindLabel = (k: PatternKind) => t(language, `pattern.tab.${k}`);

  return (
    <OperationPanel
      open={open}
      onClose={close}
      title={t(language, 'pattern.title')}
      className="kura-pattern-panel"
      initialFocus='input[type="radio"]:checked'
      footer={
        <>
          <p className="kura-pattern-summary" role="status" aria-live="polite" aria-atomic="true" data-testid="pattern-summary">
            {!stale && !problem && resolved ? t(language, panel.kind === 'mirror' && !panel.keepOriginal ? 'pattern.summary.replace' : 'pattern.summary', { copies }) : ''}
          </p>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!canApply}
            onClick={() => void applyPatternPanel()}
            title={t(language, 'pattern.apply.tip')}
            data-testid="pattern-apply"
          >
            <Copy size={14} aria-hidden="true" />
            <span>{t(language, busy ? 'pattern.apply.busy' : 'pattern.apply')}</span>
          </button>
        </>
      }
    >
      <RadioChoice
        legend={t(language, 'pattern.tabs')} name={`${uid}-kind`} value={panel.kind} testId="pattern-kind"
        onChange={(kind) => setPatternOptions({ kind })}
        options={KINDS.map((k) => ({ value: k, label: kindLabel(k), testId: `pattern-kind-${k}` }))}
      />

      {panel.kind === 'linear' && <LinearForm track={tracked} />}
      {panel.kind === 'circular' && <CircularForm track={tracked} />}
      {panel.kind === 'mirror' && <MirrorForm track={tracked} />}

      <PatternCheck
        label={t(language, 'pattern.union')} help={t(language, 'pattern.union.help', { max: MAX_PATTERN_UNION_PIECES })} checked={panel.union}
        disabled={panel.kind === 'mirror' && !panel.keepOriginal}
        onChange={(union) => setPatternOptions({ union })} testId="pattern-union"
      />

      <section className="kura-pattern-preview" aria-labelledby={`${uid}-preview`} data-testid="pattern-preview">
        <h3 id={`${uid}-preview`} className="kura-section-label">{t(language, 'pattern.preview')}</h3>
        {problem && (
          <p className="kura-pattern-note is-error" role="alert" data-testid="pattern-problem">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>{t(language, problem.key, problem.params)}</span>
          </p>
        )}
        {!problem && resolved && resolved.plan.overlapCells > 0 && panel.kind !== 'mirror' && !panel.union && (
          <p className="kura-pattern-note is-warning" data-testid="pattern-overlap">
            <AlertTriangle size={13} aria-hidden="true" />
            <span>{t(language, 'pattern.warn.overlap', { count: resolved.plan.overlapCells })}</span>
          </p>
        )}
        {!problem && resolved && copies > 0 && (
          <p className="kura-pattern-note" data-testid="pattern-ghost-note">
            <Info size={13} aria-hidden="true" />
            <span>{t(language, resolved.ghost ? 'pattern.ghost.note' : 'pattern.ghost.none')}</span>
          </p>
        )}
      </section>
    </OperationPanel>
  );
};
