/**
 * @file src/components/viewport/PaintToolbar.tsx
 * @description Barra contextual de la herramienta Pintar: modo de pincel, radio (mm de mundo, con `[` y `]`) y muestras
 * de filamento con nombre legible, estado pulsado y borde visible en colores claros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eraser } from 'lucide-react';
import { t } from '../../i18n';
import { type PaintBrushMode, useKuraStore } from '../../store/useKuraStore';
import { PRINT_COLOR_PALETTE } from '../../types/kura';
import { colorName, colorNameWithHex } from '../../utils/colorNames';
import { contrastingPaintColor } from '../../utils/paintContrast';
import { PaintRefineHint } from './PaintRefineHint';
import { PAINT_RADIUS_MAX_MM, PAINT_RADIUS_MIN_MM, usePaintRadiusKeys } from './usePaintRadiusKeys';
import '../../styles/paintTools.css';

/** Luminancia relativa aproximada: las muestras claras llevan borde para verse sobre fondos claros. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 186;
}

export const PaintToolbar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const paintColor = useKuraStore((s) => s.paintColor);
  const paintRadiusMm = useKuraStore((s) => s.paintRadiusMm);
  const paintMode = useKuraStore((s) => s.paintMode);
  const setPaintSettings = useKuraStore((s) => s.setPaintSettings);
  // Goma: pintar con el color base del objeto seleccionado devuelve la cara a su aspecto original.
  const targetName = useKuraStore((s) => s.objects.find((o) => o.id === s.selectedIds[0])?.name ?? null);
  const baseColor = useKuraStore((s) => s.objects.find((o) => o.id === s.selectedIds[0])?.color ?? null);
  const [eraser, setEraser] = useState(false);
  // En móvil la barra es una hoja inferior plegable; en escritorio el botón no se muestra.
  const [folded, setFolded] = useState(false);
  const colorBeforeEraser = useRef<string | null>(null);
  usePaintRadiusKeys(paintMode === 'brush');

  useEffect(() => {
    if (eraser && baseColor) setPaintSettings({ paintColor: baseColor });
  }, [eraser, baseColor, setPaintSettings]);

  // Al entrar a Pintar (o cambiar de objeto): si el pincel es igual o casi igual al objeto, el primer trazo no se
  // vería; se pasa al siguiente color de la paleta que contraste.
  useEffect(() => {
    if (eraser || !baseColor) return;
    const current = useKuraStore.getState().paintColor;
    const next = contrastingPaintColor(current, baseColor, PRINT_COLOR_PALETTE);
    if (next !== current) setPaintSettings({ paintColor: next });
    // Solo al entrar o al cambiar el objeto, no al elegir un color a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColor]);

  // Al salir de la herramienta con la goma activa se recupera el color de pincel anterior.
  useEffect(() => () => {
    const previous = colorBeforeEraser.current;
    if (previous) useKuraStore.getState().setPaintSettings({ paintColor: previous });
  }, []);

  const toggleEraser = () => {
    if (eraser) {
      if (colorBeforeEraser.current) setPaintSettings({ paintColor: colorBeforeEraser.current });
      colorBeforeEraser.current = null;
      setEraser(false);
      return;
    }
    colorBeforeEraser.current = paintColor;
    setEraser(true);
  };

  const chooseColor = (hex: string) => {
    colorBeforeEraser.current = null;
    setEraser(false);
    setPaintSettings({ paintColor: hex });
  };

  return (
    <div
      className={`kura-hud-card kura-paint-toolbar ${folded ? 'is-folded' : ''}`}
      data-viewport-occluder
      role="toolbar"
      aria-label={t(language, 'viewport.paint.toolbar')}
    >
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-paint-fold"
        aria-expanded={!folded}
        title={t(language, folded ? 'viewport.paint.expand' : 'viewport.paint.collapse')}
        onClick={() => setFolded((v) => !v)}
      >
        {folded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        <span>{t(language, folded ? 'viewport.paint.expand' : 'viewport.paint.collapse')}</span>
      </button>
      <select
        className="kura-select"
        style={{ height: 26 }}
        value={paintMode}
        onChange={(e) => setPaintSettings({ paintMode: e.target.value as PaintBrushMode })}
        aria-label={t(language, 'viewport.paint.mode')}
        title={t(language, 'viewport.paint.mode')}
      >
        <option value="brush">{t(language, 'viewport.paint.brush')}</option>
        <option value="smart_fill">{t(language, 'viewport.paint.smartFill')}</option>
        <option value="whole">{t(language, 'viewport.paint.whole')}</option>
      </select>

      {paintMode === 'brush' && (
        <label className="kura-paint-radius">
          <span>{t(language, 'viewport.paint.radius')}: {paintRadiusMm} mm</span>
          <input
            type="range"
            min={PAINT_RADIUS_MIN_MM}
            max={PAINT_RADIUS_MAX_MM}
            step={0.5}
            value={paintRadiusMm}
            aria-label={t(language, 'viewport.paint.radius')}
            aria-valuetext={`${paintRadiusMm} mm`}
            aria-keyshortcuts="[ ]"
            title={`${t(language, 'viewport.paint.radiusTip')} — [ / ]: ${t(language, 'dialog.shortcuts.brushSize')}`}
            onChange={(e) => setPaintSettings({ paintRadiusMm: Number(e.target.value) })}
          />
        </label>
      )}

      <div className="kura-swatch-row" role="group" aria-label={t(language, 'viewport.paint.color')}>
        {PRINT_COLOR_PALETTE.map((hex) => {
          const name = colorName(language, hex);
          const active = !eraser && paintColor.toLowerCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              className={`kura-swatch ${active ? 'is-active' : ''} ${isLight(hex) ? 'is-light' : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => chooseColor(hex)}
              aria-label={name}
              aria-pressed={active}
              title={colorNameWithHex(language, hex)}
            />
          );
        })}
        <input
          type="color"
          className="kura-swatch-custom"
          value={paintColor}
          onChange={(e) => chooseColor(e.target.value)}
          aria-label={t(language, 'viewport.paint.customColor')}
          title={t(language, 'viewport.paint.customColor')}
        />
        <button
          type="button"
          className={`kura-btn kura-btn-sm kura-paint-eraser ${eraser ? 'is-active' : ''}`}
          aria-pressed={eraser}
          disabled={!eraser && !baseColor}
          onClick={toggleEraser}
          title={t(language, 'viewport.paint.eraserTip')}
        >
          <Eraser size={13} aria-hidden="true" />
          <span>{t(language, 'viewport.paint.eraser')}</span>
        </button>
      </div>
      <span
        className={`kura-paint-target ${targetName ? '' : 'is-empty'}`}
        role="status"
        title={targetName ?? undefined}
      >
        {targetName
          ? t(language, 'viewport.paint.target', { name: targetName })
          : t(language, 'viewport.paint.noTarget')}
      </span>
      <span className="kura-paint-hint">{t(language, 'viewport.paint.hint')}</span>
      <PaintRefineHint />
    </div>
  );
};
