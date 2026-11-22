/**
 * @file src/components/measure/MeasurePanel.tsx
 * @description Panel de la herramienta Medir sobre el visor: modos (distancia, ángulo, área,
 * capacidad), indicación del paso siguiente, totales del objeto seleccionado y lista de mediciones
 * con copiar, borrar una y borrar todas. Esc cancela el punto en curso. Todo operable con teclado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import { Copy, Trash2, X } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { measureObject } from '../../engine/measure';
import { liveMeasurements, useMeasureStore, type MeasureMode, type Measurement } from '../../store/measureStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode, UnitSystem } from '../../types/kura';
import { formatAngle, formatArea, formatCapacity, formatLength } from '../../utils/measureUnits';
import { MeasureCapacityPanel } from './MeasureCapacityPanel';
import { copyMeasureValue } from './measureClipboard';
import '../../styles/measure.css';

const MODES: MeasureMode[] = ['distance', 'angle', 'area', 'capacity'];

/** Texto principal (lo que se copia) y detalle de una medición. */
export function describeMeasurement(m: Measurement, unit: UnitSystem, lang: LanguageCode): { title: string; value: string; detail?: string } {
  switch (m.kind) {
    case 'distance':
      return {
        title: t(lang, 'measure.item.distance'),
        value: formatLength(m.distanceMm, unit),
        detail: `ΔX ${formatLength(m.deltaUser[0], unit)} · ΔY ${formatLength(m.deltaUser[1], unit)} · ΔZ ${formatLength(m.deltaUser[2], unit)}`,
      };
    case 'angle':
      return { title: t(lang, 'measure.item.angle'), value: formatAngle(m.deg) };
    case 'faceAngle':
      return { title: t(lang, 'measure.item.faceAngle'), value: formatAngle(m.deg) };
    case 'area':
      return {
        title: t(lang, 'measure.item.area', { name: m.objectName }),
        value: formatArea(m.areaMm2, unit),
        detail: m.regions > 1 ? t(lang, 'measure.item.areaRegions', { n: m.regions }) : undefined,
      };
  }
}

function useHint(lang: LanguageCode): string {
  const mode = useMeasureStore((s) => s.mode);
  const angleInput = useMeasureStore((s) => s.angleInput);
  const n = useMeasureStore((s) => s.pending.length);
  switch (mode) {
    case 'distance':
      return t(lang, n === 0 ? 'measure.hint.distance0' : 'measure.hint.distance1');
    case 'angle':
      return angleInput === 'points' ? t(lang, 'measure.hint.anglePoints', { n }) : t(lang, 'measure.hint.angleFaces', { n });
    case 'area':
      return t(lang, 'measure.hint.area');
    case 'capacity':
      return t(lang, 'measure.hint.capacity');
  }
}

const ObjectTotals: React.FC<{ lang: LanguageCode; unit: UnitSystem }> = ({ lang, unit }) => {
  const obj = useKuraStore((s) => (s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined));
  const m = useMemo(() => (obj ? measureObject(obj) : null), [obj]);
  if (!obj || !m) return null;
  const cap = formatCapacity(m.volumeMm3, unit);
  return (
    <p className="kura-measure-hint" data-testid="measure-object-totals">
      {t(lang, 'measure.object.total', { name: obj.name, area: formatArea(m.surfaceAreaMm2, unit), volume: cap.solid, liquid: cap.liquid })}
    </p>
  );
};

export const MeasurePanel: React.FC = () => {
  const lang = useKuraStore((s) => s.language);
  const unit = useKuraStore((s) => s.unitSystem);
  const mode = useMeasureStore((s) => s.mode);
  const setMode = useMeasureStore((s) => s.setMode);
  const angleInput = useMeasureStore((s) => s.angleInput);
  const setAngleInput = useMeasureStore((s) => s.setAngleInput);
  const allMeasurements = useMeasureStore((s) => s.measurements);
  const objects = useKuraStore((s) => s.objects);
  const measurements = useMemo(() => liveMeasurements(allMeasurements, objects), [allMeasurements, objects]);
  const remove = useMeasureStore((s) => s.remove);
  const clearAll = useMeasureStore((s) => s.clearAll);
  const hint = useHint(lang);

  // Esc cancela el punto en curso antes que cualquier otro atajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useMeasureStore.getState().cancelPending()) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Al salir de la herramienta se descarta lo que estaba a medio marcar.
  useEffect(() => () => useMeasureStore.setState({ pending: [], hover: null }), []);

  return (
    <section className="kura-hud-card kura-measure-panel" aria-label={t(lang, 'measure.title')} data-testid="measure-panel">
      <div className="kura-measure-modes" role="group" aria-label={t(lang, 'measure.modes')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`kura-btn kura-btn-sm ${mode === m ? 'is-active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {t(lang, `measure.mode.${m}` as TranslationKey)}
          </button>
        ))}
      </div>
      {mode === 'angle' && (
        <div className="kura-measure-modes" role="group" aria-label={t(lang, 'measure.mode.angle')}>
          {(['points', 'faces'] as const).map((a) => (
            <button key={a} type="button" className={`kura-btn kura-btn-sm ${angleInput === a ? 'is-active' : ''}`} aria-pressed={angleInput === a} onClick={() => setAngleInput(a)}>
              {t(lang, a === 'points' ? 'measure.angle.points' : 'measure.angle.faces')}
            </button>
          ))}
        </div>
      )}
      <p className="kura-measure-hint" role="status" aria-live="polite">{hint}</p>
      {(mode === 'distance' || mode === 'angle') && <p className="kura-measure-hint">{t(lang, 'measure.hint.snap')}</p>}
      {mode === 'capacity' ? <MeasureCapacityPanel /> : <ObjectTotals lang={lang} unit={unit} />}

      {mode !== 'capacity' && (
        <div>
          <div className="kura-measure-row">
            <strong className="kura-measure-row-text">{t(lang, 'measure.list.title')}</strong>
            {measurements.length > 0 && (
              <button type="button" className="kura-btn kura-btn-sm" onClick={clearAll}>
                <Trash2 size={12} aria-hidden />
                <span>{t(lang, 'measure.clearAll')}</span>
              </button>
            )}
          </div>
          {measurements.length === 0 ? (
            <p className="kura-measure-hint">{t(lang, 'measure.list.empty')}</p>
          ) : (
            <ul className="kura-measure-list" data-testid="measure-list">
              {measurements.map((m) => {
                const d = describeMeasurement(m, unit, lang);
                return (
                  <li key={m.id} className="kura-measure-row">
                    <span className="kura-measure-row-text">
                      {d.title}: <strong>{d.value}</strong>
                      {d.detail && <span className="kura-measure-row-sub">{d.detail}</span>}
                    </span>
                    <button type="button" className="kura-btn kura-btn-sm kura-btn-icon" aria-label={t(lang, 'measure.copy', { value: d.value })} title={t(lang, 'measure.copy', { value: d.value })} onClick={() => void copyMeasureValue(d.value)}>
                      <Copy size={12} aria-hidden />
                    </button>
                    <button type="button" className="kura-btn kura-btn-sm kura-btn-icon" aria-label={t(lang, 'measure.remove', { label: `${d.title} ${d.value}` })} title={t(lang, 'measure.remove', { label: d.value })} onClick={() => remove(m.id)}>
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="kura-measure-hint">{t(lang, 'measure.list.session')}</p>
        </div>
      )}
    </section>
  );
};
