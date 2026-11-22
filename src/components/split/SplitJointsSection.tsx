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

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, CircleDot, Paperclip, RefreshCw, ShieldCheck } from 'lucide-react';
import { t } from '../../i18n';
import { userAxisLabel, userAxisOfInternal } from '../../core/scene/displayAxes';
import {
  assemblyOrderOf, buildJointRows, groupLooseDowels, optionType,
  type SplitJointRow, type SplitJointStatus,
} from '../../core/scene/splitJointStatus';
import { splitGroupOf } from '../../core/scene/splitGroups';
import { groupNotesOf } from '../../core/scene/splitGroupNotes';
import { SplitAssemblyStatus } from './SplitAssemblyStatus';
import { localizeWarnings } from '../../store/operationErrors';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { formatNumber, tCount } from '../../utils/plural';
import '../../styles/splitJoints.css';
import '../../styles/splitUx.css';

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

/** `groupId` del grupo dividido al que pertenece el objeto, o null. */
const group0 = (objects: SceneObject[], id: string): string | null => splitGroupOf(objects, id)?.groupId ?? null;

export const SplitJointsSection: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const notesAll = useKuraStore((s) => s.splitNotes);
  const validationAll = useKuraStore((s) => s.splitValidation);
  const validate = useKuraStore((s) => s.validateSplitGroup);
  const setFocus = useKuraStore((s) => s.setSplitJointFocus);
  const requestCamera = useKuraStore((s) => s.requestCameraPreset);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const reinforceGroup = useKuraStore((s) => s.reinforceSplitGroup);
  const canReinforce = useKuraStore((s) => {
    const rec = group0(s.objects, primary.id) ? s.splitRequests[group0(s.objects, primary.id)!] : undefined;
    return Boolean(rec && !rec.request.execute.reinforceWeakJoints && s.past.length === rec.historyDepth);
  });
  const reinforced = useKuraStore((s) => {
    const gid = group0(s.objects, primary.id);
    return Boolean(gid && s.splitRequests[gid]?.request.execute.reinforceWeakJoints);
  });
  // Con tamaño automático el motor ya llevó cada conector a su recomendado: agrandar más no ayuda.
  const autoSized = useKuraStore((s) => {
    const gid = group0(s.objects, primary.id);
    return Boolean(gid && s.splitRequests[gid]?.request.execute.connector?.sizeAuto);
  });
  const uid = useId();
  const [pinned, setPinned] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const group = useMemo(() => splitGroupOf(objects, primary.id), [objects, primary.id]);
  const groupId = group?.groupId ?? null;
  const validation = groupId ? validationAll[groupId] : undefined;
  const report = validation?.status === 'done' ? validation.report : null;
  // Lo que dijo el motor al dividir: de la sesión o, si se reabrió el archivo, el guardado con las piezas.
  const notes = useMemo(() => (group ? groupNotesOf(group.parts, groupId ? notesAll[groupId] : null) : null), [group, groupId, notesAll]);
  const rows = useMemo(() => (group ? buildJointRows(group, notes, report) : []), [group, notes, report]);
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
  const warnText = (row: SplitJointRow) =>
    row.warnings.map((w) => {
      if (w.code === 'ASSEMBLY_JOINT_TYPE_CHANGED') {
        return t(language, 'splitJoints.note.changed', { from: jointTypeName(language, { type: String(w.params.from) }), to: jointTypeName(language, { type: String(w.params.to) }) });
      }
      if (w.code === 'ASSEMBLY_JOINT_GLUED_FOR_ORDER') return t(language, 'splitJoints.note.gluedFix');
      if (w.code === 'ASSEMBLY_CONNECTOR_CLASH') {
        return t(language, 'splitJoints.note.clash', { distance: fmt(Math.max(0, Number(w.params.distance))), required: fmt(Number(w.params.required)) });
      }
      // La marca de puntos se explica en la línea de la marca de la unión
      if (w.code === 'SPLIT_LABEL_DOTS') return '';
      if (w.code === 'SPLIT_CONNECTOR_REINFORCED') {
        const p = w.params;
        // El motor habla en radio; la interfaz, siempre en diámetro Ø.
        return t(language, 'splitUx.reinforced', {
          requested: fmt(2 * Number(p.requested), 1), size: fmt(2 * Number(p.size), 1),
          requestedCount: fmt(Number(p.requestedCount), 0), count: fmt(Number(p.count), 0),
        });
      }
      return localizeWarnings(language, [w])[0];
    });
  const markText = (row: SplitJointRow): string => {
    if (row.mark === 'dots') return t(language, 'splitJoints.note.dots', { label: row.label });
    if (row.mark === 'unknown') return '';
    return t(language, `splitJoints.mark.${row.mark}`, { label: row.label, a: row.a, b: row.b });
  };

  // Textos propios de cada unión; los que se repiten en varias se muestran una sola vez arriba.
  const rowTexts = new Map<string, string[]>();
  for (const row of rows) {
    const texts = warnText(row).filter(Boolean);
    if (row.status === 'glue') texts.push(t(language, 'splitJoints.note.glue'));
    rowTexts.set(row.label, texts);
  }
  const textCount = new Map<string, number>();
  for (const texts of rowTexts.values()) for (const text of new Set(texts)) textCount.set(text, (textCount.get(text) ?? 0) + 1);
  const common = [...textCount].filter(([, n]) => n > 1);
  const commonSet = new Set(common.map(([text]) => text));
  const weakRows = rows.filter((r) => r.weak !== null);
  const limited = reinforced || autoSized || weakRows.some((r) => r.reinforced);

  const focusRow = (label: string) => {
    const record = rows.find((r) => r.label === label);
    if (!record) return;
    const ids = group.parts.filter((p) => p.metadata.split.code === record.a || p.metadata.split.code === record.b).map((p) => p.id);
    if (ids.length > 0) requestCamera('focus', ids);
  };
  /** Flechas arriba/abajo, Inicio y Fin mueven el foco entre las uniones de la lista. */
  const onListKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!(e.target instanceof Element) || !e.target.classList.contains('kura-split-joint-btn')) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.kura-split-joint-btn') ?? []);
    const at = buttons.indexOf(e.target as HTMLButtonElement);
    if (buttons.length === 0 || at < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : Math.min(buttons.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
    buttons[next]?.focus();
  };

  return (
    <section className="kura-split-joints-section" aria-labelledby={`${uid}-title`}>
      <SplitAssemblyStatus language={language} notes={notes} validation={report} />
      <h3 id={`${uid}-title`} className="kura-section-label">{t(language, 'splitJoints.title')} ({rows.length})</h3>
      {weakRows.length > 0 && (
        <div className="kura-split-weak-summary" role="note" data-testid="split-weak-summary">
          <p className="kura-split-weak-title">
            <AlertTriangle size={13} aria-hidden="true" />
            <strong>{tCount(language, { one: 'splitUx.weak.summary.one', other: 'splitUx.weak.summary.other' }, weakRows.length)}</strong>
          </p>
          <p>{t(language, limited ? 'splitUx.weak.adviceLimit' : 'splitUx.weak.advice')}</p>
          {canReinforce ? (
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={busy}
              title={t(language, 'splitJoints.reinforceTip')}
              onClick={() => void reinforceGroup(groupId)}
            >
              <ShieldCheck size={13} aria-hidden="true" />
              <span>{t(language, 'splitJoints.reinforce')}</span>
            </button>
          ) : !reinforced && (
            <small className="kura-cut-hint">{t(language, 'splitJoints.reinforceHow')}</small>
          )}
        </div>
      )}
      {common.length > 0 && (
        <div className="kura-split-common-notes" role="note" data-testid="split-common-notes">
          <strong>{t(language, 'splitUx.common.title')}</strong>
          <ul>
            {common.map(([text, n]) => (
              <li key={text}>{tCount(language, { one: 'splitUx.common.count.one', other: 'splitUx.common.count.other' }, n, { text })}</li>
            ))}
          </ul>
        </div>
      )}
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
        <ul className="kura-split-joint-list" ref={listRef} aria-label={t(language, 'splitUx.list.label')} onKeyDown={onListKey}>
          {rows.map((row) => {
            const axis = userAxisOfInternal(row.axis);
            const statusText = t(language, `splitJoints.status.${row.status}`);
            const typeName = jointTypeName(language, row);
            const count = row.centers.length;
            const own = (rowTexts.get(row.label) ?? []).filter((text) => !commonSet.has(text));
            const mark = markText(row);
            const weakShort = row.weak
              ? t(language, reinforced || row.reinforced ? 'splitUx.weak.shortLimit' : 'splitUx.weak.short', { measured: fmt(2 * row.weak.measuredMm), recommended: fmt(2 * row.weak.recommendedMm) })
              : null;
            const noteId = `${uid}-n-${row.label}`;
            const hasDetail = own.length > 0 || Boolean(mark) || row.status === 'blocked';
            return (
              <li key={row.label} className="kura-split-joint" data-status={row.status} data-testid={`split-joint-${row.label}`}>
                <button
                  type="button"
                  className="kura-split-joint-btn"
                  aria-pressed={pinned === row.label}
                  aria-label={`${t(language, 'splitJoints.item', { label: row.label, a: row.a, b: row.b })}. ${t(language, 'splitJoints.status.label')}: ${statusText}${row.labelDots ? `, ${t(language, 'splitJoints.status.dots')}` : ''}`}
                  aria-describedby={noteId}
                  title={t(language, 'splitUx.focus.hint')}
                  onMouseEnter={() => show(row.label)}
                  onMouseLeave={rest}
                  onFocus={() => show(row.label)}
                  onBlur={rest}
                  onClick={() => {
                    const next = pinned === row.label ? null : row.label;
                    setPinned(next);
                    setFocus(next ? { groupId, label: next } : null);
                    if (next) focusRow(next);
                  }}
                >
                  <span className="kura-split-joint-label">{t(language, 'splitJoints.item', { label: row.label, a: row.a, b: row.b })}</span>
                  <span className="kura-split-joint-status" data-status={row.status}>
                    {STATUS_ICON[row.status]} {statusText}
                  </span>
                  {row.labelDots && (
                    <span className="kura-split-joint-status" data-status="dots" title={t(language, 'splitJoints.note.dotsShort')}>
                      <CircleDot size={12} aria-hidden="true" /> {t(language, 'splitJoints.status.dots')}
                    </span>
                  )}
                </button>
                <small id={noteId} className="kura-cut-hint kura-split-joint-line">
                  {t(language, 'splitJoints.plane', { axis: userAxisLabel(row.axis), pos: fmt(Math.round(axis.sign * row.position * 10) / 10 + 0) })}
                  {' · '}
                  {row.connector && row.kind === 'connector' && count > 0
                    ? t(language, row.connector.type === 'dovetail' ? 'splitJoints.connectorsWidth' : 'splitJoints.connectors', { count, type: typeName, d: fmt(2 * row.connector.size) })
                    : typeName}
                  {weakShort && (
                    <span className="kura-split-joint-weak" data-testid={`split-joint-weak-${row.label}`}>
                      {' · '}<AlertTriangle size={11} aria-hidden="true" /> {weakShort}
                    </span>
                  )}
                </small>
                {hasDetail && (
                  <details className="kura-split-joint-detail" open={row.status === 'blocked' || undefined}>
                    <summary aria-label={t(language, 'splitUx.detailOf', { label: row.label })} title={t(language, 'splitUx.detailOf', { label: row.label })}>
                      {t(language, 'splitUx.detail')}
                    </summary>
                    <div className="kura-split-joint-notes">
                      {mark && (
                        <p className="kura-split-joint-note" data-kind="info" data-testid={`split-joint-mark-${row.label}`}>
                          <CircleDot size={12} aria-hidden="true" />
                          <span>{mark}</span>
                        </p>
                      )}
                      {own.map((text) => (
                        <p key={text} className="kura-split-joint-note" data-kind="info">
                          <AlertTriangle size={12} aria-hidden="true" />
                          <span>{text}</span>
                        </p>
                      ))}
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
                  </details>
                )}
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
                {o.step === null
                  ? o.code
                  : o.step === 1
                    ? t(language, 'splitJoints.order.base', { n: o.step, code: o.code })
                    : !o.direction
                      ? `${t(language, 'splitJoints.order.badge', { n: o.step })}: ${o.code}`
                      : t(language, 'splitJoints.order.step', { n: o.step, code: o.code, dir: directionText(language, o.direction) })}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
};
