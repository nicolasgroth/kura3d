/**
 * @file src/components/paint/PaintControls.tsx
 * @description Opciones de Pintar: modo (pincel, relleno inteligente, pintar todo), radio del pincel (mm de mundo,
 * con `[` y `]`), paleta personalizable, color libre y goma. Las usan el panel derecho y, en pantallas
 * estrechas, la barra del visor. `usePaintToolEffects` (una sola vez, en la barra del visor) aplica los efectos de
 * la herramienta: atajos del radio, color que contraste con el objeto y goma.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { Eraser } from 'lucide-react';
import { t } from '../../i18n';
import { usePaintPalette } from '../../store/paintPalette';
import { type PaintBrushMode, useKuraStore } from '../../store/useKuraStore';
import { contrastingPaintColor } from '../../utils/paintContrast';
import { PAINT_RADIUS_MAX_MM, PAINT_RADIUS_MIN_MM, usePaintRadiusKeys } from '../viewport/usePaintRadiusKeys';
import { choosePaintColor, resetEraserOnExit, toggleEraser, usePaintEraser } from './paintEraser';
import { PaintPalette } from './PaintPalette';
import '../../styles/paintTools.css';

/** Color base del objeto que se pinta (el seleccionado), o `null` sin selección. */
const useTargetBaseColor = () => useKuraStore((s) => s.objects.find((o) => o.id === s.selectedIds[0])?.color ?? null);

/** Efectos de la herramienta Pintar; se montan una vez mientras está activa. */
export function usePaintToolEffects(): void {
  const paintMode = useKuraStore((s) => s.paintMode);
  const setPaintSettings = useKuraStore((s) => s.setPaintSettings);
  const baseColor = useTargetBaseColor();
  const eraser = usePaintEraser((s) => s.eraser);
  usePaintRadiusKeys(paintMode === 'brush');

  // Goma: pintar con el color base del objeto seleccionado devuelve la cara a su aspecto original.
  useEffect(() => {
    if (eraser && baseColor) setPaintSettings({ paintColor: baseColor });
  }, [eraser, baseColor, setPaintSettings]);

  // Al entrar a Pintar (o cambiar de objeto): si el pincel es igual o casi igual al objeto, el primer trazo no se
  // vería; se pasa al siguiente color de la paleta que contraste.
  useEffect(() => {
    if (usePaintEraser.getState().eraser || !baseColor) return;
    const current = useKuraStore.getState().paintColor;
    const next = contrastingPaintColor(current, baseColor, usePaintPalette.getState().colors);
    if (next !== current) setPaintSettings({ paintColor: next });
    // Solo al entrar o al cambiar el objeto, no al elegir un color a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColor]);

  // Al salir de la herramienta con la goma activa se recupera el color de pincel anterior.
  useEffect(() => () => resetEraserOnExit(), []);
}

export const PaintControls: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const paintColor = useKuraStore((s) => s.paintColor);
  const paintRadiusMm = useKuraStore((s) => s.paintRadiusMm);
  const paintMode = useKuraStore((s) => s.paintMode);
  const setPaintSettings = useKuraStore((s) => s.setPaintSettings);
  const baseColor = useTargetBaseColor();
  const eraser = usePaintEraser((s) => s.eraser);

  return (
    <div className="kura-paint-controls">
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

      <PaintPalette />
      <div className="kura-paint-extra">
        <input
          type="color"
          className="kura-swatch-custom"
          value={paintColor}
          onChange={(e) => choosePaintColor(e.target.value)}
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
    </div>
  );
};
