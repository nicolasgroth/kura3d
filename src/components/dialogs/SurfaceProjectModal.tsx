/**
 * @file src/components/dialogs/SurfaceProjectModal.tsx
 * @description Panel de proyección conformal de texto o SVG sobre una superficie 3D, con vista
 * previa en vivo en el visor y colocación con clic sobre la pieza (fija cara y U/V).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/surfaceProject.css';
import { Crosshair, FileUp, Type } from 'lucide-react';
import { t } from '../../i18n';
import { suggestProjectionFace, suggestProjectionWidth } from '../../engine/projectionSuggest';
import { useKuraStore } from '../../store/useKuraStore';
import { useBoundOperationTarget } from '../useBoundOperationTarget';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';
import { OperationPanel } from '../OperationPanel';
import {
  PRINT_COLOR_PALETTE,
  type SurfaceProjectionAxis,
  type SurfaceProjectionMode,
  type SurfaceProjectionOptions,
} from '../../types/kura';
import { openLocalFile } from '../../utils/platformBridge';
import { currentCameraPosition } from '../viewport/viewCameraRegistry';
import { SVG_PRESETS } from './dialogPresets';
import '../../styles/genUiDialogs.css';
import {
  faceOfInternalDirection,
  userDirectionOfInternal,
  type AxisDirection,
} from '../../core/scene/displayAxes';

/** Direcciones internas en el orden del selector: superior, inferior, frontal, trasera, derecha, izquierda. */
const PROJECTION_DIRECTIONS: AxisDirection[] = ['+y', '-y', '+z', '-z', '+x', '-x'];

