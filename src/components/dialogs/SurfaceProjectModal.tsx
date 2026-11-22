/**
 * @file src/components/dialogs/SurfaceProjectModal.tsx
 * @description Diálogo de proyección conformal de texto o SVG sobre una superficie 3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { FileUp, Type } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { OperationPanel } from '../OperationPanel';
import {
  PRINT_COLOR_PALETTE,
  type SurfaceProjectionAxis,
  type SurfaceProjectionMode,
} from '../../types/kura';
import { openLocalFile } from '../../utils/platformBridge';
import { SVG_PRESETS } from './dialogPresets';

/** Modal 5: Proyección Conformal de Texto o SVG sobre cualquier superficie 3D. */
export const SurfaceProjectModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const projectOnObjectSurface = useKuraStore((s) => s.projectOnObjectSurface);
  const failure = useOperationFailure(open);

  const [kind, setKind] = useState<'text' | 'svg'>('text');
  const [text, setText] = useState('KURA3D');
  const [svgContent, setSvgContent] = useState(SVG_PRESETS.star);
  const [mode, setMode] = useState<SurfaceProjectionMode>('emboss');
  const [axis, setAxis] = useState<SurfaceProjectionAxis>('+z');
  const [widthMm, setWidthMm] = useState(18);
  const [depthMm, setDepthMm] = useState(1.2);
  const [colorHex, setColorHex] = useState('#f97316');
  const [offsetU, setOffsetU] = useState(0);
  const [offsetV, setOffsetV] = useState(0);

  const targetId = selectedIds[0] ?? objects[0]?.id;

  const handleLoadSvg = async () => {
    const file = await openLocalFile('.svg');
    if (!file) return;
    setSvgContent(new TextDecoder('utf-8').decode(file.buffer));
    setKind('svg');
  };

  const handleExecute = async () => {
    if (!targetId) return;
    const { result: res } = await failure.run(() =>
      projectOnObjectSurface(targetId, {
        kind,
        text: kind === 'text' ? text : undefined,
        svgContent: kind === 'svg' ? svgContent : undefined,
        mode,
        axis,
        widthMm,
        depthMm,
        colorHex,
        offsetU,
        offsetV,
      }),
    );
    if (res) onClose();
  };

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.project.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId || (kind === 'text' ? !text.trim() : !svgContent.trim())}
            onClick={() => void handleExecute()}
          >
            <Type size={14} />
            <span>{t(language, 'dialog.project.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="proj-kind">{t(language, 'dialog.project.kind')}</label>
          <select
            id="proj-kind"
            className="kura-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'text' | 'svg')}
          >
            <option value="text">{t(language, 'dialog.project.kindText')}</option>
            <option value="svg">{t(language, 'dialog.project.kindSvg')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-mode">{t(language, 'dialog.project.mode')}</label>
          <select
            id="proj-mode"
            className="kura-select"
            value={mode}
            onChange={(e) => setMode(e.target.value as SurfaceProjectionMode)}
          >
            <option value="emboss">{t(language, 'dialog.project.modeEmboss')}</option>
            <option value="deboss">{t(language, 'dialog.project.modeDeboss')}</option>
            <option value="flush_inlay">{t(language, 'dialog.project.modeInlay')}</option>
          </select>
        </div>
      </div>

      {kind === 'text' ? (
        <div className="kura-form-field">
          <label htmlFor="proj-text">{t(language, 'dialog.project.text')}</label>
          <input
            id="proj-text"
            className="kura-input"
            value={text}
            maxLength={32}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      ) : (
        <div className="kura-form-field">
          <div className="kura-field-row">
            <label htmlFor="proj-svg">{t(language, 'dialog.project.svg')}</label>
            <button type="button" className="kura-btn kura-btn-sm" onClick={() => void handleLoadSvg()}>
              <FileUp size={12} />
              <span>.SVG</span>
            </button>
          </div>
          <textarea
            id="proj-svg"
            className="kura-textarea"
            rows={4}
            value={svgContent}
            onChange={(e) => setSvgContent(e.target.value)}
          />
        </div>
      )}

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="proj-axis">{t(language, 'dialog.project.axis')}</label>
          <select
            id="proj-axis"
            className="kura-select"
            value={axis}
            onChange={(e) => setAxis(e.target.value as SurfaceProjectionAxis)}
          >
            <option value="+z">+Z (Frontal)</option>
            <option value="-z">-Z (Trasera)</option>
            <option value="+x">+X (Derecha)</option>
            <option value="-x">-X (Izquierda)</option>
            <option value="+y">+Y (Superior)</option>
            <option value="-y">-Y (Inferior)</option>
            <option value="cylindrical">{t(language, 'dialog.project.axisCyl')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-width">{t(language, 'dialog.project.width')}</label>
          <PrecisionNumberInput
            id="proj-width"
            min={4}
            max={200}
            step={1}
            precision={1}
            defaultValue={18}
            value={widthMm}
            onChange={setWidthMm}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-depth">{t(language, 'dialog.project.depth')}</label>
          <PrecisionNumberInput
            id="proj-depth"
            min={0.3}
            max={15}
            step={0.2}
            precision={1}
            defaultValue={1.2}
            value={depthMm}
            onChange={setDepthMm}
          />
        </div>

        <div className="kura-form-field">
          <label>{t(language, 'dialog.project.color')}</label>
          <div className="kura-swatch-row">
            {PRINT_COLOR_PALETTE.slice(0, 6).map((hex) => (
              <button
                key={hex}
                type="button"
                className={`kura-swatch ${colorHex === hex ? 'is-active' : ''}`}
                style={{ backgroundColor: hex }}
                onClick={() => setColorHex(hex)}
                aria-label={hex}
              />
            ))}
            <input
              type="color"
              className="kura-swatch-custom"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </div>
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-u">{t(language, 'dialog.project.offsetU')}</label>
          <PrecisionNumberInput
            id="proj-u"
            step={0.5}
            precision={1}
            defaultValue={0}
            value={offsetU}
            onChange={setOffsetU}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-v">{t(language, 'dialog.project.offsetV')}</label>
          <PrecisionNumberInput
            id="proj-v"
            step={0.5}
            precision={1}
            defaultValue={0}
            value={offsetV}
            onChange={setOffsetV}
          />
        </div>
      </div>
    </OperationPanel>
  );
};
