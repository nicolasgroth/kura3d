/**
 * @file src/components/inspector/ColorSplitControl.tsx
 * @description Botón "Separar por colores" con su profundidad del color (mm): cada color pintado sale
 * como sólido cerrado que llega esa profundidad hacia adentro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { t } from '../../i18n';
import { OPERATION_DEFAULTS, OPERATION_RANGES } from '../../engine/operationLimits';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { PrecisionNumberInput } from '../PrecisionNumberInput';
import { useInvalidFields } from '../useInvalidFields';

const RANGE = OPERATION_RANGES.colorSplit.depthMm;
const DEFAULT_DEPTH = OPERATION_DEFAULTS.colorSplit.depthMm;

export const ColorSplitControl: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  // Campos fuera de rango o no numéricos: se marcan y la operación no se aplica (nada se acota en silencio).
  const invalid = useInvalidFields();
  const isBusy = useKuraStore((s) => Boolean(s.busyOperation));
  const splitObjectByColor = useKuraStore((s) => s.splitObjectByColor);
  const [depthMm, setDepthMm] = useState<number>(DEFAULT_DEPTH);

  return (
    <>
      <div className="kura-field-row" title={t(language, 'inspector.op.colorDepthTip')}>
        <span className="kura-field-label">{t(language, 'inspector.op.colorDepth')}</span>
        <PrecisionNumberInput
          strictRange
          onInvalidChange={invalid.track('f1')}
          style={{ width: 92 }}
          min={RANGE.min}
          max={10}
          step={0.2}
          precision={1}
          defaultValue={DEFAULT_DEPTH}
          suffix="mm"
          value={depthMm}
          onChange={setDepthMm}
          ariaLabel={t(language, 'inspector.op.colorDepth')}
        />
      </div>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={isBusy || primary.locked || invalid.blocked}
        title={t(language, 'inspector.op.colorDepthTip')}
        onClick={() => void splitObjectByColor(primary.id, { depthMm })}
      >
        <Palette size={13} />
        <span>{t(language, 'inspector.op.splitColors')}</span>
      </button>
    </>
  );
};
