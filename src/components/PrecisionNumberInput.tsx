/**
 * @file src/components/PrecisionNumberInput.tsx
 * @description Control numérico de precisión CAD estilo Blender/Rhino para Kura3D v4.0:
 * - Arrastre horizontal (Drag-Scrub a 60fps) sobre la etiqueta/prefijo con modificadores en vivo.
 * - Teclado: ↑/↓ paso normal, Shift+↑/↓ salto grueso ×10, Alt/Ctrl+↑/↓ micro-precisión ×0.1.
 * - Enter confirma y Escape revierte al valor previo al foco.
 * - Botones compactos ▲/▼ con soporte de Shift (×10) y Alt/Ctrl (×0.1) + rueda del ratón al enfocar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';

export interface PrecisionModifierState {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** True cuando el cambio proviene de un arrastre continuo (drag-scrub a 60fps). */
  isScrubbing?: boolean;
}

export interface PrecisionNumberInputProps {
  id?: string;
  value: number;
  onChange: (nextValue: number, modifiers?: PrecisionModifierState) => void;
  /** Callback al iniciar un arrastre drag-scrub (permite guardar un único snapshot Undo). */
  onScrubStart?: () => void;
  /** Paso base por clic o tecla de flecha (por defecto 1). */
  step?: number;
  min?: number;
  max?: number;
  /** Decimales máximos al formatear el valor en reposo (por defecto 2). */
  precision?: number;
  disabled?: boolean;
  /** Prefijo visual interactivo para drag-scrub (ej. 'X', 'Y', 'Z', 'Ø', 'W'). */
  prefix?: string;
  /** Tono de color CAD para ejes ('x' | 'y' | 'z'). */
  axisTone?: 'x' | 'y' | 'z';
  /** Sufijo compacto opcional dentro de la caja (ej. 'mm', '°', '×'). */
  suffix?: string;
  /** Valor por defecto para restablecer con doble clic sobre el prefijo. */
  defaultValue?: number;
  /** Píxeles horizontales necesarios por cada paso durante el scrub (por defecto 4). */
  scrubPixelsPerStep?: number;
  ariaLabel?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Aplica el texto editado al confirmar con Enter o al salir del campo. */
  commitOnBlur?: boolean;
  /** Callback opcional al confirmar edición o soltar scrub/stepper. */
  onCommit?: (finalValue: number) => void;
}

