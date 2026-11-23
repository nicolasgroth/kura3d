/**
 * @file src/components/inspector/RelativeTransformFields.tsx
 * @description Campos X/Y/Z para aplicar un desplazamiento relativo en el inspector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useState } from 'react';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { type Vec3 } from '../../types/kura';
import { AXES } from './inspectorConstants';
import { useInvalidFields } from '../useInvalidFields';

export function RelativeTransformFields({
  label,
  applyLabel,
  step,
  precision,
  disabled,
  limit,
  onApply,
}: {
  label: string;
  applyLabel: string;
  step: number;
  precision: number;
  disabled: boolean;
  /** Máximo valor absoluto de cada Δ; fuera de él el campo se marca y no se aplica. */
  limit: number;
  onApply: (delta: Vec3) => void;
}) {
  const [delta, setDelta] = useState<Vec3>([0, 0, 0]);
  const invalid = useInvalidFields();

  return (
    <>
      <div className="kura-vec3-grid">
        {AXES.map((axis, index) => (
          <PrecisionNumberInput
            key={axis}
            prefix={`Δ${axis.toUpperCase()}`}
            axisTone={axis}
            step={step}
            precision={precision}
            min={-limit}
            max={limit}
            strictRange
            onInvalidChange={invalid.track(axis)}
            defaultValue={0}
            disabled={disabled}
            value={delta[index]}
            onChange={(value) => setDelta((previous) => {
              const next: Vec3 = [...previous];
              next[index] = value;
              return next;
            })}
            ariaLabel={`${label} Δ${axis.toUpperCase()}`}
          />
        ))}
      </div>
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-precision-apply"
        disabled={disabled || invalid.blocked || delta.every((value) => value === 0)}
        onClick={() => {
          onApply(delta);
          setDelta([0, 0, 0]);
        }}
      >
        {applyLabel}
      </button>
    </>
  );
}
