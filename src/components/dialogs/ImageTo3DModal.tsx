/**
 * @file src/components/dialogs/ImageTo3DModal.tsx
 * @description Diálogo Imagen a 3D: relieve plano, litofanía cilíndrica, silueta y cortador/sello.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationFailureAlert, useOperationFailure } from '../OperationFailureAlert';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { NativeModal } from '../NativeModal';
import { type ImageTo3DOptions } from '../../types/kura';
import { openLocalFile } from '../../utils/platformBridge';

/** Modal 2: Imagen → 3D (Relieve plano, Litofanía Cilíndrica Curva, Silueta 3D y Cortador/Sello). */
export const ImageTo3DModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const generateImageRelief = useKuraStore((s) => s.generateImageRelief);
  const failure = useOperationFailure(open);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [shapeMode, setShapeMode] = useState<NonNullable<ImageTo3DOptions['shapeMode']>>('flat');
  const [name, setName] = useState('Relieve 3D');
  const [widthMm, setWidthMm] = useState(70);
  const [depthMm, setDepthMm] = useState(70);
  const [baseThicknessMm, setBaseThicknessMm] = useState(1.2);
  const [reliefHeightMm, setReliefHeightMm] = useState(3.2);
  const [smoothing, setSmoothing] = useState(1);
  const [invert, setInvert] = useState(false);
  const [cylinderRadiusMm, setCylinderRadiusMm] = useState(42);
  const [arcDegrees, setArcDegrees] = useState(180);
  const [threshold, setThreshold] = useState(128);
  const [cutterWallMm, setCutterWallMm] = useState(1.4);
  const [rgbaBuffer, setRgbaBuffer] = useState<{
    rgba: Uint8ClampedArray;
    w: number;
    h: number;
  } | null>(null);

  const drawSamplePattern = () => {
    const w = 110;
    const h = 110;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.52);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#64748b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KURA', w / 2, h / 2);

    const imgData = ctx.getImageData(0, 0, w, h);
    setRgbaBuffer({ rgba: imgData.data, w, h });
  };

  useEffect(() => {
    if (open && !rgbaBuffer) {
      drawSamplePattern();
    }
  }, [open, rgbaBuffer]);

  useEffect(() => {
    if (!rgbaBuffer || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = rgbaBuffer.w;
    canvasRef.current.height = rgbaBuffer.h;
    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaBuffer.rgba),
      rgbaBuffer.w,
      rgbaBuffer.h,
    );
    ctx.putImageData(imgData, 0, 0);
  }, [rgbaBuffer]);

  const handleUploadImage = async () => {
    const file = await openLocalFile('image/png,image/jpeg,image/webp,image/bmp');
    if (!file) return;

    const blob = new Blob([file.buffer]);
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.src = url;
      });

      const maxDim = 140;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(16, Math.round(img.width * scale));
      const h = Math.max(16, Math.round(img.height * scale));

      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);

      setRgbaBuffer({ rgba: data.data, w, h });
      setName(file.name.replace(/\.[^.]+$/, ''));
      setDepthMm(Math.max(20, Math.round((widthMm * h) / w)));
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleGenerate = async () => {
    if (!rgbaBuffer) return;
    const { result: created } = await failure.run(() => generateImageRelief({
      name,
      rgba: rgbaBuffer.rgba,
      pixelWidth: rgbaBuffer.w,
      pixelHeight: rgbaBuffer.h,
      widthMm,
      depthMm,
      baseThicknessMm,
      reliefHeightMm,
      invert,
      smoothing,
      shapeMode,
      cylinderRadiusMm,
      arcDegrees,
      threshold,
      cutterWallMm,
    }));
    if (created) onClose();
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.img.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!rgbaBuffer}
            onClick={() => void handleGenerate()}
          >
            <Sparkles size={14} />
            <span>{t(language, 'dialog.img.generate')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="kura-btn kura-btn-sm" onClick={() => void handleUploadImage()}>
          <FileUp size={13} />
          <span>{t(language, 'dialog.img.upload')}</span>
        </button>
        <button type="button" className="kura-btn kura-btn-sm" onClick={drawSamplePattern}>
          {t(language, 'dialog.img.useSample')}
        </button>
      </div>

      <div className="kura-form-field">
        <label htmlFor="img-shape-mode">{t(language, 'dialog.img.shapeMode')}</label>
        <select
          id="img-shape-mode"
          className="kura-select"
          value={shapeMode}
          onChange={(e) => {
            const next = e.target.value as NonNullable<ImageTo3DOptions['shapeMode']>;
            setShapeMode(next);
            if (next === 'cylindrical') setInvert(true);
          }}
        >
          <option value="flat">{t(language, 'dialog.img.modeFlat')}</option>
          <option value="cylindrical">{t(language, 'dialog.img.modeCylindrical')}</option>
          <option value="silhouette">{t(language, 'dialog.img.modeSilhouette')}</option>
          <option value="cutter">{t(language, 'dialog.img.modeCutter')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: 110,
            height: 110,
            objectFit: 'contain',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: '#0f172a',
          }}
        />
        <div className="kura-form-grid" style={{ flex: 1 }}>
          <div className="kura-form-field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="img-name">{t(language, 'dialog.img.name')}</label>
            <input
              id="img-name"
              className="kura-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="kura-form-field">
            <label htmlFor="img-w">{t(language, 'dialog.img.width')} (mm)</label>
            <PrecisionNumberInput
              id="img-w"
              value={widthMm}
              min={10}
              max={250}
              step={1}
              precision={1}
              defaultValue={70}
              onChange={setWidthMm}
            />
          </div>
          <div className="kura-form-field">
            <label htmlFor="img-d">{t(language, 'dialog.img.depth')} (mm)</label>
            <PrecisionNumberInput
              id="img-d"
              value={depthMm}
              min={10}
              max={250}
              step={1}
              precision={1}
              defaultValue={70}
              onChange={setDepthMm}
            />
          </div>
        </div>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="img-base">{t(language, 'dialog.img.base')} (mm)</label>
          <PrecisionNumberInput
            id="img-base"
            step={0.2}
            min={0.4}
            max={20}
            precision={1}
            defaultValue={1.2}
            value={baseThicknessMm}
            onChange={setBaseThicknessMm}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="img-relief">{t(language, 'dialog.img.relief')} (mm)</label>
          <PrecisionNumberInput
            id="img-relief"
            step={0.2}
            min={0.4}
            max={30}
            precision={1}
            defaultValue={3.2}
            value={reliefHeightMm}
            onChange={setReliefHeightMm}
          />
        </div>

        {shapeMode === 'cylindrical' && (
          <>
            <div className="kura-form-field">
              <label htmlFor="img-cyl-r">{t(language, 'dialog.img.cylRadius')}</label>
              <PrecisionNumberInput
                id="img-cyl-r"
                min={15}
                max={180}
                step={1}
                precision={1}
                defaultValue={42}
                value={cylinderRadiusMm}
                onChange={setCylinderRadiusMm}
              />
            </div>
            <div className="kura-form-field">
              <label htmlFor="img-arc">{t(language, 'dialog.img.arcDegrees')}</label>
              <PrecisionNumberInput
                id="img-arc"
                min={60}
                max={360}
                step={15}
                precision={0}
                defaultValue={180}
                value={arcDegrees}
                onChange={setArcDegrees}
              />
            </div>
          </>
        )}

        {(shapeMode === 'silhouette' || shapeMode === 'cutter') && (
          <div className="kura-form-field">
            <label htmlFor="img-thresh">{t(language, 'dialog.img.threshold')}</label>
            <PrecisionNumberInput
              id="img-thresh"
              min={10}
              max={245}
              step={5}
              precision={0}
              defaultValue={128}
              value={threshold}
              onChange={(val) => setThreshold(Math.round(val))}
            />
          </div>
        )}

        {shapeMode === 'cutter' && (
          <div className="kura-form-field">
            <label htmlFor="img-cwall">{t(language, 'dialog.img.cutterWall')}</label>
            <PrecisionNumberInput
              id="img-cwall"
              min={0.6}
              max={6}
              step={0.2}
              precision={1}
              defaultValue={1.4}
              value={cutterWallMm}
              onChange={setCutterWallMm}
            />
          </div>
        )}

        <div className="kura-form-field">
          <label htmlFor="img-smooth">{t(language, 'dialog.img.smoothing')} (0–3)</label>
          <PrecisionNumberInput
            id="img-smooth"
            min={0}
            max={3}
            step={1}
            precision={0}
            defaultValue={1}
            value={smoothing}
            onChange={(val) => setSmoothing(Math.round(val))}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.target.checked)}
          />
          <span style={{ fontSize: 12 }}>{t(language, 'dialog.img.invert')}</span>
        </label>
      </div>
    </NativeModal>
  );
};