/** Limita un número al rango [min, max] y elimina ruido binario de punto flotante. */
function clampAndClean(raw: number, min?: number, max?: number, precision = 4): number {
  let next = raw;
  if (typeof min === 'number' && Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (typeof max === 'number' && Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  const factor = Math.pow(10, Math.min(6, Math.max(0, precision + 2)));
  const cleaned = Math.round(next * factor) / factor;
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

/** Formatea el número sin ceros finales innecesarios para lectura rápida CAD. */
function formatDisplayValue(val: number, precision: number): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Number(val.toFixed(precision));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Calcula el multiplicador de precisión según teclas modificadoras activas. */
function getModifierScale(e: {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): number {
  if (e.shiftKey) return 10;
  if (e.altKey || e.ctrlKey || e.metaKey) return 0.1;
  return 1;
}

export const PrecisionNumberInput: React.FC<PrecisionNumberInputProps> = ({
  id,
  value,
  onChange,
  onScrubStart,
  step = 1,
  min,
  max,
  precision = 2,
  disabled = false,
  prefix,
  axisTone,
  suffix,
  defaultValue,
  scrubPixelsPerStep = 4,
  ariaLabel,
  title,
  className,
  style,
  commitOnBlur = false,
  onCommit,
}) => {
  const language = useKuraStore((s) => s.language);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Estado local del texto mientras el usuario escribe manualmente sin perder formato intermedio (ej. "-", "12.")
  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draft, setDraft] = useState<string>(() => formatDisplayValue(value, precision));
  const initialFocusValueRef = useRef<number>(value);
  const draftEditedRef = useRef(false);

  // Referencias para el arrastre horizontal a 60fps sin re-renderizar listeners
  const scrubRef = useRef<{
    active: boolean;
    lastX: number;
    accum: number;
    moved: boolean;
  }>({ active: false, lastX: 0, accum: 0, moved: false });

  // Mantener refs actualizadas para el listener nativo de rueda (no pasivo)
  const latestRef = useRef({ value, step, min, max, precision, disabled, commitOnBlur, onChange });
  latestRef.current = { value, step, min, max, precision, disabled, commitOnBlur, onChange };

  // Sincroniza el texto mostrado cuando el valor cambia externamente (gizmos, Undo/Redo, escala proporcional)
  useEffect(() => {
    if (!isFocused) {
      setDraft(formatDisplayValue(value, precision));
    }
  }, [value, precision, isFocused]);

  /** Aplica un incremento escalado por Shift (×10) o Alt/Ctrl (×0.1). */
  const applyStepDelta = useCallback(
    (direction: 1 | -1, modSource: PrecisionModifierState & { metaKey?: boolean }) => {
      const cur = latestRef.current;
      if (cur.disabled) return;
      const mult = getModifierScale(modSource);
      const delta = direction * cur.step * mult;
      if (cur.commitOnBlur && draftEditedRef.current) {
        setDraft((text) => {
          const normalized = text.trim().replace(',', '.');
          const parsed = Number(normalized);
          const base = normalized && Number.isFinite(parsed) ? parsed : cur.value;
          const next = clampAndClean(base + delta, cur.min, cur.max, cur.precision);
          return formatDisplayValue(next, cur.precision);
        });
        return;
      }
      const next = clampAndClean(cur.value + delta, cur.min, cur.max, cur.precision);
      setDraft(formatDisplayValue(next, cur.precision));
      cur.onChange(next, {
        shiftKey: modSource.shiftKey,
        ctrlKey: modSource.ctrlKey,
        altKey: modSource.altKey,
      });
    },
    [],
  );

  // Listener nativo no-pasivo de rueda para evitar scroll del inspector mientras el input tiene foco
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement !== el || latestRef.current.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const dir: 1 | -1 = e.deltaY < 0 ? 1 : -1;
      applyStepDelta(dir, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [applyStepDelta]);

  /** Confirma el borrador numérico si es válido, o revierte al valor actual. */
  const commitDraft = useCallback(
    (modifiers?: PrecisionModifierState) => {
      if (commitOnBlur && (!draftEditedRef.current || disabled)) return;
      draftEditedRef.current = false;
      const normalized = draft.trim().replace(',', '.');
      const parsed = Number(normalized);
      if (normalized !== '' && Number.isFinite(parsed)) {
        const clamped = clampAndClean(parsed, min, max, precision);
        setDraft(formatDisplayValue(clamped, precision));
        if (clamped !== value) {
          onChange(clamped, modifiers);
        }
        onCommit?.(clamped);
      } else {
        setDraft(formatDisplayValue(value, precision));
      }
    },
    [commitOnBlur, disabled, draft, min, max, precision, value, onChange, onCommit],
  );

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    initialFocusValueRef.current = value;
    draftEditedRef.current = false;
    setDraft(formatDisplayValue(value, precision));
    e.currentTarget.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitDraft();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir: 1 | -1 = e.key === 'ArrowUp' ? 1 : -1;
      applyStepDelta(dir, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft({
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
        altKey: e.altKey,
      });
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (commitOnBlur) {
        draftEditedRef.current = false;
        inputRef.current?.blur();
        return;
      }
      const prev = clampAndClean(initialFocusValueRef.current, min, max, precision);
      setDraft(formatDisplayValue(prev, precision));
      if (prev !== value) {
        onChange(prev);
      }
      inputRef.current?.blur();
    }
  };

  const handlePrefixPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubRef.current = {
      active: true,
      lastX: e.clientX,
      accum: value,
      moved: false,
    };
    onScrubStart?.();
    setIsScrubbing(true);
  };

  const handlePrefixPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrubRef.current.active || disabled) return;
    const dx = e.clientX - scrubRef.current.lastX;
    if (dx === 0) return;
    scrubRef.current.lastX = e.clientX;
    if (Math.abs(dx) >= 1) {
      scrubRef.current.moved = true;
    }

    const mult = getModifierScale(e);
    const deltaVal = (dx / Math.max(1, scrubPixelsPerStep)) * step * mult;
    const rawNext = scrubRef.current.accum + deltaVal;
    const clamped = clampAndClean(rawNext, min, max, precision);
    scrubRef.current.accum =
      typeof min === 'number' && rawNext < min
        ? min
        : typeof max === 'number' && rawNext > max
          ? max
          : rawNext;

    draftEditedRef.current = false;
    setDraft(formatDisplayValue(clamped, precision));
    onChange(clamped, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      altKey: e.altKey,
      isScrubbing: true,
    });
  };

  const handlePrefixPointerEnd = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrubRef.current.active) return;
    scrubRef.current.active = false;
    setIsScrubbing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (scrubRef.current.moved) {
      onCommit?.(value);
    }
  };

  const handlePrefixDoubleClick = () => {
    if (disabled || defaultValue === undefined) return;
    const clamped = clampAndClean(defaultValue, min, max, precision);
    draftEditedRef.current = false;
    setDraft(formatDisplayValue(clamped, precision));
    onChange(clamped);
    onCommit?.(clamped);
  };

  const stepBtnClick = (dir: 1 | -1, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    applyStepDelta(dir, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });
  };

  const scrubTitle =
    title ??
    (prefix
      ? t(language, 'precision.scrubTip')
      : undefined);

  return (
    <div
      className={`kura-precision-input ${isScrubbing ? 'is-scrubbing' : ''} ${
        disabled ? 'is-disabled' : ''
      } ${className ?? ''}`}
      style={style}
      title={scrubTitle}
    >
      {prefix && (
        <span
          className={`kura-precision-prefix ${axisTone ? `axis-${axisTone}` : ''}`}
          onPointerDown={handlePrefixPointerDown}
          onPointerMove={handlePrefixPointerMove}
          onPointerUp={handlePrefixPointerEnd}
          onPointerCancel={handlePrefixPointerEnd}
          onDoubleClick={handlePrefixDoubleClick}
          title={scrubTitle}
        >
          {prefix}
        </span>
      )}

      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        className="kura-precision-field"
        disabled={disabled}
        data-commit-on-blur={commitOnBlur || undefined}
        value={isFocused ? draft : formatDisplayValue(value, precision)}
        aria-label={ariaLabel ?? prefix}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          const val = e.target.value;
          setDraft(val);
          if (commitOnBlur) {
            draftEditedRef.current = true;
            return;
          }
          // Permitir actualización en vivo mientras se escribe un número válido completo
          const normalized = val.trim().replace(',', '.');
          if (
            normalized !== '' &&
            normalized !== '-' &&
            !normalized.endsWith('.') &&
            Number.isFinite(Number(normalized))
          ) {
            const next = clampAndClean(Number(normalized), min, max, precision);
            onChange(next);
          }
        }}
      />

      {suffix && <span className="kura-precision-suffix">{suffix}</span>}

      <div className="kura-precision-steppers">
        <button
          type="button"
          tabIndex={-1}
          className="kura-precision-step-btn"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => stepBtnClick(1, e)}
          aria-label={t(language, 'precision.stepUp')}
          title={`${t(language, 'precision.stepUp')} (Shift ×10 · Alt ×0.1)`}
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="kura-precision-step-btn"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => stepBtnClick(-1, e)}
          aria-label={t(language, 'precision.stepDown')}
          title={`${t(language, 'precision.stepDown')} (Shift ×10 · Alt ×0.1)`}
        >
          ▼
        </button>
      </div>
    </div>
  );
};
