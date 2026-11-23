/**
 * @file src/components/inspector/EdgeParamsGroup.tsx
 * @description Grupo «Bordes» de los parámetros de Caja, Cilindro, Tubo y Prisma: acabado (Rectos /
 * Redondeados / Achaflanados), tamaño en mm y aristas afectadas (Todas / Solo verticales / Solo
 * superior, las que admite cada primitiva). Cada cambio regenera por el mismo `commit` de los demás
 * parámetros (Command Bus, un paso de deshacer). Si el tamaño no cabe en las medidas, una nota dice
 * cuánto se aplicó.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { DEFAULT_EDGE_SIZE_MM, defaultEdgeScope, maxEdgeSize, resolveEdges } from '../../engine/primitiveEdges';
import { EDGE_SCOPES_BY_TYPE, EDGE_STYLES, PRIMITIVE_PARAM_RANGES } from '../../engine/primitiveLimits';
import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import type { PrimitiveParams, PrimitiveType, UnitSystem } from '../../types/kura';
import { ParamNumber } from './ParamNumber';

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** Selector segmentado accesible (radios con botones), como la alineación del texto. */
const Segmented: React.FC<{
  label: string; options: readonly string[]; value: string; disabled: boolean;
  labelOf: (opt: string) => string; tipOf?: (opt: string) => string; onPick: (opt: string) => void; testId: string;
}> = ({ label, options, value, disabled, labelOf, tipOf, onPick, testId }) => (
  <div className="kura-field-row kura-param-select-row" data-testid={testId}>
    <span className="kura-field-label">{label}</span>
    <div className="kura-param-segmented" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={value === opt}
          className={`kura-param-seg${value === opt ? ' is-active' : ''}`}
          title={tipOf?.(opt) ?? labelOf(opt)}
          disabled={disabled}
          onClick={() => onPick(opt)}
        >
          {value === opt ? '✓ ' : ''}{labelOf(opt)}
        </button>
      ))}
    </div>
  </div>
);

export const EdgeParamsGroup: React.FC<{
  type: PrimitiveType;
  params: PrimitiveParams;
  unit: UnitSystem;
  disabled: boolean;
  onCommit: (key: 'edgeStyle' | 'edgeSize' | 'edgeScope', value: number | string) => void;
}> = ({ type, params, unit, disabled, onCommit }) => {
  const language = useKuraStore((s) => s.language);
  const style = params.edgeStyle ?? 'sharp';
  const scopes = EDGE_SCOPES_BY_TYPE[type] ?? [];
  const scope = params.edgeScope ?? defaultEdgeScope(type);
  const size = params.edgeSize ?? DEFAULT_EDGE_SIZE_MM;
  const resolved = safe(() => resolveEdges(type, params), null);
  const max = safe(() => maxEdgeSize(type, params), 0);
  const fmt = (n: number) => formatLocaleNumber(language, n, { maxFrac: 2 });
  // El tope se muestra truncado a centésimas: redondeado diría «10 mm» cuando cabe 9,995.
  const down = (n: number) => Math.floor(n * 100 + 1e-9) / 100;
  const title = t(language, 'inspector.params.edges.title');
  const sizeLabel = t(language, style === 'chamfer' ? 'inspector.params.edges.sizeChamfer' : 'inspector.params.edges.sizeRound');

  return (
    <fieldset className="kura-param-edges" aria-label={title} data-testid="params-edges">
      <legend className="kura-section-label">{title}</legend>
      <Segmented
        testId="params-edges-style"
        label={t(language, 'inspector.params.edges.style')}
        options={EDGE_STYLES}
        value={style}
        disabled={disabled}
        labelOf={(o) => t(language, `inspector.params.edges.style.${o}` as TranslationKey)}
        onPick={(o) => onCommit('edgeStyle', o)}
      />
      {style !== 'sharp' && (
        <>
          <ParamNumber
            label={sizeLabel}
            value={size}
            min={PRIMITIVE_PARAM_RANGES.edgeSize.min}
            max={PRIMITIVE_PARAM_RANGES.edgeSize.max}
            displayMax={down(max)}
            isCount={false}
            unit={unit}
            disabled={disabled}
            onCommit={(v) => onCommit('edgeSize', v)}
          />
          {resolved?.clamped && (
            <p className="kura-param-note" role="status" data-testid="params-edges-clamped">
              {t(language, 'inspector.params.edges.clamped', { size: fmt(down(resolved.size)), requested: fmt(resolved.requested) })}
            </p>
          )}
          {scopes.length > 1 && (
            <Segmented
              testId="params-edges-scope"
              label={t(language, 'inspector.params.edges.scope')}
              options={scopes}
              value={scope}
              disabled={disabled}
              labelOf={(o) => t(language, `inspector.params.edges.scope.${o}` as TranslationKey)}
              tipOf={(o) => t(language, `inspector.params.edges.scopeTip.${o}` as TranslationKey)}
              onPick={(o) => onCommit('edgeScope', o)}
            />
          )}
        </>
      )}
    </fieldset>
  );
};
