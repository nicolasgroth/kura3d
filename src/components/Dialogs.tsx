/**
 * @file src/components/Dialogs.tsx
 * @description Modales nativos <dialog> de Kura3D abiertos con showModal() y soporte
 * de light-dismiss (`closedby="any"` + fallback pointer para WebKit/Safari):
 * Importar SVG, Imagen→3D Relieve/Litofanía, Corte por Plano con Conectores, y Ajustes/MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  FileUp,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { t } from '../i18n';
import { type ActiveDialogType, useKuraStore } from '../store/useKuraStore';
import type {
  AiProviderType,
  ColorSchemePreference,
  CutConnectorType,
  PlaneCutOptions,
} from '../types/kura';
import { attachDialogDismissHandlers, closeDialogWithMotion } from '../utils/dialogMotion';
import { openLocalFile } from '../utils/platformBridge';

/** Presets SVG vectoriales incorporados para probar extrusión 3D al instante. */
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

/**
 * Wrapper reutilizable sobre <dialog> nativo con showModal(), `closedby="any"`
 * y fallback pointerdown/pointerup para navegadores sin `HTMLDialogElement.prototype.closedBy`.
 */
const NativeModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ open, onClose, title, children, footer, className }) => {
  const language = useKuraStore((s) => s.language);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      void closeDialogWithMotion(dialog);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    const detachDismiss = attachDialogDismissHandlers(dialog);

    return () => {
      dialog.removeEventListener('close', handleClose);
      detachDismiss();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={className ? `kura-dialog ${className}` : 'kura-dialog'}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="kura-dialog-header">
        <h2 id={titleId} className="kura-dialog-title">
          {title}
        </h2>
        <button
          type="button"
          className="kura-mini-icon-btn"
          onClick={() => dialogRef.current && void closeDialogWithMotion(dialogRef.current)}
          aria-label={t(language, 'common.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div className="kura-dialog-body">{children}</div>

      {footer && <div className="kura-dialog-footer">{footer}</div>}
    </dialog>
  );
};

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
          <input
            id="svg-depth"
            type="number"
            className="kura-input"
            min={0.5}
            max={150}
            step={0.5}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="svg-width">{t(language, 'dialog.svg.width')} (mm)</label>
          <input
            id="svg-width"
            type="number"
            className="kura-input"
            min={5}
            max={350}
            step={1}
            value={targetWidth}
            onChange={(e) => setTargetWidth(Number(e.target.value))}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="svg-seg">{t(language, 'dialog.svg.segments')}</label>
          <input
            id="svg-seg"
            type="number"
            className="kura-input"
            min={4}
            max={48}
            step={1}
            value={curveSegments}
            onChange={(e) => setCurveSegments(Number(e.target.value))}
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

/** Modal 2: Imagen → Relieve 3D / Litofanía. */
const ImageTo3DModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const generateImageRelief = useKuraStore((s) => s.generateImageRelief);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [name, setName] = useState('Relieve 3D');
  const [widthMm, setWidthMm] = useState(70);
  const [depthMm, setDepthMm] = useState(70);
  const [baseThicknessMm, setBaseThicknessMm] = useState(1.2);
  const [reliefHeightMm, setReliefHeightMm] = useState(3.2);
  const [smoothing, setSmoothing] = useState(1);
  const [invert, setInvert] = useState(false);
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
    const created = await generateImageRelief({
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
    });
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="kura-btn kura-btn-sm" onClick={() => void handleUploadImage()}>
          <FileUp size={13} />
          <span>{t(language, 'dialog.img.upload')}</span>
        </button>
        <button type="button" className="kura-btn kura-btn-sm" onClick={drawSamplePattern}>
          {t(language, 'dialog.img.useSample')}
        </button>
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
            <input
              id="img-w"
              type="number"
              className="kura-input"
              value={widthMm}
              min={10}
              max={250}
              onChange={(e) => setWidthMm(Number(e.target.value))}
            />
          </div>
          <div className="kura-form-field">
            <label htmlFor="img-d">{t(language, 'dialog.img.depth')} (mm)</label>
            <input
              id="img-d"
              type="number"
              className="kura-input"
              value={depthMm}
              min={10}
              max={250}
              onChange={(e) => setDepthMm(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="kura-form-grid">
        <div className="kura-form-field">
          <label htmlFor="img-base">{t(language, 'dialog.img.base')} (mm)</label>
          <input
            id="img-base"
            type="number"
            className="kura-input"
            step={0.2}
            min={0.4}
            max={20}
            value={baseThicknessMm}
            onChange={(e) => setBaseThicknessMm(Number(e.target.value))}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="img-relief">{t(language, 'dialog.img.relief')} (mm)</label>
          <input
            id="img-relief"
            type="number"
            className="kura-input"
            step={0.2}
            min={0.4}
            max={30}
            value={reliefHeightMm}
            onChange={(e) => setReliefHeightMm(Number(e.target.value))}
          />
        </div>
        <div className="kura-form-field">
          <label htmlFor="img-smooth">{t(language, 'dialog.img.smoothing')} (0–3)</label>
          <input
            id="img-smooth"
            type="number"
            className="kura-input"
            min={0}
            max={3}
            step={1}
            value={smoothing}
            onChange={(e) => setSmoothing(Number(e.target.value))}
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
    await planeCutObject(targetId, {
      axis,
      offset,
      connectorType,
      connectorSize,
      connectorDepth,
      tolerance,
      connectorCount,
      keepMode,
    });
    onClose();
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
          <input
            id="cut-size"
            type="number"
            className="kura-input"
            min={1.5}
            max={20}
            step={0.5}
            value={connectorSize}
            onChange={(e) => setConnectorSize(Number(e.target.value))}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-depth">{t(language, 'dialog.cut.connectorDepth')} (mm)</label>
          <input
            id="cut-depth"
            type="number"
            className="kura-input"
            min={2}
            max={25}
            step={0.5}
            value={connectorDepth}
            onChange={(e) => setConnectorDepth(Number(e.target.value))}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-tol">{t(language, 'dialog.cut.tolerance')} (mm)</label>
          <input
            id="cut-tol"
            type="number"
            className="kura-input"
            min={0.05}
            max={1.0}
            step={0.05}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
          />
        </div>

        <div className="kura-form-field">
          <label htmlFor="cut-count">{t(language, 'dialog.cut.connectorCount')} (1–4)</label>
          <input
            id="cut-count"
            type="number"
            className="kura-input"
            min={1}
            max={4}
            step={1}
            value={connectorCount}
            onChange={(e) => setConnectorCount(Number(e.target.value))}
          />
        </div>
      </div>
    </NativeModal>
  );
};

/** Modal 4: Ajustes globales (IA, Esquema de Color tri-estado, MCP y Acerca de). */
const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const language = useKuraStore((s) => s.language);
  const aiConfig = useKuraStore((s) => s.aiConfig);
  const setAiConfig = useKuraStore((s) => s.setAiConfig);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const setColorScheme = useKuraStore((s) => s.setColorScheme);
  const mcpConnected = useKuraStore((s) => s.mcpConnected);
  const mcpConfig = useKuraStore((s) => s.mcpConfig);
  const setMcpConfig = useKuraStore((s) => s.setMcpConfig);
  const regenerateMcpToken = useKuraStore((s) => s.regenerateMcpToken);
  const tab = useKuraStore((s) => s.settingsTab);
  const setTab = useKuraStore((s) => s.setSettingsTab);
  const addToast = useKuraStore((s) => s.addToast);

  const [provider, setProvider] = useState<AiProviderType>(aiConfig.provider);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [model, setModel] = useState(aiConfig.model);
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [temperature, setTemperature] = useState(aiConfig.temperature);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setProvider(aiConfig.provider);
      setApiKey(aiConfig.apiKey);
      setModel(aiConfig.model);
      setBaseUrl(aiConfig.baseUrl);
      setTemperature(aiConfig.temperature);
    }
  }, [open, aiConfig]);

  const defaultModels: Record<AiProviderType, string> = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-latest',
    ollama: 'llama3.1',
  };

  const handleProviderChange = (next: AiProviderType) => {
    setProvider(next);
    setModel(defaultModels[next]);
    if (next === 'ollama' && !baseUrl) {
      setBaseUrl('http://127.0.0.1:11434');
    }
  };

  const handleSaveAi = () => {
    setAiConfig({ provider, apiKey, model, baseUrl, temperature });
    addToast(t(language, 'toast.settingsSaved'), 'success');
    onClose();
  };

  const mcpEnv: Record<string, string> = {
    KURA_BRIDGE_PORT: String(mcpConfig.port),
  };
  if (mcpConfig.requireAuth && mcpConfig.authToken) {
    mcpEnv.KURA_BRIDGE_TOKEN = mcpConfig.authToken;
  }
  if (mcpConfig.readOnly) {
    mcpEnv.KURA_BRIDGE_READ_ONLY = '1';
  }

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

  const isExternalConfigured = provider !== 'ollama' && apiKey.trim().length > 0;
  const providerDisplay =
    provider === 'gemini'
      ? 'Google Gemini'
      : provider === 'openai'
        ? 'OpenAI'
        : provider === 'anthropic'
          ? 'Anthropic Claude'
          : 'Ollama';

  const handleCopyMcp = async () => {
    try {
      await navigator.clipboard.writeText(mcpSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar si portapapeles está bloqueado
    }
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.settings.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.close')}
          </button>
          {tab === 'ai' && (
            <button type="button" className="kura-btn kura-btn-primary" onClick={handleSaveAi}>
              {t(language, 'dialog.settings.saveAi')}
            </button>
          )}
        </>
      }
    >
      <div className="kura-segmented" style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button
          type="button"
          className={`kura-btn ${tab === 'ai' ? 'is-active' : ''}`}
          onClick={() => setTab('ai')}
        >
          {t(language, 'dialog.settings.tab.ai')}
        </button>
        <button
          type="button"
          className={`kura-btn ${tab === 'mcp' ? 'is-active' : ''}`}
          onClick={() => setTab('mcp')}
        >
          {t(language, 'dialog.settings.tab.mcp')}
        </button>
        <button
          type="button"
          className={`kura-btn ${tab === 'about' ? 'is-active' : ''}`}
          onClick={() => setTab('about')}
        >
          {t(language, 'dialog.settings.tab.about')}
        </button>
      </div>

      {tab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="kura-form-field">
            <label htmlFor="settings-scheme">{t(language, 'topbar.themeToggle')}</label>
            <select
              id="settings-scheme"
              className="kura-select"
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as ColorSchemePreference)}
            >
              <option value="system">{t(language, 'topbar.theme.system')}</option>
              <option value="dark">{t(language, 'topbar.theme.dark')}</option>
              <option value="light">{t(language, 'topbar.theme.light')}</option>
            </select>
          </div>

          <div className="kura-form-field">
            <label htmlFor="ai-provider">{t(language, 'dialog.settings.aiProvider')}</label>
            <select
              id="ai-provider"
              className="kura-select"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProviderType)}
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI / Compatible</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>

          {provider !== 'ollama' && (
            <div className="kura-form-field">
              <label htmlFor="ai-key">{t(language, 'dialog.settings.apiKey')}</label>
              <input
                id="ai-key"
                type="password"
                className="kura-input"
                placeholder={t(language, 'dialog.settings.apiKeyPlaceholder')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          <div className="kura-form-grid">
            <div className="kura-form-field">
              <label htmlFor="ai-model">{t(language, 'dialog.settings.model')}</label>
              <input
                id="ai-model"
                className="kura-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div className="kura-form-field">
              <label htmlFor="ai-temp">
                {t(language, 'dialog.settings.temperature')} ({temperature})
              </label>
              <input
                id="ai-temp"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="kura-form-field">
            <label htmlFor="ai-url">{t(language, 'dialog.settings.baseUrl')}</label>
            <input
              id="ai-url"
              className="kura-input"
              placeholder={provider === 'ollama' ? 'http://127.0.0.1:11434' : 'Opcional'}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div
            className={`kura-callout ${isExternalConfigured ? 'is-warning' : 'is-local'}`}
          >
            {isExternalConfigured ? <Cloud size={15} /> : <ShieldCheck size={15} />}
            <span>
              {isExternalConfigured
                ? t(language, 'dialog.settings.aiPrivacyExternal', {
                    provider: providerDisplay,
                  })
                : t(language, 'dialog.settings.aiPrivacyLocal')}
            </span>
          </div>
        </div>
      )}

      {tab === 'mcp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpRequireAuth')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.requireAuth}
                onChange={(e) => setMcpConfig({ requireAuth: e.target.checked })}
              />
            </label>

            {mcpConfig.requireAuth && (
              <div className="kura-form-field">
                <label htmlFor="mcp-token">{t(language, 'dialog.settings.mcpToken')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    id="mcp-token"
                    className="kura-input"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    value={mcpConfig.authToken}
                    onChange={(e) => setMcpConfig({ authToken: e.target.value })}
                  />
                  <button
                    type="button"
                    className="kura-btn kura-btn-sm"
                    onClick={regenerateMcpToken}
                    title={t(language, 'dialog.settings.mcpRegenerate')}
                  >
                    <RefreshCw size={13} />
                    <span>{t(language, 'dialog.settings.mcpRegenerate')}</span>
                  </button>
                </div>
              </div>
            )}

            <label className="kura-switch-row">
              <span>{t(language, 'dialog.settings.mcpReadOnly')}</span>
              <input
                type="checkbox"
                checked={mcpConfig.readOnly}
                onChange={(e) => setMcpConfig({ readOnly: e.target.checked })}
              />
            </label>
          </div>

          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'dialog.settings.mcpStatus')}</span>
            <span
              className={`kura-pill ${
                !mcpConfig.enabled ? 'is-off' : mcpConnected ? 'is-online' : ''
              }`}
            >
              <span className="kura-dot" />
              <span>
                {!mcpConfig.enabled
                  ? t(language, 'topbar.mcpOff')
                  : mcpConnected
                    ? t(language, 'topbar.mcpConnected')
                    : t(language, 'topbar.mcpLocal')}
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
            {mcpSnippet}
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
        <div className="kura-card">
          <strong>Kura3D Studio v1.0.0</strong>
          <p style={{ margin: 0, fontSize: 12 }}>{t(language, 'dialog.settings.aboutAuthor')}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            {t(language, 'dialog.settings.aboutStack')}
          </p>
        </div>
      )}
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
      <SettingsModal
        open={activeDialog === 'settings'}
        onClose={() => closeDialog('settings')}
      />
    </>
  );
};
