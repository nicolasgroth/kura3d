/**
 * @file src/components/inspector/ParamNumber.tsx
 * @description Campo numérico de la sección "Parámetros" del inspector, con borrador local: lo
 * escrito solo regenera al confirmar (Enter o salir) y un valor fuera de rango se marca sin aplicarse.
 * Flechas, rueda y botones ▲▼ aplican el valor al terminar la ráfaga, en un solo paso de deshacer.
 * Los límites quedan visibles junto a la etiqueta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import type { UnitSystem } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';

/** Pausa tras la última flecha o paso antes de aplicar la ráfaga como un solo paso de deshacer. */
const STEP_BURST_MS = 450;

export const ParamNumber: React.FC<{
  label: string; value: number; min: number; max: number; isCount: boolean;
  unit: UnitSystem | null;
  disabled: boolean; onCommit: (v: number) => void;
  /** Máximo que se muestra junto a la etiqueta si el útil es menor que el aceptado (p. ej. el tope del borde). */
  displayMax?: number;
}> = ({ label, value, min, max, isCount, unit, disabled, onCommit, displayMax }) => {
  const language = useKuraStore((s) => s.language);
  const [draft, setDraft] = useState(value);
  const burstRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => {
    if (burstRef.current) clearTimeout(burstRef.current);
  }, []);
  const precision = isCount ? 0 : 2;
  const fmt = (n: number) => formatLocaleNumber(language, n, { maxFrac: precision });
  const suffix = isCount ? '' : ' mm';
  const shownMax = displayMax ?? max;
  const rangeText = `${fmt(min)}–${fmt(shownMax)}${suffix}`;
  const rangeTip = t(language, 'precision.rangeTip', { min: fmt(min), max: `${fmt(shownMax)}${suffix}` });

  const stepped = (next: number) => {
    setDraft(next);
    if (burstRef.current) clearTimeout(burstRef.current);
    burstRef.current = setTimeout(() => {
      burstRef.current = null;
      commitRef.current(next);
    }, STEP_BURST_MS);
  };
  const committed = (next: number) => {
    if (burstRef.current) {
      clearTimeout(burstRef.current);
      burstRef.current = null;
    }
    onCommit(next);
  };

  return (
    <div className="kura-field-row kura-param-row">
      <span className="kura-field-label">
        {label}
        <span className="kura-param-range" title={rangeTip}>{rangeText}</span>
      </span>
      <PrecisionNumberInput
        style={{ width: 104 }}
        value={draft}
        min={min}
        max={max}
        step={isCount ? 1 : 0.5}
        precision={precision}
        suffix={isCount ? undefined : 'mm'}
        unit={unit}
        disabled={disabled}
        commitOnBlur
        strictRange
        ariaLabel={label}
        title={rangeTip}
        onChange={stepped}
        onCommit={committed}
      />
    </div>
  );
};
