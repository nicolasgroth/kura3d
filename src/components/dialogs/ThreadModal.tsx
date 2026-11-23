/**
 * @file src/components/dialogs/ThreadModal.tsx
 * @description Diálogo generador paramétrico de roscas métricas ISO.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useRef, useState } from 'react';
import { Bolt } from 'lucide-react';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { OperationPanel } from '../OperationPanel';
import { PreviewButton } from '../preview/PreviewButton';
import { type ThreadOptions } from '../../types/kura';
import {
  defaultThreadClearance,
  isoCoarsePitch,
  THREAD_MAX_DIAMETER_MM,
  THREAD_MIN_DIAMETER_MM,
} from '../../engine/threads';
import { ISO_THREAD_PRESET_GROUPS } from './dialogPresets';
import { defaultThreadLength } from './threadLengthDefaults';

/** Modal 6: Generador Paramétrico de Roscas Métricas ISO (M3–M64). */
export const ThreadModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const createThreadObject = useKuraStore((s) => s.createThreadObject);

  const [kind, setKind] = useState<ThreadOptions['kind']>('bolt');
  const [diameterMm, setDiameterMm] = useState(8);
  const [pitchMm, setPitchMm] = useState(1.25);
  const [lengthMm, setLengthMm] = useState(20);
  const [clearanceMm, setClearanceMm] = useState(() => defaultThreadClearance(1.25));
  const [includeHead, setIncludeHead] = useState(true);
  // El largo por defecto sigue al diámetro y al tipo (perno ≈ 2,5·d, tuerca ≈ 0,8·d) hasta que el usuario lo edite.
  const lengthEdited = useRef(false);
  const syncLength = (diameter: number, nextKind: ThreadOptions['kind']) => {
    if (!lengthEdited.current) setLengthMm(defaultThreadLength(nextKind, diameter));
  };
  const failure = useOperationFailure(open);
  const uid = useId();
  // Campos con texto no numérico o fuera de rango: no se crea con el valor anterior en silencio.
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(new Set());
  const markInvalid = (field: string) => (bad: boolean) =>
    setInvalidFields((prev) => {
      if (prev.has(field) === bad) return prev;
      const next = new Set(prev);
      if (bad) next.add(field);
      else next.delete(field);
      return next;
    });
  const blocked = invalidFields.size > 0;
  // La holgura por defecto escala con el paso; cambiar el paso la restablece (editable después)
  const applyPitch = (value: number) => {
    setPitchMm(value);
    setClearanceMm(defaultThreadClearance(value));
  };

  const threadOptions: ThreadOptions = {
    kind,
    diameterMm,
    pitchMm,
    lengthMm,
    clearanceMm,
    includeHead: kind === 'bolt' ? includeHead : false,
  };

  const handleExecute = async () => {
    if (blocked) return;
    const { result: created } = await failure.run(() => createThreadObject(threadOptions));
    if (created) onClose();
  };

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.thread.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={blocked}
            aria-describedby={blocked ? `${uid}-invalid` : undefined}
            title={blocked ? t(language, 'dialog.thread.invalidFields') : t(language, 'dialog.thread.execute')}
            onClick={() => void handleExecute()}
          >
            <Bolt size={14} />
            <span>{t(language, 'dialog.thread.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      {blocked && (
        <div id={`${uid}-invalid`} role="alert" className="kura-cut-reason">
          {t(language, 'dialog.thread.invalidFields')}
        </div>
      )}
      <PreviewButton
        previewKey="thread"
        open={open}
        signature={JSON.stringify(threadOptions)}
        buildRequest={() => ({ key: 'thread', task: 'thread', args: { options: threadOptions, placement: { position: [0, 0, 0] } } })}
      />
      <div className="kura-form-field">
        <label>{t(language, 'dialog.thread.preset')}</label>
        {(
          [
            ['common', ISO_THREAD_PRESET_GROUPS.common, 'dialog.thread.presetCommon'],
            ['large', ISO_THREAD_PRESET_GROUPS.large, 'dialog.thread.presetLarge'],
          ] as const
        ).map(([group, presets, labelKey]) => (
          <div key={group} style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>{t(language, labelKey)}</div>
            <div
              role="radiogroup"
              aria-label={`${t(language, 'dialog.thread.preset')} — ${t(language, labelKey)}`}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}
            >
              {presets.map((preset) => {
                const active = diameterMm === preset.diameterMm && pitchMm === preset.pitchMm;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`kura-chip ${active ? 'is-active' : ''}`}
                    style={active ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' } : undefined}
                    onClick={() => {
                      setDiameterMm(preset.diameterMm);
                      applyPitch(preset.pitchMm);
                      syncLength(preset.diameterMm, kind);
                    }}
                  >
                    {preset.label} ({formatLocaleNumber(language, preset.pitchMm)})
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="thread-kind">{t(language, 'dialog.thread.kind')}</label>
          <select
            id="thread-kind"
            className="kura-select"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as ThreadOptions['kind'];
              setKind(next);
              syncLength(diameterMm, next);
            }}
          >
            <option value="bolt">{t(language, 'dialog.thread.kindBolt')}</option>
            <option value="nut">{t(language, 'dialog.thread.kindNut')}</option>
            <option value="hole">{t(language, 'dialog.thread.kindHole')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-diam">{t(language, 'dialog.thread.diameter')}</label>
          <PrecisionNumberInput
            id="thread-diam"
            strictRange
            onInvalidChange={markInvalid('diameter')}
            min={THREAD_MIN_DIAMETER_MM}
            max={THREAD_MAX_DIAMETER_MM}
            step={0.5}
            precision={1}
            defaultValue={8}
            value={diameterMm}
            onChange={(value) => {
              // Paso ISO 261 grueso automático al cambiar el diámetro (editable después)
              setDiameterMm(value);
              applyPitch(isoCoarsePitch(value));
              syncLength(value, kind);
            }}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-pitch">{t(language, 'dialog.thread.pitch')}</label>
          <PrecisionNumberInput
            id="thread-pitch"
            strictRange
            onInvalidChange={markInvalid('pitch')}
            min={0.2}
            max={6}
            step={0.05}
            precision={2}
            defaultValue={1.25}
            value={pitchMm}
            onChange={applyPitch}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-len">{t(language, 'dialog.thread.length')}</label>
          <PrecisionNumberInput
            id="thread-len"
            strictRange
            onInvalidChange={markInvalid('length')}
            min={4}
            max={120}
            step={1}
            precision={1}
            defaultValue={20}
            value={lengthMm}
            onChange={(value) => {
              lengthEdited.current = true;
              setLengthMm(value);
            }}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-clear">{t(language, 'dialog.thread.clearance')}</label>
          <PrecisionNumberInput
            id="thread-clear"
            strictRange
            onInvalidChange={markInvalid('clearance')}
            min={0}
            max={0.8}
            step={0.05}
            precision={2}
            defaultValue={defaultThreadClearance(pitchMm)}
            value={clearanceMm}
            onChange={setClearanceMm}
          />
        </div>

        {kind === 'bolt' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={includeHead}
              onChange={(e) => setIncludeHead(e.target.checked)}
            />
            <span style={{ fontSize: 12 }}>{t(language, 'dialog.thread.includeHead')}</span>
          </label>
        )}
      </div>
    </OperationPanel>
  );
};
