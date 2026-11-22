/**
 * @file src/components/split/SplitJointsSection.tsx
 * @description Sección "Uniones" del inspector para una pieza de una división: lista de uniones con las
 * piezas que unen, el tipo de conector y su estado (firme, débil, para pegar, tipo cambiado o que traba el
 * montaje) con icono y texto; al pasar el cursor o el foco por una unión se resalta en el visor. Muestra
 * los avisos de cada unión (débil, solape no imprimible, marca limitada), las alternativas que sugiere el
 * motor, el botón "Validar armado" con su resultado y el orden de montaje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, Paperclip, RefreshCw, ShieldCheck } from 'lucide-react';
import { t } from '../../i18n';
import { userAxisLabel, userAxisOfInternal } from '../../core/scene/displayAxes';
import {
  assemblyOrderOf, buildJointRows, groupLooseDowels, optionType,
  type SplitJointRow, type SplitJointStatus,
} from '../../core/scene/splitJointStatus';
import { splitGroupOf } from '../../core/scene/splitGroups';
import { localizeWarnings } from '../../store/operationErrors';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { formatNumber } from '../../utils/plural';
import '../../styles/splitJoints.css';

const STATUS_ICON: Record<SplitJointStatus, React.ReactNode> = {
  ok: <CheckCircle2 size={12} aria-hidden="true" />,
  weak: <AlertTriangle size={12} aria-hidden="true" />,
  glue: <Paperclip size={12} aria-hidden="true" />,
  changed: <RefreshCw size={12} aria-hidden="true" />,
  blocked: <Ban size={12} aria-hidden="true" />,
};

/** Nombre del tipo de conector o de unión para el usuario. */
export function jointTypeName(language: LanguageCode, row: Pick<SplitJointRow, 'kind' | 'connector'> | { type: string }): string {
  const type = 'type' in row ? row.type : row.kind === 'connector' ? row.connector?.type ?? 'none' : row.kind;
  if (type === 'dowel' || type === 'peg' || type === 'dovetail') return t(language, `dialog.cut.connector.${type}`);
  if (type === 'glue' || type === 'lap' || type === 'loose-dowel' || type === 'socket' || type === 'none') return t(language, `splitJoints.type.${type}`);
  return type;
}

/** Texto de una dirección de entrada (movimiento de la pieza, ejes internos) con los ejes del usuario. */
export function directionText(language: LanguageCode, direction: string): string {
  const sign = direction.startsWith('-') ? -1 : 1;
  const internal = direction.slice(1) as 'x' | 'y' | 'z';
  if (internal === 'y') return t(language, sign < 0 ? 'splitJoints.dir.down' : 'splitJoints.dir.up');
  const user = userAxisOfInternal(internal);
  return t(language, 'splitJoints.dir.axis', { axis: `${sign * user.sign < 0 ? '−' : '+'}${user.axis.toUpperCase()}` });
}

