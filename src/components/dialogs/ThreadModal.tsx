/**
 * @file src/components/dialogs/ThreadModal.tsx
 * @description Diálogo generador paramétrico de roscas métricas ISO.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { Bolt } from 'lucide-react';
import { t } from '../../i18n';
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
import { ISO_THREAD_PRESETS } from './dialogPresets';

/** Modal 6: Generador Paramétrico de Roscas Métricas ISO (M3–M20). */
export const ThreadModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const createThreadObject = useKuraStore((s) => s.createThreadObject);

  const [kind, setKind] = useState<ThreadOptions['kind']>('bolt');
  const [diameterMm, setDiameterMm] = useState(8);
  const [pitchMm, setPitchMm] = useState(1.25);
  const [lengthMm, setLengthMm] = useState(20);
  const [clearanceMm, setClearanceMm] = useState(() => defaultThreadClearance(1.25));
  const [includeHead, setIncludeHead] = useState(true);
  const failure = useOperationFailure(open);
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
            onClick={() => void handleExecute()}
          >
            <Bolt size={14} />
            <span>{t(language, 'dialog.thread.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <PreviewButton
        previewKey="thread"
        open={open}
        signature={JSON.stringify(threadOptions)}
        buildRequest={() => ({ key: 'thread', task: 'thread', args: { options: threadOptions, placement: { position: [0, 0, 0] } } })}
      />
      <div className="kura-form-field">
        <label>{t(language, 'dialog.thread.preset')}</label>
        <div
          role="radiogroup"
          aria-label={t(language, 'dialog.thread.preset')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}
        >
          {ISO_THREAD_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              role="radio"
              aria-checked={diameterMm === preset.diameterMm && pitchMm === preset.pitchMm}
              className={`kura-chip ${
                diameterMm === preset.diameterMm && pitchMm === preset.pitchMm ? 'is-active' : ''
              }`}
              style={
                diameterMm === preset.diameterMm && pitchMm === preset.pitchMm
                  ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }
                  : undefined
              }
              onClick={() => {
                setDiameterMm(preset.diameterMm);
                applyPitch(preset.pitchMm);
              }}
            >
              {preset.label} ({preset.pitchMm})
            </button>
          ))}
        </div>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="thread-kind">{t(language, 'dialog.thread.kind')}</label>
          <select
            id="thread-kind"
            className="kura-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as ThreadOptions['kind'])}
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
            }}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-pitch">{t(language, 'dialog.thread.pitch')}</label>
          <PrecisionNumberInput
            id="thread-pitch"
            min={0.2}
            max={4}
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
            min={4}
            max={120}
            step={1}
            precision={1}
            defaultValue={20}
            value={lengthMm}
            onChange={setLengthMm}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="thread-clear">{t(language, 'dialog.thread.clearance')}</label>
          <PrecisionNumberInput
            id="thread-clear"
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
