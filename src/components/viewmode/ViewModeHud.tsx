/**
 * @file src/components/viewmode/ViewModeHud.tsx
 * @description Tarjeta del visor en Armado y Libre: rótulo persistente de la vista («Vista armada» / «Vista libre») con
 * la nota de que mover piezas aquí no cambia su lugar en la placa, botón «Volver a Imprimir» y la separación visual
 * («explosión») para el grupo seleccionado o toda la figura. La separación es solo dibujo (no toca poses ni historial)
 * y vuelve a 0 al salir del modo. En Imprimir no se dibuja nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useMemo, useState } from 'react';
import { Boxes, Move3d, Printer } from 'lucide-react';
import { viewModeOf } from '../../core/scene/viewMode';
import { t } from '../../i18n';
import { requestViewMode } from '../../store/viewModeRequest';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewMode.css';
import { explodeGroupKeyOf } from './useFigureExplode';

/** «Volver a Imprimir» se desmonta al cambiar de vista: el foco pasa al radio activo de «Modo de vista». */
export function focusActiveViewMode(tries = 0): void {
  requestAnimationFrame(() => {
    const radio = document.querySelector<HTMLElement>('[data-testid="viewmode-selector"] [role="radio"][aria-checked="true"]');
    if (radio) radio.focus({ preventScroll: true });
    else if (tries < 3) focusActiveViewMode(tries + 1);
  });
}

export const ViewModeHud: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const layout = useKuraStore((s) => s.layout);
  const freeView = useKuraStore((s) => s.freeView);
  const objects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const explode = useKuraStore((s) => s.figureExplode);
  const setFigureExplode = useKuraStore((s) => s.setFigureExplode);
  const [wantedScope, setWantedScope] = useState<'all' | 'group'>('all');
  const uid = useId();
  const groupKey = useMemo(() => explodeGroupKeyOf(objects, groups, selectedIds), [objects, groups, selectedIds]);
  const mode = viewModeOf(layout, freeView);
  if (mode === 'print') return null;

  // Sin grupo seleccionado solo se puede separar toda la figura.
  const scope = wantedScope === 'group' && groupKey ? 'group' : 'all';
  const factor = explode?.factor ?? 0;
  const pct = Math.round(factor * 100);
  const modeLabel = t(language, mode === 'free' ? 'viewMode.badge.free' : 'viewMode.badge.assembly');
  const apply = (nextScope: 'all' | 'group', nextFactor: number) =>
    setFigureExplode({ scope: nextScope, groupKey: nextScope === 'group' ? groupKey : null, factor: nextFactor });

  return (
    <div className="kura-hud-card kura-viewmode-hud" data-testid="viewmode-hud" data-mode={mode}>
      <div className="kura-viewmode-badge" data-testid="viewmode-badge" aria-label={t(language, 'viewMode.badge.label', { mode: modeLabel })}>
        {mode === 'free' ? <Move3d size={14} aria-hidden="true" /> : <Boxes size={14} aria-hidden="true" />}
        <strong>{modeLabel}</strong>
        <span className="kura-viewmode-note">{t(language, 'viewMode.badge.note')}</span>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'viewMode.print.tip')}
          data-testid="viewmode-back"
          onClick={() => {
            requestViewMode('print');
            focusActiveViewMode();
          }}
        >
          <Printer size={13} aria-hidden="true" />
          <span>{t(language, 'viewMode.badge.back')}</span>
        </button>
      </div>
      <div className="kura-viewmode-explode" title={t(language, 'viewMode.explode.tip')}>
        <label htmlFor={`${uid}-explode`}>{t(language, 'viewMode.explode.label')}</label>
        <input
          id={`${uid}-explode`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          data-testid="viewmode-explode"
          aria-valuetext={t(language, 'viewMode.explode.value', { pct })}
          onChange={(e) => apply(scope, Number(e.target.value) / 100)}
        />
        <span className="kura-viewmode-pct" aria-hidden="true">{pct} %</span>
        <label htmlFor={`${uid}-scope`} className="sr-only">{t(language, 'viewMode.explode.scope')}</label>
        <select
          id={`${uid}-scope`}
          className="kura-select"
          value={scope}
          data-testid="viewmode-scope"
          title={t(language, 'viewMode.explode.scope')}
          onChange={(e) => {
            const next = e.target.value === 'group' ? 'group' : 'all';
            setWantedScope(next);
            if (factor > 0) apply(next === 'group' && groupKey ? 'group' : 'all', factor);
          }}
        >
          <option value="all">{t(language, 'viewMode.explode.scope.all')}</option>
          <option value="group" disabled={!groupKey}>{t(language, 'viewMode.explode.scope.group')}</option>
        </select>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          disabled={factor <= 0}
          data-testid="viewmode-explode-reset"
          onClick={() => setFigureExplode(null)}
        >
          {t(language, 'viewMode.explode.reset')}
        </button>
      </div>
    </div>
  );
};
