/**
 * @file src/components/shell/ViewBar.tsx
 * @description Barra de vista única sobre el visor, en una sola fila con grupos separados: Vistas (Iso, Superior,
 * Frente, Derecha), Encuadrar, Sin cama, Rayos X / Sección (con su altura) y Rejilla. Si no cabe, primero
 * deja las vistas solo con icono, luego todo (iconos con tooltip) y al final junta las vistas en un menú; nunca pasa a otra fila. Con los
 * rótulos ocultos (preferencia global) muestra solo iconos. Reemplaza a las tarjetas flotantes del visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Grid3x3, Layers, Maximize2 } from 'lucide-react';
import { t } from '../../i18n';
import { type CameraPresetType, useKuraStore } from '../../store/useKuraStore';
import { formatDimension } from '../../utils/units';
import { BedToggleButton } from '../viewport/BedToggleButton';
import { pickTopbarLevel, recordTopbarWidth } from '../topbarFit';
import { CONTROL_HELP, helpAttrs, type HelpId } from './controlHelp';
import { ViewIcon } from './ViewIcon';
import '../../styles/shellViewBar.css';

const VIEWS = [
  { preset: 'iso', help: 'view.iso', label: 'rediseno.view.iso' },
  { preset: 'top', help: 'view.top', label: 'rediseno.view.top' },
  { preset: 'front', help: 'view.front', label: 'rediseno.view.front' },
  { preset: 'right', help: 'view.right', label: 'rediseno.view.right' },
] as const satisfies ReadonlyArray<{ preset: CameraPresetType; help: HelpId; label: string }>;

/** Niveles de ahorro: 0 = con rótulos, 1 = vistas solo con icono, 2 = todo con icono, 3 = vistas en un menú. */
const MAX_LEVEL = 3;

/** Ancho natural de la fila: suma del ancho de cada hijo y sus separaciones. */
function rowWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const gap = parseFloat(style.columnGap) || 0;
  const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const kids = Array.from(el.children) as HTMLElement[];
  let total = pad + gap * Math.max(0, kids.length - 1);
  for (const kid of kids) total += kid.getBoundingClientRect().width;
  return Math.ceil(total);
}

