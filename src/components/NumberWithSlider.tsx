/**
 * @file src/components/NumberWithSlider.tsx
 * @description Campo numérico de precisión con un deslizador al lado que comparten el mismo valor. Envuelve a
 * `PrecisionNumberInput` sin tocarlo: el campo sigue aceptando expresiones y unidades (`10+5`, `2cm`) y cualquier valor
 * dentro de sus propios límites, mientras el deslizador cubre un rango más acotado (`sliderMin`–`sliderMax`) con paso
 * coherente (`sliderStepFor`). Teclado nativo del `<input type="range">` (flechas, Re Pág / Av Pág, Inicio / Fin),
 * `aria-valuetext` con la unidad y, para deshacer, `onGestureStart`/`onGestureEnd` marcan UN gesto (arrastre o ráfaga
 * de teclas) para que el llamador abra y cierre un único paso de historial. Los campos que no usan este componente no
 * cambian.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useRef } from 'react';
import { t } from '../i18n';
import { formatLocaleNumber } from '../i18n/numberLocale';
import { useKuraStore } from '../store/useKuraStore';
import { PrecisionNumberInput, type PrecisionNumberInputProps } from './PrecisionNumberInput';
import '../styles/numberWithSlider.css';

/**
 * Paso del deslizador según el rango: enteros, el paso del campo; rangos chicos (hasta 20), medio paso (0,5) o el del
 * campo si es más fino; rangos grandes, 1 o el del campo si es mayor.
 */
export function sliderStepFor(min: number, max: number, fieldStep: number, integer = false): number {
  const step = Number.isFinite(fieldStep) && fieldStep > 0 ? fieldStep : 1;
  if (integer) return Math.max(1, Math.round(step));
  return max - min <= 20 ? Math.min(0.5, step) : Math.max(1, step);
}

/** Decimales que necesita un paso (0,05 → 2) para limpiar el ruido binario del valor del deslizador. */
function decimalsOf(step: number): number {
  const text = step.toString();
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

export interface NumberWithSliderProps extends PrecisionNumberInputProps {
  /** Rango del deslizador (por defecto `min`/`max` del campo). Debe quedar definido de una u otra forma. */
  sliderMin?: number;
  sliderMax?: number;
  /** Paso del deslizador; por defecto sale de `sliderStepFor`. */
  sliderStep?: number;
  /** El campo es de enteros (el paso del deslizador es entero). */
  integer?: boolean;
  /** Se abre un gesto del deslizador (puntero abajo o primera tecla de una ráfaga). */
  onGestureStart?: () => void;
  /** Se cierra el gesto (puntero arriba, tecla suelta o foco fuera). */
  onGestureEnd?: () => void;
}

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export const NumberWithSlider: React.FC<NumberWithSliderProps> = ({
  sliderMin,
  sliderMax,
  sliderStep,
  integer = false,
  onGestureStart,
  onGestureEnd,
  ...input
}) => {
  const language = useKuraStore((s) => s.language);
  const lo = sliderMin ?? input.min;
  const hi = sliderMax ?? input.max;
  const gesture = useRef(false);
  const cb = useRef({ onGestureStart, onGestureEnd });
  cb.current = { onGestureStart, onGestureEnd };
  const begin = useCallback(() => {
    if (gesture.current) return;
    gesture.current = true;
    cb.current.onGestureStart?.();
  }, []);
  const end = useCallback(() => {
    if (!gesture.current) return;
    gesture.current = false;
    cb.current.onGestureEnd?.();
  }, []);

  if (typeof lo !== 'number' || typeof hi !== 'number' || !(hi > lo)) return <PrecisionNumberInput {...input} />;

  const step = sliderStep ?? sliderStepFor(lo, hi, input.step ?? 1, integer);
  const decimals = decimalsOf(step);
  const value = Number.isFinite(input.value) ? input.value : lo;
  const shown = Math.min(hi, Math.max(lo, value));
  const pct = ((shown - lo) / (hi - lo)) * 100;
  const label = input.ariaLabel ?? input.prefix ?? '';
  const unitText = input.suffix ? ` ${input.suffix}` : '';
  const valueText = `${formatLocaleNumber(language, value, { maxFrac: Math.max(decimals, input.precision ?? 2) })}${unitText}`;
  const tip = t(language, 'asis.slider.tip', { label });

  return (
    <div className="kura-nws">
      <PrecisionNumberInput {...input} step={input.step ?? step} />
      <input
        type="range"
        className="kura-nws-slider"
        min={lo}
        max={hi}
        step={step}
        value={shown}
        disabled={input.disabled}
        aria-label={label || undefined}
        aria-valuetext={valueText}
        aria-describedby={input.describedBy}
        title={tip}
        style={{ '--nws-pct': `${pct}%` } as React.CSSProperties}
        onPointerDown={begin}
        onPointerUp={end}
        onPointerCancel={end}
        onBlur={end}
        onKeyDown={(e) => {
          if (MOVE_KEYS.has(e.key)) begin();
        }}
        onKeyUp={(e) => {
          if (MOVE_KEYS.has(e.key)) end();
        }}
        onChange={(e) => {
          const next = Number(Number(e.target.value).toFixed(decimals));
          if (Number.isFinite(next) && next !== input.value) input.onChange(next, { shiftKey: false, ctrlKey: false, altKey: false, isScrubbing: true });
        }}
      />
    </div>
  );
};
