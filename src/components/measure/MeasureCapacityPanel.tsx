/**
 * @file src/components/measure/MeasureCapacityPanel.tsx
 * @description Modo Capacidad de la herramienta Medir: calcula cuánto cabe en el objeto seleccionado
 * tal como está girado (en el Worker, cancelable), muestra el rebalse y la capacidad máxima en mL/L
 * (y en onzas/tazas con unidades imperiales), elige la cavidad si hay varias y deja bajar el nivel
 * con un deslizador (% del rebalse) o un campo en la unidad activa, con rebote.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Copy, Droplet } from 'lucide-react';
import { t } from '../../i18n';
import { useMeasureStore } from '../../store/measureStore';
import { useKuraStore } from '../../store/useKuraStore';
import { formatCapacity, formatLength } from '../../utils/measureUnits';
import { fromMm, getUnitStep, toMm } from '../../utils/units';
import { copyMeasureValue } from './measureClipboard';

const DEBOUNCE_MS = 250;

export const MeasureCapacityPanel: React.FC = () => {
  const lang = useKuraStore((s) => s.language);
  const unit = useKuraStore((s) => s.unitSystem);
  const obj = useKuraStore((s) => (s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined));
  const capacity = useMeasureStore((s) => s.capacity);
  const computeCapacity = useMeasureStore((s) => s.computeCapacity);
  const cancelCapacity = useMeasureStore((s) => s.cancelCapacity);
  const sliderId = useId();
  const fieldId = useId();
  const basinId = useId();
  const [percent, setPercent] = useState(100);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const cups = t(lang, 'measure.cups');
  if (!obj) return <p className="kura-measure-hint">{t(lang, 'measure.capacity.needSelection')}</p>;

  const mine = capacity?.objectId === obj.id ? capacity : null;
  const stale = mine && mine.source !== obj;
  const result = mine && !stale ? mine.result : null;
  const running = mine?.status === 'running';
  const basin = result?.basins[result.basinIndex];

  const schedule = (levelHeightMm: number | undefined, basinIndex?: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void computeCapacity(obj, { levelHeightMm, basinIndex }), DEBOUNCE_MS);
  };
  const onPercent = (p: number) => {
    if (!basin) return;
    setPercent(p);
    schedule(p >= 100 ? undefined : (basin.overflowHeightMm * p) / 100, result!.basinIndex);
  };
  const onLevelField = (value: number) => {
    if (!basin || !Number.isFinite(value)) return;
    const mm = Math.min(Math.max(0, toMm(value, unit)), basin.overflowHeightMm);
    setPercent(basin.overflowHeightMm > 0 ? Math.round((mm / basin.overflowHeightMm) * 1000) / 10 : 0);
    schedule(mm >= basin.overflowHeightMm ? undefined : mm, result!.basinIndex);
  };

  const max = basin ? formatCapacity(basin.maxCapacityMm3, unit, cups, lang) : null;
  const filled = result ? formatCapacity(result.filledMm3, unit, cups, lang) : null;

  return (
    <div className="kura-measure-capacity" data-testid="measure-capacity">
      <div className="kura-measure-row">
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={running}
          onClick={() => {
            setPercent(100);
            void computeCapacity(obj, { basinIndex: result?.basinIndex });
          }}
        >
          <Droplet size={13} aria-hidden />
          <span>{running ? t(lang, 'measure.capacity.running') : t(lang, 'measure.capacity.run')}</span>
        </button>
        {running && (
          <button type="button" className="kura-btn kura-btn-sm" onClick={cancelCapacity}>
            {t(lang, 'measure.capacity.cancel')}
          </button>
        )}
      </div>
      <p className="kura-measure-hint">{t(lang, 'measure.capacity.orientation')}</p>
      {stale && <p className="kura-measure-hint" role="status">{t(lang, 'measure.capacity.stale')}</p>}
      {mine?.status === 'error' && <p className="kura-measure-hint" role="alert">{t(lang, 'measure.capacity.error')}</p>}

      {result && result.basins.length === 0 && <p role="status">{t(lang, 'measure.capacity.none')}</p>}

      {result && result.basins.length > 1 && (
        <label htmlFor={basinId} className="kura-measure-level">
          <span>{t(lang, 'measure.capacity.basinSelect')}</span>
          <select
            id={basinId}
            value={result.basinIndex}
            onChange={(e) => {
              setPercent(100);
              void computeCapacity(obj, { basinIndex: Number(e.target.value) });
            }}
          >
            {result.basins.map((b, i) => (
              <option key={i} value={i}>
                {t(lang, 'measure.capacity.basin', { n: i + 1 })} · {formatCapacity(b.maxCapacityMm3, unit, cups, lang).liquid}
              </option>
            ))}
          </select>
        </label>
      )}

      {basin && max && (
        <div role="status" aria-live="polite">
          <div className="kura-measure-row">
            <span className="kura-measure-row-text">
              {t(lang, 'measure.capacity.max')}: <span className="kura-measure-value" data-testid="capacity-max">{max.liquid}</span>
              <span className="kura-measure-row-sub">{max.solid}{max.us ? ` · ${max.us}` : ''}</span>
              <span className="kura-measure-row-sub">{t(lang, 'measure.capacity.overflow', { height: formatLength(basin.overflowHeightMm, unit, lang) })}</span>
            </span>
            <button type="button" className="kura-btn kura-btn-sm kura-btn-icon" aria-label={t(lang, 'measure.copy', { value: max.liquid })} title={t(lang, 'measure.copy', { value: max.liquid })} onClick={() => void copyMeasureValue(max.liquid)}>
              <Copy size={12} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {basin && (
        <div className="kura-measure-level">
          <label htmlFor={sliderId}>{t(lang, 'measure.capacity.levelPercent')}</label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            aria-valuetext={`${percent}%`}
            onChange={(e) => onPercent(Number(e.target.value))}
          />
          <label htmlFor={fieldId} className="kura-measure-level">
            <span>{t(lang, 'measure.capacity.levelMm')}</span>
            <input
              id={fieldId}
              type="number"
              min={0}
              step={getUnitStep(unit)}
              max={Number(fromMm(basin.overflowHeightMm, unit).toFixed(3))}
              value={Number(fromMm((basin.overflowHeightMm * percent) / 100, unit).toFixed(2))}
              onChange={(e) => onLevelField(Number(e.target.value))}
            />
            <span>{unit}</span>
          </label>
        </div>
      )}

      {basin && filled && percent < 100 && (
        <p>
          {t(lang, 'measure.capacity.filled')}: <strong data-testid="capacity-filled">{filled.liquid}</strong> <span className="kura-measure-row-sub">{filled.solid}{filled.us ? ` · ${filled.us}` : ''}</span>
        </p>
      )}

      {result?.sealedCavitiesMm3.map((v, i) => (
        <p key={i} className="kura-measure-hint">
          {t(lang, 'measure.capacity.sealed', { volume: formatCapacity(v, unit, cups, lang).liquid })}
        </p>
      ))}
    </div>
  );
};