export const ViewBar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const setSnapGridMm = useKuraStore((s) => s.setSnapGridMm);
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const setSectionPlane = useKuraStore((s) => s.setSectionPlane);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const labelsHidden = uiDensity === 'compact';

  const maxSceneHeight = useMemo(() => {
    let maxH = printerProfile.maxHeightMm;
    for (const obj of objects) {
      const top = obj.position[1] + obj.stats.dimensionsMm[1] * obj.scale[1];
      if (top > maxH) maxH = Math.ceil(top);
    }
    return Math.max(40, maxH);
  }, [objects, printerProfile.maxHeightMm]);

  // Ajuste a una sola fila (mismo criterio que la barra superior: se mide cada nivel y se elige el que cabe).
  const barRef = useRef<HTMLDivElement | null>(null);
  const [level, setLevel] = useState(0);
  const levelRef = useRef(level);
  levelRef.current = level;
  const widthsRef = useRef<Array<number | undefined>>([]);
  const refit = useCallback(() => {
    const el = barRef.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    widthsRef.current = recordTopbarWidth(widthsRef.current, levelRef.current, rowWidth(el));
    const next = pickTopbarLevel(host.clientWidth, widthsRef.current, MAX_LEVEL);
    if (next !== levelRef.current) setLevel(next);
  }, []);
  useEffect(() => {
    const host = barRef.current?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => refit());
    observer.observe(host);
    return () => observer.disconnect();
  }, [refit]);
  useLayoutEffect(() => {
    widthsRef.current = [];
  }, [language, labelsHidden, sectionPlane.enabled]);
  useLayoutEffect(() => refit());

  const iconsOnly = labelsHidden || level >= 2;
  const viewIcons = iconsOnly || level >= 1;
  const viewsMenu = level >= 3;
  const name = (id: HelpId) => t(language, CONTROL_HELP[id].name);

  return (
    <div
      ref={barRef}
      className={`kura-viewbar${iconsOnly ? ' is-icons' : ''}${viewIcons ? ' is-view-icons' : ''}`}
      role="toolbar"
      aria-label={t(language, 'rediseno.view.bar')}
      data-level={level}
    >
      <div className="kura-viewbar-group" role="group" aria-label={t(language, 'rediseno.view.views')}>
        {viewsMenu ? (
          <ViewsMenu language={language} onPick={(p) => requestCameraPreset(p)} />
        ) : (
          VIEWS.map((view) => (
            <button
              key={view.preset}
              type="button"
              className="kura-btn kura-btn-sm kura-viewbar-btn"
              onClick={() => requestCameraPreset(view.preset)}
              aria-label={name(view.help)}
              {...helpAttrs(view.help, language)}
            >
              <ViewIcon view={view.preset} />
              <span className="kura-viewbar-label kura-viewbar-view-label">{t(language, view.label)}</span>
            </button>
          ))
        )}
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-viewbar-btn"
          onClick={() => requestCameraPreset('fit')}
          aria-label={name('view.fit')}
          {...helpAttrs('view.fit', language)}
        >
          <Maximize2 size={15} aria-hidden="true" />
          <span className="kura-viewbar-label">{name('view.fit')}</span>
        </button>
      </div>
      <span className="kura-viewbar-sep" role="separator" aria-orientation="vertical" />
      <div className="kura-viewbar-group" role="group" aria-label={t(language, 'rediseno.view.bar')}>
        <span className="kura-viewbar-bed" data-help="view.bed">
          <BedToggleButton />
        </span>
        <button
          type="button"
          className={`kura-btn kura-btn-sm kura-viewbar-btn ${sectionPlane.enabled ? 'is-active' : ''}`}
          aria-pressed={sectionPlane.enabled}
          aria-label={name('view.xray')}
          onClick={() => setSectionPlane({ enabled: !sectionPlane.enabled })}
          {...helpAttrs('view.xray', language)}
        >
          <Layers size={15} aria-hidden="true" />
          <span className="kura-viewbar-label">{t(language, 'rediseno.view.xray')}</span>
        </button>
        {sectionPlane.enabled && (
          <label className="kura-viewbar-range">
            <input
              type="range"
              min={0}
              max={maxSceneHeight}
              step={0.5}
              value={sectionPlane.heightMm}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setSectionPlane({ heightMm: 25 })}
              onChange={(e) => setSectionPlane({ heightMm: Number(e.target.value) })}
              aria-label={t(language, 'viewport.section.height')}
            />
            <span className="kura-viewbar-value">{formatDimension(sectionPlane.heightMm, unitSystem, 1, language)}</span>
          </label>
        )}
      </div>
      <span className="kura-viewbar-sep" role="separator" aria-orientation="vertical" />
      <label className="kura-viewbar-snap" {...helpAttrs('view.snap', language)}>
        <Grid3x3 size={15} aria-hidden="true" />
        <span className="kura-viewbar-label">{name('view.snap')}</span>
        <select
          className="kura-select"
          value={snapGridMm}
          onChange={(e) => setSnapGridMm(Number(e.target.value))}
          aria-label={t(language, 'viewport.snapLabel')}
        >
          <option value={0}>{t(language, 'viewport.snapOff')}</option>
          <option value={0.5}>0.5 mm</option>
          <option value={1}>1 mm</option>
          <option value={5}>5 mm</option>
          <option value={10}>10 mm</option>
        </select>
      </label>
    </div>
  );
};

/** Menú de vistas (cuando la barra no tiene ancho para los cuatro botones). */
const ViewsMenu: React.FC<{ language: Parameters<typeof t>[0]; onPick: (preset: CameraPresetType) => void }> = ({ language, onPick }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (!open) return;
    itemsRef.current[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  const close = () => {
    setOpen(false);
    (wrapRef.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const items = itemsRef.current.filter((x): x is HTMLButtonElement => Boolean(x));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };
  return (
    <div ref={wrapRef} className="kura-viewbar-menu-wrap">
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-viewbar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(language, 'rediseno.view.views')}
        onClick={() => setOpen((v) => !v)}
        {...helpAttrs('view.views', language)}
      >
        <ViewIcon view="iso" />
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div className="kura-viewbar-menu" role="menu" aria-label={t(language, 'rediseno.view.views')} onKeyDown={onKey}>
          {VIEWS.map((view, i) => (
            <button
              key={view.preset}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="kura-viewbar-menu-item"
              aria-keyshortcuts={CONTROL_HELP[view.help].keys}
              onClick={() => {
                onPick(view.preset);
                close();
              }}
            >
              <ViewIcon view={view.preset} />
              <span>{t(language, CONTROL_HELP[view.help].name)}</span>
              <kbd aria-hidden="true">{CONTROL_HELP[view.help].shortcut}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