export const SplitJointsSection: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const notesAll = useKuraStore((s) => s.splitNotes);
  const validationAll = useKuraStore((s) => s.splitValidation);
  const validate = useKuraStore((s) => s.validateSplitGroup);
  const setFocus = useKuraStore((s) => s.setSplitJointFocus);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const uid = useId();
  const [pinned, setPinned] = useState<string | null>(null);

  const group = useMemo(() => splitGroupOf(objects, primary.id), [objects, primary.id]);
  const groupId = group?.groupId ?? null;
  const validation = groupId ? validationAll[groupId] : undefined;
  const report = validation?.status === 'done' ? validation.report : null;
  const rows = useMemo(
    () => (group ? buildJointRows(group, groupId ? notesAll[groupId] : null, report) : []),
    [group, groupId, notesAll, report],
  );
  const order = useMemo(() => (group ? assemblyOrderOf(group) : []), [group]);
  const dowels = useMemo(() => (groupId ? groupLooseDowels(objects, groupId) : []), [objects, groupId]);

  // Al cambiar de grupo o salir, el resaltado vuelve a apagarse.
  useEffect(() => {
    setPinned(null);
    return () => setFocus(null);
  }, [groupId, setFocus]);

  if (!group || !groupId) return null;
  const fmt = (n: number, d = 1) => formatNumber(language, n, { maximumFractionDigits: d });
  const hasSteps = order.some((o) => o.step !== null);
  const running = validation?.status === 'running';
  const show = (label: string) => setFocus({ groupId, label });
  const rest = () => setFocus(pinned ? { groupId, label: pinned } : null);
  const warnText = (row: SplitJointRow) => localizeWarnings(language, row.warnings);

  return (
    <section className="kura-split-joints-section" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`} className="kura-section-label">{t(language, 'splitJoints.title')} ({rows.length})</h3>
      {rows.length > 0 && <small className="kura-cut-hint">{t(language, 'splitJoints.intro')}</small>}
      {dowels.length > 0 && (
        <p className="kura-split-joint-dowels">
          {dowels.map((d) => (
            <span key={d.id}>{t(language, 'splitJoints.dowels', { count: d.count, d: fmt(d.diameterMm), l: fmt(d.lengthMm) })}</span>
          ))}
        </p>
      )}
      {rows.length === 0 ? (
        <small className="kura-cut-hint">{t(language, 'splitJoints.none')}</small>
      ) : (
        <ul className="kura-split-joint-list">
          {rows.map((row) => {
            const axis = userAxisOfInternal(row.axis);
            const statusText = t(language, `splitJoints.status.${row.status}`);
            const typeName = jointTypeName(language, row);
            const count = row.centers.length;
            const notes = warnText(row);
            const noteId = `${uid}-n-${row.label}`;
            return (
              <li key={row.label} className="kura-split-joint" data-status={row.status} data-testid={`split-joint-${row.label}`}>
                <button
                  type="button"
                  className="kura-split-joint-btn"
                  aria-pressed={pinned === row.label}
                  aria-label={`${t(language, 'splitJoints.item', { label: row.label, a: row.a, b: row.b })}. ${t(language, 'splitJoints.status.label')}: ${statusText}`}
                  aria-describedby={notes.length > 0 || row.status !== 'ok' ? noteId : undefined}
                  title={t(language, 'splitJoints.intro')}
                  onMouseEnter={() => show(row.label)}
                  onMouseLeave={rest}
                  onFocus={() => show(row.label)}
                  onBlur={rest}
                  onClick={() => {
                    const next = pinned === row.label ? null : row.label;
                    setPinned(next);
                    setFocus(next ? { groupId, label: next } : null);
                  }}
                >
                  <span className="kura-split-joint-label">{t(language, 'splitJoints.item', { label: row.label, a: row.a, b: row.b })}</span>
                  <span className="kura-split-joint-status" data-status={row.status}>
                    {STATUS_ICON[row.status]} {statusText}
                  </span>
                </button>
                <small className="kura-cut-hint">
                  {t(language, 'splitJoints.plane', { axis: userAxisLabel(row.axis), pos: fmt(axis.sign * row.position) })}
                  {' · '}
                  {row.connector && row.kind === 'connector' && count > 0
                    ? t(language, 'splitJoints.connectors', { count, type: typeName, d: fmt(2 * row.connector.size) })
                    : typeName}
                </small>
                <div id={noteId} className="kura-split-joint-notes">
                  {row.weak && (
                    <p className="kura-split-joint-note" data-kind="warn">
                      <AlertTriangle size={12} aria-hidden="true" />
                      <span>{t(language, 'splitJoints.note.weak', { measured: fmt(row.weak.measuredMm), recommended: fmt(row.weak.recommendedMm) })}</span>
                    </p>
                  )}
                  {notes.map((text) => (
                    <p key={text} className="kura-split-joint-note" data-kind="info">
                      <AlertTriangle size={12} aria-hidden="true" />
                      <span>{text}</span>
                    </p>
                  ))}
                  {row.status === 'glue' && (
                    <p className="kura-split-joint-note" data-kind="info">
                      <Paperclip size={12} aria-hidden="true" />
                      <span>{t(language, 'splitJoints.note.glue')}</span>
                    </p>
                  )}
                  {row.status === 'blocked' && (
                    <>
                      <p className="kura-split-joint-note" data-kind="warn">
                        <Ban size={12} aria-hidden="true" />
                        <span>{t(language, 'splitJoints.note.blocked', { codes: row.blocks.length > 0 ? row.blocks.join(', ') : `${row.a}, ${row.b}` })}</span>
                      </p>
                      <div className="kura-split-joint-options">
                        <strong>{t(language, 'splitJoints.suggest.intro')}</strong>
                        <ul>
                          {row.options.map((option) => {
                            const type = optionType(option);
                            const name = type ? jointTypeName(language, { type }) : '';
                            return (
                              <li
                                key={option}
                                title={type ? t(language, 'splitJoints.suggest.changeTip', { type: name }) : t(language, 'splitJoints.suggest.glueTip')}
                              >
                                {type ? t(language, 'splitJoints.suggest.change', { type: name }) : t(language, 'splitJoints.suggest.glue')}
                              </li>
                            );
                          })}
                        </ul>
                        <small className="kura-cut-hint">{t(language, 'splitJoints.suggest.howto')}</small>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="kura-btn kura-btn-sm kura-split-validate"
        disabled={busy || running || rows.length === 0}
        aria-busy={running}
        title={t(language, 'splitJoints.validateTip')}
        onClick={() => void validate(groupId)}
      >
        <ShieldCheck size={13} aria-hidden="true" />
        <span>{t(language, running ? 'splitJoints.validating' : 'splitJoints.validate')}</span>
      </button>
      <div className="kura-split-validation" role="status" aria-live="polite">
        {validation?.status === 'error' && <p data-kind="warn">{t(language, 'splitJoints.result.error')}</p>}
        {validation?.status === 'nodata' && <p data-kind="warn">{t(language, 'splitJoints.result.noData')}</p>}
        {report && (
          <>
            <p data-kind={report.ok ? 'ok' : 'warn'} className="kura-split-validation-main">
              {report.ok ? <CheckCircle2 size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
              <span>{report.ok ? t(language, 'splitJoints.result.ok', { count: report.parts }) : t(language, 'splitJoints.result.fail')}</span>
            </p>
            <ul>
              {report.clashes > 0 && <li>{t(language, 'splitJoints.result.clashes', { count: report.clashes })}</li>}
              {report.closure.interference.length > 0 && <li>{t(language, 'splitJoints.result.interference', { count: report.closure.interference.length })}</li>}
              {report.closure.gaps.length > 0 && <li>{t(language, 'splitJoints.result.gaps', { count: report.closure.gaps.length })}</li>}
              {report.blocked.length > 0 && <li>{t(language, 'splitJoints.result.blocked', { codes: report.blocked.join(', ') })}</li>}
              {report.weak.length > 0 && <li>{t(language, 'splitJoints.result.weak', { labels: report.weak.map((w) => w.joint).join(', ') })}</li>}
            </ul>
          </>
        )}
      </div>

      {hasSteps && (
        <>
          <h4 className="kura-split-order-title">{t(language, 'splitJoints.order.title')}</h4>
          <ol className="kura-split-order">
            {order.map((o) => (
              <li key={o.id}>
                {o.step !== null
                  ? t(language, 'splitJoints.order.step', { n: o.step, code: o.code, dir: o.direction ? directionText(language, o.direction) : '' })
                  : o.code}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};
