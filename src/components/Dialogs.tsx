/**
 * @file src/components/Dialogs.tsx
 * @description Modales nativos <dialog> de Kura3D v0.5.0 abiertos con showModal() y soporte
 * de light-dismiss (`closedby="any"` + fallback pointer para WebKit/Safari):
 * Importar SVG, Imagen→3D (Plana, Cilíndrica, Silueta y Cortador), Corte por Plano,
 * Generador de Moldes/Silicona, Proyección Conformal en Superficies, Roscas Métricas ISO,
 * Exportación (ExportDialog), Ajustes (Apariencia con Temas WCAG en vivo, IA, MCP, Acerca de)
 * y Guía de Atajos CAD.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Bolt,
  Check,
  Copy,
  FileUp,
  Keyboard,
  Monitor,
  Moon,
  PaintBucket,
  Palette,
  RefreshCw,
  Scissors,
  Sparkles,
  Sun,
  Type,
} from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { type ActiveDialogType, generateRandomTokenHex, useKuraStore } from '../store/useKuraStore';
import { rotateMcpBridgeToken, useMcpBridgeStatus } from '../utils/mcpBridgeClient';
import { describeMcpBridge } from '../utils/mcpBridgeHealth';
import { maskToken } from '../utils/mcpTokenStore';
import { OperationFailureAlert, useOperationFailure } from './OperationFailureAlert';
import { CONNECTOR_DEPTH_RANGE_MM, CONNECTOR_SIZE_RANGE_MM } from '../engine/cutConnectorChecks';
import { PrecisionNumberInput } from './PrecisionNumberInput';
import { ExportDialog } from './ExportDialog';
import { NativeModal } from './NativeModal';
import {
  PRINT_COLOR_PALETTE,
  THEME_PRESETS,
  type ColorSchemePreference,
  type CutConnectorType,
  type ImageTo3DOptions,
  type MoldMode,
  type PlaneCutOptions,
  type SurfaceProjectionAxis,
  type SurfaceProjectionMode,
  type ThreadOptions,
} from '../types/kura';
import { isTauriRuntime, openLocalFile } from '../utils/platformBridge';
import { AiSettingsPanel } from './settings/AiSettingsPanel';
import { McpTokenField } from './settings/McpTokenField';
import { SettingsTabs } from './settings/SettingsTabs';
import { ISO_COARSE_THREADS, isoCoarsePitch } from '../engine/threads';

/** Presets SVG vectoriales incorporados para probar extrusión y proyección 3D al instante. */
const SVG_PRESETS: Record<'star' | 'badge' | 'gear', string> = {
  star: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,6 63,36 96,38 71,60 79,92 50,74 21,92 29,60 4,38 37,36" fill="#38bdf8"/>
</svg>`,
  badge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 6 L90 28 L90 72 L50 94 L10 72 L10 28 Z M50 26 L70 38 L70 62 L50 74 L30 62 L30 38 Z" fill="#38bdf8" fill-rule="evenodd"/>
</svg>`,
  gear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M44 6 H56 L58 18 A34 34 0 0 1 68 22 L78 14 L86 22 L78 32 A34 34 0 0 1 82 42 L94 44 V56 L82 58 A34 34 0 0 1 78 68 L86 78 L78 86 L68 78 A34 34 0 0 1 58 82 L56 94 H44 L42 82 A34 34 0 0 1 32 78 L22 86 L14 78 L22 68 A34 34 0 0 1 18 58 L6 56 V44 L18 42 A34 34 0 0 1 22 32 L14 22 L22 14 L32 22 A34 34 0 0 1 42 18 Z M50 34 A16 16 0 1 0 50 66 A16 16 0 1 0 50 34 Z" fill="#f97316" fill-rule="evenodd"/>
</svg>`,
};

/** Presets métricos ISO estándar (diámetro mm y paso grueso estándar en mm). */
const ISO_THREAD_PRESETS: Array<{ label: string; diameterMm: number; pitchMm: number }> =
  ISO_COARSE_THREADS.filter(
    (row) => row.diameterMm >= 3 && row.diameterMm <= 20 && Number.isInteger(row.diameterMm) && row.diameterMm !== 7,
  ).map((row) => ({ label: `M${row.diameterMm}`, ...row }));

/** Modal 1: Importar y Extruir SVG a sólido 3D. */
const SvgImportModal: React.FC<{ open: boolean; onClose: () => void }> = ({
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

/** Modal 2: Imagen → 3D (Relieve plano, Litofanía Cilíndrica Curva, Silueta 3D y Cortador/Sello). */
const ImageTo3DModal: React.FC<{ open: boolean; onClose: () => void }> = ({
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

/** Modal 3: Corte por Plano con Conectores para impresión 3D. */
const PlaneCutModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const planeCutObject = useKuraStore((s) => s.planeCutObject);
  const setCutPreview = useKuraStore((s) => s.setCutPreview);

  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('y');
  const [offset, setOffset] = useState(0);
  const [connectorType, setConnectorType] = useState<CutConnectorType>('dowel');
  const [connectorSize, setConnectorSize] = useState(4);
  const [connectorDepth, setConnectorDepth] = useState(6);
  const [tolerance, setTolerance] = useState(0.25);
  const [connectorCount, setConnectorCount] = useState(2);
  const [keepMode, setKeepMode] = useState<PlaneCutOptions['keepMode']>('both');
  const failure = useOperationFailure(open);

  const targetId = selectedIds[0] ?? objects[0]?.id;

  // Sincroniza en tiempo real el plano láser y los conectores fantasma 3D en el viewport
  useEffect(() => {
    if (!open || !targetId) {
      setCutPreview({ active: false, objectId: null });
      return;
    }
    setCutPreview({
      active: true,
      objectId: targetId,
      axis,
      offset,
      connectorType,
      connectorSize,
      connectorDepth,
      connectorCount,
    });
  }, [
    open,
    targetId,
    axis,
    offset,
    connectorType,
    connectorSize,
    connectorDepth,
    connectorCount,
    setCutPreview,
  ]);

  useEffect(() => {
    return () => {
      setCutPreview({ active: false, objectId: null });
    };
  }, [setCutPreview]);

  const handleExecute = async () => {
    if (!targetId) return;
    const { failed } = await failure.run(() =>
      planeCutObject(targetId, {
        axis,
        offset,
        connectorType,
        connectorSize,
        connectorDepth,
        tolerance,
        connectorCount,
        keepMode,
      }),
    );
    if (!failed) onClose();
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.cut.title')}
      className="kura-dialog-side"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId}
            onClick={() => void handleExecute()}
          >
            <Scissors size={14} />
            <span>{t(language, 'dialog.cut.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="cut-axis">{t(language, 'dialog.cut.axis')}</label>
          <select
            id="cut-axis"
            className="kura-select"
            value={axis}
            onChange={(e) => setAxis(e.target.value as 'x' | 'y' | 'z')}
          >
            <option value="y">Y (Horizontal)</option>
            <option value="x">X (Lateral)</option>
            <option value="z">Z (Frontal)</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-offset">{t(language, 'dialog.cut.offset')} ({offset} mm)</label>
          <input
            id="cut-offset"
            type="range"
            min={-50}
            max={50}
            step={1}
            value={offset}
            title={t(language, 'ui.sliderResetTip')}
            onDoubleClick={() => setOffset(0)}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-conn">{t(language, 'dialog.cut.connectorType')}</label>
          <select
            id="cut-conn"
            className="kura-select"
            value={connectorType}
            onChange={(e) => setConnectorType(e.target.value as CutConnectorType)}
          >
            <option value="none">{t(language, 'dialog.cut.connector.none')}</option>
            <option value="dowel">{t(language, 'dialog.cut.connector.dowel')}</option>
            <option value="peg">{t(language, 'dialog.cut.connector.peg')}</option>
            <option value="dovetail">{t(language, 'dialog.cut.connector.dovetail')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-keep">{t(language, 'dialog.cut.keepMode')}</label>
          <select
            id="cut-keep"
            className="kura-select"
            value={keepMode}
            onChange={(e) => setKeepMode(e.target.value as PlaneCutOptions['keepMode'])}
          >
            <option value="both">{t(language, 'dialog.cut.keepBoth')}</option>
            <option value="positive">{t(language, 'dialog.cut.keepPositive')}</option>
            <option value="negative">{t(language, 'dialog.cut.keepNegative')}</option>
          </select>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-size">{t(language, 'dialog.cut.connectorSize')} (mm)</label>
          <PrecisionNumberInput
            id="cut-size"
            min={CONNECTOR_SIZE_RANGE_MM.min}
            max={CONNECTOR_SIZE_RANGE_MM.max}
            step={0.5}
            precision={1}
            defaultValue={4}
            value={connectorSize}
            onChange={setConnectorSize}
          />
          <small id="cut-size-max" style={{ fontSize: 11, opacity: 0.8 }}>
            {t(language, 'dialog.cut.maxAllowed', { max: CONNECTOR_SIZE_RANGE_MM.max })}
          </small>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-depth">{t(language, 'dialog.cut.connectorDepth')} (mm)</label>
          <PrecisionNumberInput
            id="cut-depth"
            min={CONNECTOR_DEPTH_RANGE_MM.min}
            max={CONNECTOR_DEPTH_RANGE_MM.max}
            step={0.5}
            precision={1}
            defaultValue={6}
            value={connectorDepth}
            onChange={setConnectorDepth}
          />
          <small id="cut-depth-max" style={{ fontSize: 11, opacity: 0.8 }}>
            {t(language, 'dialog.cut.maxAllowed', { max: CONNECTOR_DEPTH_RANGE_MM.max })}
          </small>
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-tol">{t(language, 'dialog.cut.tolerance')} (mm)</label>
          <PrecisionNumberInput
            id="cut-tol"
            min={0.05}
            max={1.0}
            step={0.05}
            precision={2}
            defaultValue={0.25}
            value={tolerance}
            onChange={setTolerance}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-count">{t(language, 'dialog.cut.connectorCount')} (1–4)</label>
          <PrecisionNumberInput
            id="cut-count"
            min={1}
            max={4}
            step={1}
            precision={0}
            defaultValue={2}
            value={connectorCount}
            onChange={(val) => setConnectorCount(Math.round(val))}
          />
        </div>
      </div>
    </NativeModal>
  );
};

/** Modal 4: Generador Automático de Moldes y Contra-Moldes (Velas, Silicona, Resina). */
const MoldModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const generateMoldForObject = useKuraStore((s) => s.generateMoldForObject);

  const [mode, setMode] = useState<MoldMode>('silicone_master');
  const [wallMarginMm, setWallMarginMm] = useState(6);
  const [boxWallMm, setBoxWallMm] = useState(3);
  const [splitAxis, setSplitAxis] = useState<'x' | 'z'>('x');
  const [pourSpout, setPourSpout] = useState(true);
  const [pourSpoutRadiusMm, setPourSpoutRadiusMm] = useState(5);
  const [keyToleranceMm, setKeyToleranceMm] = useState(0.25);
  const [cavityWallMm, setCavityWallMm] = useState(3);
  const failure = useOperationFailure(open);

  const targetId = selectedIds[0] ?? objects[0]?.id;

  const handleExecute = async () => {
    if (!targetId) return;
    const { result: created } = await failure.run(() =>
      generateMoldForObject(targetId, {
        mode,
        wallMarginMm,
        boxWallMm,
        splitAxis,
        pourSpout,
        pourSpoutRadiusMm,
        keyToleranceMm,
        cavityWallMm,
      }),
    );
    if (created.length > 0) onClose();
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.mold.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-primary"
            disabled={!targetId}
            onClick={() => void handleExecute()}
          >
            <PaintBucket size={14} />
            <span>{t(language, 'dialog.mold.execute')}</span>
          </button>
        </>
      }
    >
      <OperationFailureAlert message={failure.error} />
      <div className="kura-form-field">
        <label htmlFor="mold-mode">{t(language, 'dialog.mold.mode')}</label>
        <select
          id="mold-mode"
          className="kura-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as MoldMode)}
        >
          <option value="direct_1part">{t(language, 'dialog.mold.modeDirect1')}</option>
          <option value="direct_2part">{t(language, 'dialog.mold.modeDirect2')}</option>
          <option value="silicone_master">{t(language, 'dialog.mold.modeSilicone')}</option>
          <option value="core_cavity">{t(language, 'dialog.mold.modeCoreCavity')}</option>
        </select>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="mold-margin">{t(language, 'dialog.mold.wallMargin')}</label>
          <PrecisionNumberInput
            id="mold-margin"
            min={2}
            max={35}
            step={0.5}
            precision={1}
            defaultValue={6}
            value={wallMarginMm}
            onChange={setWallMarginMm}
          />
        </div>

        {mode === 'silicone_master' && (
          <div className="kura-form-field">
            <label htmlFor="mold-boxwall">{t(language, 'dialog.mold.boxWall')}</label>
            <PrecisionNumberInput
              id="mold-boxwall"
              min={1.2}
              max={15}
              step={0.4}
              precision={1}
              defaultValue={3}
              value={boxWallMm}
              onChange={setBoxWallMm}
            />
          </div>
        )}

        {(mode === 'direct_2part' || mode === 'silicone_master') && (
          <>
            <div className="kura-form-field">
              <label htmlFor="mold-split">{t(language, 'dialog.mold.splitAxis')}</label>
              <select
                id="mold-split"
                className="kura-select"
                value={splitAxis}
                onChange={(e) => setSplitAxis(e.target.value as 'x' | 'z')}
              >
                <option value="x">X (Izq / Der)</option>
                <option value="z">Z (Frente / Atrás)</option>
              </select>
            </div>
            <div className="kura-form-field">
              <label htmlFor="mold-tol">{t(language, 'dialog.mold.keyTolerance')}</label>
              <PrecisionNumberInput
                id="mold-tol"
                min={0.05}
                max={1.0}
                step={0.05}
                precision={2}
                defaultValue={0.25}
                value={keyToleranceMm}
                onChange={setKeyToleranceMm}
              />
            </div>
          </>
        )}

        {mode === 'core_cavity' && (
          <div className="kura-form-field">
            <label htmlFor="mold-cavwall">{t(language, 'dialog.mold.cavityWall')}</label>
            <PrecisionNumberInput
              id="mold-cavwall"
              min={1.0}
              max={20}
              step={0.5}
              precision={1}
              defaultValue={3}
              value={cavityWallMm}
              onChange={setCavityWallMm}
            />
          </div>
        )}
      </div>

      <div className="kura-form-grid" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={pourSpout}
            onChange={(e) => setPourSpout(e.target.checked)}
          />
          <span>{t(language, 'dialog.mold.pourSpout')}</span>
        </label>

        {pourSpout && (
          <div className="kura-form-field">
            <label htmlFor="mold-spout-r">{t(language, 'dialog.mold.pourSpoutRadius')}</label>
            <PrecisionNumberInput
              id="mold-spout-r"
              min={2}
              max={20}
              step={0.5}
              precision={1}
              defaultValue={5}
              value={pourSpoutRadiusMm}
              onChange={setPourSpoutRadiusMm}
            />
          </div>
        )}
      </div>
    </NativeModal>
  );
};

/** Modal 5: Proyección Conformal de Texto o SVG sobre cualquier superficie 3D. */
const SurfaceProjectModal: React.FC<{ open: boolean; onClose: () => void }> = ({
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
    <NativeModal
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
    </NativeModal>
  );
};

/** Modal 6: Generador Paramétrico de Roscas Métricas ISO (M3–M20). */
const ThreadModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const createThreadObject = useKuraStore((s) => s.createThreadObject);

  const [kind, setKind] = useState<ThreadOptions['kind']>('bolt');
  const [diameterMm, setDiameterMm] = useState(8);
  const [pitchMm, setPitchMm] = useState(1.25);
  const [lengthMm, setLengthMm] = useState(20);
  const [clearanceMm, setClearanceMm] = useState(0.25);
  const [includeHead, setIncludeHead] = useState(true);
  const failure = useOperationFailure(open);

  const handleExecute = async () => {
    const { result: created } = await failure.run(() =>
      createThreadObject({
        kind,
        diameterMm,
        pitchMm,
        lengthMm,
        clearanceMm,
        includeHead: kind === 'bolt' ? includeHead : false,
      }),
    );
    if (created) onClose();
  };

  return (
    <NativeModal
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
                setPitchMm(preset.pitchMm);
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
            min={2}
            max={64}
            step={0.5}
            precision={1}
            defaultValue={8}
            value={diameterMm}
            onChange={(value) => {
              // Paso ISO 261 grueso automático al cambiar el diámetro (editable después)
              setDiameterMm(value);
              setPitchMm(isoCoarsePitch(value));
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
            onChange={setPitchMm}
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
            defaultValue={0.25}
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
    </NativeModal>
  );
};

/** Resuelve si la interfaz se renderiza actualmente en esquema oscuro (para tarjetas de tema). */
function useResolvedDarkScheme(scheme: ColorSchemePreference): boolean {
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return scheme === 'dark' || (scheme === 'system' && systemDark);
}

/** Modal 8: Ajustes globales (Apariencia/Temas WCAG, IA, MCP y Acerca de). */
const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const themePreset = useKuraStore((s) => s.themePreset);
  const previewThemePreset = useKuraStore((s) => s.previewThemePreset);
  const setThemePreset = useKuraStore((s) => s.setThemePreset);
  const setPreviewThemePreset = useKuraStore((s) => s.setPreviewThemePreset);
  const mcpConnected = useKuraStore((s) => s.mcpConnected);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const setMcpConfig = useKuraStore((s) => s.setMcpConfig);
  const bridgeStatus = useMcpBridgeStatus();
  const tab = useKuraStore((s) => s.settingsTab);
  const setTab = useKuraStore((s) => s.setSettingsTab);
  const addToast = useKuraStore((s) => s.addToast);

  const isRenderedDark = useResolvedDarkScheme(colorScheme);

  const [copied, setCopied] = useState(false);

  // Garantiza que cualquier vista previa en vivo se revierta al cerrar o desmontar el modal
  useEffect(() => {
    if (!open) {
      setPreviewThemePreset(null);
    }
  }, [open, setPreviewThemePreset]);

  useEffect(() => {
    return () => {
      setPreviewThemePreset(null);
    };
  }, [setPreviewThemePreset]);

  const handleClose = () => {
    setPreviewThemePreset(null);
    onClose();
  };

  // Rotación efectiva: el servidor revoca el token viejo antes de guardar el nuevo en Ajustes.
  const handleRegenerateToken = async () => {
    const nextToken = generateRandomTokenHex(32);
    const result = await rotateMcpBridgeToken(nextToken);
    if (result === 'failed') {
      addToast(t(language, 'toast.mcpTokenRotateFailed'), 'error');
      return;
    }
    setMcpConfig({ authToken: nextToken });
    if (result === 'rotated') {
      addToast(t(language, 'toast.mcpTokenRotated'), 'success');
    } else if (result === 'rotated_volatile') {
      addToast(t(language, 'toast.mcpTokenRotatedVolatile'), 'info');
    } else {
      addToast(t(language, 'toast.mcpTokenOffline'), 'info');
    }
  };

  // Token escrito a mano: si hay sesión, el servidor lo adopta (rotación); si no, solo se guarda.
  const handleApplyToken = async (nextToken: string) => {
    const result = await rotateMcpBridgeToken(nextToken);
    if (result === 'failed') {
      addToast(t(language, 'toast.mcpTokenRotateFailed'), 'error');
      return;
    }
    setMcpConfig({ authToken: nextToken });
  };

  const mcpEnv: Record<string, string> = {
    KURA_BRIDGE_PORT: String(mcpConfig.port),
    KURA_BRIDGE_TOKEN: mcpConfig.authToken,
  };
  if (mcpConfig.readOnly) {
    mcpEnv.KURA_BRIDGE_READ_ONLY = 'true';
  }

  const bridgeView = describeMcpBridge(language, mcpConfig.enabled, bridgeStatus);
  const bridgePhaseLabel = bridgeView.label;

  const mcpSnippet = JSON.stringify(
    {
      mcpServers: {
        kura3d: {
          command: 'node',
          args: ['mcp-server/dist/index.js'],
          env: mcpEnv,
        },
      },
    },
    null,
    2,
  );

  const handleCopyMcp = async () => {
    try {
      await navigator.clipboard.writeText(mcpSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar si portapapeles está bloqueado
    }
  };

  const schemeOptions: Array<{
    value: ColorSchemePreference;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: 'system', label: t(language, 'topbar.theme.system'), icon: <Monitor size={13} /> },
    { value: 'dark', label: t(language, 'topbar.theme.dark'), icon: <Moon size={13} /> },
    { value: 'light', label: t(language, 'topbar.theme.light'), icon: <Sun size={13} /> },
  ];

  return (
    <NativeModal
      open={open}
      onClose={handleClose}
      title={t(language, 'dialog.settings.title')}
      className="kura-dialog-settings"
      footer={
        <>
          <button type="button" className="kura-btn" onClick={handleClose}>
            {t(language, 'dialog.close')}
          </button>
        </>
      }
    >
      <SettingsTabs
        tab={tab}
        onChange={setTab}
        label={t(language, 'dialog.settings.tabsLabel')}
        tabs={[
          { id: 'appearance', label: t(language, 'dialog.settings.tab.appearance'), icon: <Palette size={13} /> },
          { id: 'ai', label: t(language, 'dialog.settings.tab.ai') },
          { id: 'mcp', label: t(language, 'dialog.settings.tab.mcp') },
          { id: 'about', label: t(language, 'dialog.settings.tab.about') },
        ]}
      />

      {tab === 'appearance' && (
        <div className="kura-appearance-panel" role="tabpanel" id="settings-panel-appearance" aria-labelledby="settings-tab-appearance">
          <div className="kura-form-field">
            <label htmlFor="settings-scheme-group">{t(language, 'topbar.themeToggle')}</label>
            <div
              id="settings-scheme-group"
              className="kura-segmented"
              role="group"
              aria-label={t(language, 'topbar.themeToggle')}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}
            >
              {schemeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`kura-btn ${colorScheme === opt.value ? 'is-active' : ''}`}
                  aria-pressed={colorScheme === opt.value}
                  onClick={() => setColorScheme(opt.value)}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="kura-themes-header">
            <div>
              <h3 className="kura-themes-title">{t(language, 'dialog.settings.themesTitle')}</h3>
              <p className="kura-themes-hint">{t(language, 'dialog.settings.themesHint')}</p>
            </div>
            {previewThemePreset && (
              <span className="kura-theme-preview-pill">
                {t(language, 'dialog.settings.themePreviewBadge')}
              </span>
            )}
          </div>

          <div className="kura-theme-grid">
            {THEME_PRESETS.map((preset) => {
              const colors = isRenderedDark ? preset.previewDark : preset.previewLight;
              const isActive = themePreset === preset.id;
              const isPreviewing = previewThemePreset === preset.id;
              const name = t(language, `theme.${preset.id}.name` as TranslationKey);
              const desc = t(language, `theme.${preset.id}.desc` as TranslationKey);

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`kura-theme-card ${isActive ? 'is-active' : ''} ${
                    isPreviewing ? 'is-previewing' : ''
                  }`}
                  aria-pressed={isActive}
                  onMouseEnter={() => setPreviewThemePreset(preset.id)}
                  onMouseLeave={() => setPreviewThemePreset(null)}
                  onFocus={() => setPreviewThemePreset(preset.id)}
                  onBlur={() => setPreviewThemePreset(null)}
                  onClick={() => setThemePreset(preset.id)}
                >
                  {/* Maqueta en miniatura del estudio Kura3D pintada con la paleta exacta del tema */}
                  <div
                    className="kura-theme-mockup"
                    aria-hidden="true"
                    style={{
                      backgroundColor: colors.canvas,
                      borderColor: colors.border,
                    }}
                  >
                    <div
                      className="kura-theme-mockup-topbar"
                      style={{
                        backgroundColor: colors.panel,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <span className="kura-theme-mockup-dots">
                        <i style={{ backgroundColor: colors.secondary }} />
                        <i style={{ backgroundColor: colors.accent }} />
                        <i style={{ backgroundColor: colors.border }} />
                      </span>
                      <span
                        className="kura-theme-mockup-pill"
                        style={{ backgroundColor: colors.accent }}
                      />
                    </div>

                    <div className="kura-theme-mockup-body">
                      <div
                        className="kura-theme-mockup-sidebar"
                        style={{
                          backgroundColor: colors.panel,
                          borderRightColor: colors.border,
                        }}
                      >
                        <span style={{ backgroundColor: colors.border }} />
                        <span style={{ backgroundColor: colors.accent }} />
                        <span style={{ backgroundColor: colors.border }} />
                      </div>

                      <div className="kura-theme-mockup-viewport">
                        <svg
                          viewBox="0 0 40 36"
                          width="34"
                          height="30"
                          className="kura-theme-mockup-cube"
                        >
                          <polygon
                            points="20,4 34,11 20,18 6,11"
                            fill={colors.accent}
                            fillOpacity="0.88"
                            stroke={colors.text}
                            strokeOpacity="0.35"
                            strokeWidth="1"
                          />
                          <polygon
                            points="6,11 20,18 20,32 6,25"
                            fill={colors.panel}
                            stroke={colors.accent}
                            strokeWidth="1.2"
                          />
                          <polygon
                            points="34,11 20,18 20,32 34,25"
                            fill={colors.secondary}
                            fillOpacity="0.85"
                            stroke={colors.text}
                            strokeOpacity="0.35"
                            strokeWidth="1"
                          />
                        </svg>
                      </div>

                      <div
                        className="kura-theme-mockup-inspector"
                        style={{
                          backgroundColor: colors.panel,
                          borderLeftColor: colors.border,
                        }}
                      >
                        <span style={{ backgroundColor: colors.text, opacity: 0.45 }} />
                        <span style={{ backgroundColor: colors.border }} />
                        <span
                          className="kura-theme-mockup-cta"
                          style={{ backgroundColor: colors.secondary }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="kura-theme-card-meta">
                    <div className="kura-theme-card-head">
                      <span className="kura-theme-card-name">{name}</span>
                      <span
                        className={`kura-wcag-badge ${
                          preset.wcagLevel === 'AAA' ? 'is-aaa' : 'is-aa'
                        }`}
                      >
                        WCAG {preset.wcagLevel}
                      </span>
                    </div>

                    <p className="kura-theme-card-desc">{desc}</p>

                    <div className="kura-theme-card-badges">
                      {isActive ? (
                        <span className="kura-theme-status-badge is-active">
                          <Check size={11} />
                          <span>{t(language, 'dialog.settings.themeActiveBadge')}</span>
                        </span>
                      ) : preset.id === 'obsidian' ? (
                        <span className="kura-theme-status-badge">
                          {t(language, 'dialog.settings.themeDefaultBadge')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div role="tabpanel" id="settings-panel-ai" aria-labelledby="settings-tab-ai">
          <AiSettingsPanel open={open} onSaved={handleClose} />
        </div>
      )}

      {tab === 'mcp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="tabpanel" id="settings-panel-mcp" aria-labelledby="settings-tab-mcp">
          <strong style={{ fontSize: 13 }}>{t(language, 'dialog.settings.mcpTitle')}</strong>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(language, 'dialog.settings.mcpDesc')}
          </p>

          <div className="kura-card" style={{ gap: 10 }}>
            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpEnable')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.enabled}
                onChange={(e) => setMcpConfig({ enabled: e.target.checked })}
              />
            </label>

            <div className="kura-field-row">
              <label className="kura-field-label" htmlFor="mcp-port">
                {t(language, 'dialog.settings.mcpPort')}
              </label>
              <input
                id="mcp-port"
                type="number"
                className="kura-input"
                style={{ width: 96 }}
                min={1024}
                max={65535}
                value={mcpConfig.port}
                onChange={(e) => setMcpConfig({ port: Number(e.target.value) })}
              />
            </div>

            <McpTokenField
              language={language}
              token={mcpConfig.authToken}
              desktop={isTauriRuntime()}
              rotating={bridgeStatus.phase === 'rotating'}
              onApply={(token) => void handleApplyToken(token)}
              onRegenerate={() => void handleRegenerateToken()}
            />

            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpReadOnly')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.readOnly || (mcpConnected && bridgeStatus.serverReadOnly)}
                disabled={mcpConnected && bridgeStatus.serverReadOnly}
                onChange={(e) => setMcpConfig({ readOnly: e.target.checked })}
              />
            </label>
            {mcpConnected && bridgeStatus.serverReadOnly && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {t(language, 'dialog.settings.mcpServerReadOnly')}
              </span>
            )}
          </div>

          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'dialog.settings.mcpStatus')}</span>
            <span
              className={`kura-pill is-${bridgeView.tone}`}
            >
              <span className="kura-dot" />
              <span role="status" aria-live="polite">
                {bridgePhaseLabel}
              </span>
            </span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
              overflowX: 'auto',
            }}
          >
            {mcpConfig.authToken ? mcpSnippet.replace(mcpConfig.authToken, maskToken(mcpConfig.authToken)) : mcpSnippet}
          </pre>
          <button type="button" className="kura-btn kura-btn-sm" onClick={() => void handleCopyMcp()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copied
                ? t(language, 'dialog.settings.mcpCopied')
                : t(language, 'dialog.settings.mcpCopy')}
            </span>
          </button>
        </div>
      )}

      {tab === 'about' && (
        <div className="kura-about-stack" role="tabpanel" id="settings-panel-about" aria-labelledby="settings-tab-about">
          <div className="kura-card">
            <div className="kura-about-header">
              <strong>Kura3D Studio v0.5.0</strong>
              <span className="kura-brand-badge">v0.5.0</span>
            </div>
            <p style={{ margin: 0, fontSize: 12 }}>{t(language, 'dialog.settings.aboutAuthor')}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(language, 'dialog.settings.aboutStack')}
            </p>
          </div>

          <div className="kura-card">
            <span className="kura-section-label" style={{ margin: 0 }}>
              {t(language, 'dialog.settings.brandVariants')}
            </span>
            <div className="kura-brand-showcase">
              <div className="kura-brand-variant-card">
                <img
                  src="/branding/kura3d-lockup.png"
                  alt="Kura3D Official Lockup"
                  className="kura-brand-lockup-img"
                />
              </div>
              <div className="kura-brand-variant-card is-mono">
                <img
                  src="/branding/kura3d-mono.png"
                  alt="Kura3D Monochrome Emblem"
                  className="kura-brand-mono-img"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </NativeModal>
  );
};

/** Modal 9: Hoja de referencia rápida de Atajos de Teclado Pro y Consejos CAD. */
const ShortcutsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);

  const sections: Array<{
    title: string;
    items: Array<{ keys: string[]; label: string }>;
  }> = [
    {
      title: t(language, 'dialog.shortcuts.secTransform'),
      items: [
        { keys: ['M'], label: t(language, 'precision.moveInspectorHelp') },
        { keys: ['G', 'W'], label: t(language, 'dialog.shortcuts.moveGizmo') },
        { keys: ['R'], label: t(language, 'dialog.shortcuts.rotateGizmo') },
        { keys: ['S'], label: t(language, 'dialog.shortcuts.scaleGizmo') },
        { keys: ['V'], label: t(language, 'dialog.shortcuts.selectTool') },
        { keys: ['Shift'], label: t(language, 'dialog.shortcuts.shiftScale') },
        { keys: ['Ctrl'], label: t(language, 'dialog.shortcuts.ctrlSnap') },
        { keys: ['Alt', 'Drag'], label: t(language, 'dialog.shortcuts.altClone') },
        { keys: ['↑', '↓', '←', '→'], label: t(language, 'dialog.shortcuts.nudgeXY') },
        { keys: ['PgUp', 'PgDn'], label: t(language, 'dialog.shortcuts.nudgeHeight') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secPrecision'),
      items: [
        { keys: ['X/Y/Z', '↔'], label: t(language, 'dialog.shortcuts.scrubDrag') },
        { keys: ['↑', '↓', 'Wheel'], label: t(language, 'dialog.shortcuts.arrowStep') },
        { keys: ['Shift', '↑/↓'], label: t(language, 'dialog.shortcuts.shiftStep') },
        { keys: ['Alt/Ctrl', '↑/↓'], label: t(language, 'dialog.shortcuts.altStep') },
        { keys: ['2× Clic'], label: t(language, 'dialog.shortcuts.sliderReset') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secCamera'),
      items: [
        { keys: ['1', '2', '3', '7'], label: t(language, 'dialog.shortcuts.camPresets') },
        { keys: ['F'], label: t(language, 'dialog.shortcuts.camFit') },
        { keys: ['Ctrl/⌘+Shift+Enter'], label: t(language, 'dialog.shortcuts.zenMode') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secCad'),
      items: [
        { keys: ['Ctrl+G'], label: t(language, 'dialog.shortcuts.smartGroup') },
        { keys: ['Ctrl+Shift+G'], label: t(language, 'dialog.shortcuts.splitIslands') },
        { keys: ['Shift+M'], label: t(language, 'dialog.shortcuts.openMold') },
        { keys: ['X'], label: t(language, 'dialog.shortcuts.toggleXray') },
        { keys: ['P'], label: t(language, 'dialog.shortcuts.togglePaint') },
        { keys: ['C'], label: t(language, 'dialog.shortcuts.openCut') },
        { keys: ['L'], label: t(language, 'dialog.shortcuts.dropBed') },
        { keys: ['H'], label: t(language, 'dialog.shortcuts.toggleHole') },
      ],
    },
    {
      title: t(language, 'dialog.shortcuts.secPalette'),
      items: [
        { keys: ['Ctrl+K'], label: t(language, 'dialog.shortcuts.cmdPalette') },
        { keys: ['Ctrl+Z / Y'], label: t(language, 'dialog.shortcuts.undoRedo') },
        { keys: ['Ctrl/Shift+D'], label: t(language, 'dialog.shortcuts.duplicate') },
        { keys: ['Del'], label: t(language, 'dialog.shortcuts.delete') },
        { keys: ['?', 'F1'], label: t(language, 'dialog.shortcuts.help') },
      ],
    },
  ];

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.shortcuts.title')}
      className="kura-dialog-wide"
      footer={
        <button type="button" className="kura-btn kura-btn-primary" onClick={onClose}>
          <Keyboard size={14} />
          <span>{t(language, 'dialog.close')}</span>
        </button>
      }
    >
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
        {t(language, 'dialog.shortcuts.subtitle')}
      </p>

      <div className="kura-shortcuts-grid">
        {sections.map((sec) => (
          <section key={sec.title} className="kura-card kura-shortcut-card">
            <h3 className="kura-section-label">{sec.title}</h3>
            <div className="kura-shortcut-list">
              {sec.items.map((item) => (
                <div key={item.label} className="kura-shortcut-row">
                  <span className="kura-shortcut-desc">{item.label}</span>
                  <span className="kura-shortcut-keys">
                    {item.keys.map((k) => (
                      <kbd key={k} className="kura-kbd">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </NativeModal>
  );
};

export const Dialogs: React.FC = () => {
  const activeDialog = useKuraStore((s) => s.activeDialog);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  const closeDialog = (target: ActiveDialogType) => {
    if (useKuraStore.getState().activeDialog === target) {
      setActiveDialog(null);
    }
  };

  return (
    <>
      <SvgImportModal open={activeDialog === 'svg'} onClose={() => closeDialog('svg')} />
      <ImageTo3DModal open={activeDialog === 'image'} onClose={() => closeDialog('image')} />
      <PlaneCutModal open={activeDialog === 'cut'} onClose={() => closeDialog('cut')} />
      <MoldModal open={activeDialog === 'mold'} onClose={() => closeDialog('mold')} />
      <SurfaceProjectModal
        open={activeDialog === 'project'}
        onClose={() => closeDialog('project')}
      />
      <ThreadModal open={activeDialog === 'thread'} onClose={() => closeDialog('thread')} />
      <ExportDialog
        open={activeDialog === 'export' || activeDialog === 'export3mf'}
        initialFormat={activeDialog === 'export3mf' ? '3mf' : undefined}
        onClose={() => {
          closeDialog('export');
          closeDialog('export3mf');
        }}
      />
      <SettingsModal
        open={activeDialog === 'settings'}
        onClose={() => closeDialog('settings')}
      />
      <ShortcutsModal
        open={activeDialog === 'shortcuts'}
        onClose={() => closeDialog('shortcuts')}
      />
    </>
  );
};
