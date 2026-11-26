/**
 * @file src/components/dialogs/SvgImportModal.tsx
 * @description Diálogo para importar un SVG y extruirlo a sólido 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { NativeModal } from '../NativeModal';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { openLocalFile } from '../../utils/platformBridge';
import { useInvalidFields } from '../useInvalidFields';
import { activeBedSize } from '../../store/bedSize';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import '../../styles/genUiDialogs.css';
import { SVG_PRESETS } from './dialogPresets';

/** Modal 1: Importar y Extruir SVG a sólido 3D. */
export const SvgImportModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const importSvgModel = useKuraStore((s) => s.importSvgModel);

  const failure = useOperationFailure(open);
  // Campos fuera de rango o no numéricos: se marcan y no se aplica nada acotado en silencio.
  const invalid = useInvalidFields();
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBedDimensions = useKuraStore((s) => s.customBedDimensions);
  const [name, setName] = useState(() => t(useKuraStore.getState().language, 'dialog.svg.presetBadge'));
  const [depth, setDepth] = useState(6);
  const [targetWidth, setTargetWidth] = useState(60);
  const [curveSegments, setCurveSegments] = useState(12);
  const [svgContent, setSvgContent] = useState(SVG_PRESETS.badge);

  const handleUploadSvg = async () => {
    const file = await openLocalFile('.svg');
    if (!file) return;
    const text = new TextDecoder('utf-8').decode(file.buffer);
    setSvgContent(text);
    setName(file.name.replace(/\.svg$/i, ''));
  };

  // Aviso (no bloqueo) si el ancho elegido supera la cama: la pieza se podría dividir para imprimir.
  const bed = activeBedSize({ printerProfile, customBedDimensions });
  const widerThanBed = bed !== null && targetWidth > Math.max(bed.width, bed.depth);

  const handleGenerate = async () => {
    if (invalid.blocked) return;
    // El fallo se muestra dentro del diálogo y este queda abierto con sus valores.
    const { result: created, failed } = await failure.run(() =>
      importSvgModel({
        svgContent,
        name,
        depth,
        targetWidth,
        curveSegments,
      }),
    );
    if (created && !failed) onClose();
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.svg.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!svgContent.trim() || invalid.blocked}
            title={invalid.blocked ? t(language, 'genUi.svg.fieldsInvalid') : undefined}
            onClick={() => void handleGenerate()}
          >
            <Sparkles size={14} />
            <span>{t(language, 'dialog.svg.generate')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button type="button" className="kura-btn kura-btn-sm" onClick={() => void handleUploadSvg()}>
          <FileUp size={13} />
          <span>{t(language, 'dialog.svg.upload')}</span>
        </button>

        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
          {t(language, 'dialog.svg.presetLabel')}:
        </span>
        <button
          type="button"
          className="kura-chip"
          onClick={() => {
            setSvgContent(SVG_PRESETS.star);
            setName(t(language, 'dialog.svg.presetStar'));
          }}
        >
          {t(language, 'dialog.svg.presetStar')}
        </button>
        <button
          type="button"
          className="kura-chip"
          onClick={() => {
            setSvgContent(SVG_PRESETS.badge);
            setName(t(language, 'dialog.svg.presetBadge'));
          }}
        >
          {t(language, 'dialog.svg.presetBadge')}
        </button>
        <button
          type="button"
          className="kura-chip"
          onClick={() => {
            setSvgContent(SVG_PRESETS.gear);
            setName(t(language, 'dialog.svg.presetGear'));
          }}
        >
          {t(language, 'dialog.svg.presetGear')}
        </button>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="svg-name">{t(language, 'dialog.svg.name')}</label>
          <input
            id="svg-name"
            className="kura-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="svg-depth">{t(language, 'dialog.svg.depth')} (mm)</label>
          <PrecisionNumberInput
            id="svg-depth"
            strictRange
            onInvalidChange={invalid.track('depth')}
            min={0.5}
            max={150}
            step={0.5}
            precision={1}
            defaultValue={6}
            value={depth}
            onChange={setDepth}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="svg-width">{t(language, 'dialog.svg.width')} (mm)</label>
          <PrecisionNumberInput
            id="svg-width"
            strictRange
            onInvalidChange={invalid.track('width')}
            min={5}
            max={350}
            step={1}
            precision={1}
            defaultValue={60}
            value={targetWidth}
            onChange={setTargetWidth}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="svg-seg">{t(language, 'dialog.svg.segments')}</label>
          <PrecisionNumberInput
            id="svg-seg"
            strictRange
            onInvalidChange={invalid.track('seg')}
            min={4}
            max={48}
            step={1}
            precision={0}
            defaultValue={12}
            value={curveSegments}
            onChange={(val) => setCurveSegments(Math.round(val))}
          />
        </div>
      </div>

      {invalid.blocked && <div role="alert" className="kura-cut-reason">{t(language, 'genUi.svg.fieldsInvalid')}</div>}
      {widerThanBed && bed && (
        <div role="status" className="kura-gen-warn">
          {t(language, 'genUi.svg.noFit', {
            width: formatLocaleNumber(language, targetWidth, { maxFrac: 1 }),
            bed: formatLocaleNumber(language, Math.max(bed.width, bed.depth), { maxFrac: 0 }),
          })}
        </div>
      )}

      <div className="kura-form-field">
        <label htmlFor="svg-code">{t(language, 'dialog.svg.code')}</label>
        <textarea
          id="svg-code"
          className="kura-textarea"
          rows={6}
          value={svgContent}
          onChange={(e) => setSvgContent(e.target.value)}
        />
      </div>
    </NativeModal>
  );
};
