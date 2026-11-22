/**
 * @file src/components/dialogs/SvgImportModal.tsx
 * @description Diálogo para importar un SVG y extruirlo a sólido 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { NativeModal } from '../NativeModal';
import { openLocalFile } from '../../utils/platformBridge';
import { SVG_PRESETS } from './dialogPresets';

/** Modal 1: Importar y Extruir SVG a sólido 3D. */
export const SvgImportModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const importSvgModel = useKuraStore((s) => s.importSvgModel);

  const [name, setName] = useState('Emblema Kura');
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

  const handleGenerate = async () => {
    const created = await importSvgModel({
      svgContent,
      name,
      depth,
      targetWidth,
      curveSegments,
    });
    if (created) onClose();
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
            disabled={!svgContent.trim()}
            onClick={() => void handleGenerate()}
          >
            <Sparkles size={14} />
            <span>{t(language, 'dialog.svg.generate')}</span>
          </button>
        </>
      }
    >
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
            setName('Estrella SVG');
          }}
        >
          {t(language, 'dialog.svg.presetStar')}
        </button>
        <button
          type="button"
          className="kura-chip"
          onClick={() => {
            setSvgContent(SVG_PRESETS.badge);
            setName('Emblema Kura');
          }}
        >
          {t(language, 'dialog.svg.presetBadge')}
        </button>
        <button
          type="button"
          className="kura-chip"
          onClick={() => {
            setSvgContent(SVG_PRESETS.gear);
            setName('Engranaje SVG');
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