/** Modal 5: Proyección Conformal de Texto o SVG sobre cualquier superficie 3D. */
export const SurfaceProjectModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
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

  const { target, targetId } = useBoundOperationTarget(open, onClose);
  const requestPreview = useKuraStore((s) => s.requestOperationPreview);
  const clearPreview = useKuraStore((s) => s.clearOperationPreview);
  const previewStatus = useKuraStore((s) => (s.operationPreview.key === 'project' ? s.operationPreview.status : 'idle'));
  const previewError = useKuraStore((s) => (s.operationPreview.key === 'project' ? s.operationPreview.error ?? null : null));
  const surfacePick = useKuraStore((s) => s.surfacePick);
  const setSurfacePick = useKuraStore((s) => s.setSurfacePick);
  const picking = Boolean(open && surfacePick && surfacePick.objectId === targetId);
  // Si el usuario ya fijó el ancho a mano, la sugerencia por cara no lo pisa.
  const widthEdited = useRef(false);
  const textRef = useRef(text);
  textRef.current = text;
  const content = kind === 'text' ? text.trim() : svgContent.trim();

  const options: SurfaceProjectionOptions = {
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
  };
  const signature = JSON.stringify(options);

  // Al abrir (o cambiar de pieza): cara más grande que mira a la cámara y ancho que quepa.
  useEffect(() => {
    if (!open || !target) return;
    widthEdited.current = false;
    setAxis(suggestProjectionFace(target, { cameraPosition: currentCameraPosition() }));
    // Solo al abrir o cambiar de pieza, no en cada edición de la malla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId]);

  // Ancho sugerido para la cara elegida (se recalcula al cambiar de cara hasta que el usuario lo edite).
  useEffect(() => {
    if (!open || !target || kind !== 'text' || widthEdited.current) return;
    let cancelled = false;
    void suggestProjectionWidth(target, axis, textRef.current.trim() || 'KURA3D')
      .then((w) => { if (!cancelled && !widthEdited.current) setWidthMm(w); })
      .catch(() => { /* sin sugerencia: se conserva el ancho actual */ });
    return () => { cancelled = true; };
    // Solo cambian la cara, el tipo o la pieza; el texto se lee por ref para no recalcular al teclear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId, axis, kind]);

  // Vista previa en vivo sobre la pieza (debounce y descarte de obsoletos en el store).
  useEffect(() => {
    if (!open || !target || !content) {
      clearPreview('project');
      return;
    }
    requestPreview({ key: 'project', task: 'projectSurface', args: { obj: target, options } });
    // `options` se resume en `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, signature, content]);

  useEffect(() => {
    if (open) return;
    clearPreview('project');
    setSurfacePick(null);
  }, [open, clearPreview, setSurfacePick]);

  // Clic sobre la pieza: fija cara y U/V.
  const pickNonce = surfacePick?.nonce ?? 0;
  useEffect(() => {
    const placement = useKuraStore.getState().surfacePick?.placement;
    if (!placement) return;
    setAxis(placement.axis);
    setOffsetU(placement.offsetU);
    setOffsetV(placement.offsetV);
  }, [pickNonce]);

  // Escape sale del modo de colocación antes que cerrar el panel.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      setSurfacePick(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [picking, setSurfacePick]);

  const handleLoadSvg = async () => {
    const file = await openLocalFile('.svg');
    if (!file) return;
    setSvgContent(new TextDecoder('utf-8').decode(file.buffer));
    setKind('svg');
  };

  const handleExecute = async () => {
    if (!targetId) return;
    clearPreview('project');
    const { result: res } = await failure.run(() => projectOnObjectSurface(targetId, options));
    if (res) onClose();
  };

  return (
    <OperationPanel
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.project.title')}
      footer={
        <>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId || (kind === 'text' ? !text.trim() : !svgContent.trim()) || invalid.blocked}
            onClick={() => void handleExecute()}
          >
            <Type size={14} />
            <span>{t(language, 'dialog.project.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div className="kura-preview-status" data-state={previewStatus}>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          aria-pressed={picking}
          disabled={!targetId || invalid.blocked}
          title={t(language, 'projectPreview.pickTip')}
          onClick={() => setSurfacePick(picking || !targetId ? null : targetId)}
        >
          <Crosshair size={13} aria-hidden="true" />
          <span>{t(language, 'projectPreview.pick')}</span>
        </button>
        <span role="status">
          {picking
            ? surfacePick?.placement
              ? t(language, 'projectPreview.placed', {
                  axis: userDirectionOfInternal(surfacePick.placement.axis).toUpperCase(),
                  u: surfacePick.placement.offsetU,
                  v: surfacePick.placement.offsetV,
                })
              : t(language, 'projectPreview.picking')
            : previewStatus === 'pending'
              ? t(language, 'preview.computing')
              : previewStatus === 'error'
                ? previewError ?? t(language, 'preview.failed')
                : previewStatus === 'ready'
                  ? t(language, 'preview.ready')
                  : ''}
        </span>
      </div>
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
            aria-describedby="proj-axis-hint"
            value={axis}
            onChange={(e) => setAxis(e.target.value as SurfaceProjectionAxis)}
          >
            {/* Valores internos; el rótulo muestra la dirección y la cara en ejes del usuario (Z arriba). */}
            {PROJECTION_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {userDirectionOfInternal(direction).toUpperCase()} ({t(language, `axes.face.${faceOfInternalDirection(direction)}`)})
              </option>
            ))}
            <option value="cylindrical">{t(language, 'dialog.project.axisCyl')}</option>
          </select>
          <span id="proj-axis-hint" className="kura-field-hint">{t(language, 'genUi.proj.faceHint')}</span>
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-width">{t(language, 'dialog.project.width')}</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f1')}
            id="proj-width"
            min={4}
            max={200}
            step={1}
            precision={1}
            defaultValue={18}
            value={widthMm}
            onChange={(v) => { widthEdited.current = true; setWidthMm(v); }}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-depth">{t(language, 'dialog.project.depth')}</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f2')}
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

        <div className="kura-form-field kura-proj-color-field">
          <label>{t(language, 'dialog.project.color')}</label>
          <div className="kura-swatch-row kura-proj-swatches">
            {PRINT_COLOR_PALETTE.slice(0, 6).map((hex) => (
              <button
                key={hex}
                type="button"
                className={`kura-swatch ${colorHex === hex ? 'is-active' : ''}`}
                style={{ backgroundColor: hex }}
                onClick={() => setColorHex(hex)}
                aria-label={hex}
                aria-pressed={colorHex === hex}
                title={hex}
              />
            ))}
            <input
              type="color"
              className="kura-swatch-custom"
              value={colorHex}
              aria-label={t(language, 'dialog.project.color')}
              title={t(language, 'dialog.project.color')}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </div>
        </div>

        <div className="kura-form-field">
          <label htmlFor="proj-u">{t(language, 'dialog.project.offsetU')}</label>
          <PrecisionNumberInput
            strictRange
            onInvalidChange={invalid.track('f3')}
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
            strictRange
            onInvalidChange={invalid.track('f4')}
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
