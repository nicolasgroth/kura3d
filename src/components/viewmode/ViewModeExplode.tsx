/**
 * @file src/components/viewmode/ViewModeExplode.tsx
 * @description Controles de la separación visual («explosión») de la vista Armado, en la misma fila de la tira de
 * placas: deslizador «Separación» con su porcentaje (flechas 1 %, RePág/AvPág 10 %), alcance «Toda la figura / Grupo
 * seleccionado» y «Juntar piezas». La separación es solo dibujo (no toca poses ni historial) y vuelve a 0 al volver a
 * Imprimir. Antes vivía en un panel flotante sobre el visor (`ViewModeHud`). Fuera de Armado no dibuja nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useMemo, useState } from 'react';
import { viewModeOf } from '../../core/scene/viewMode';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewMode.css';
import { explodeGroupKeyOf } from './useFigureExplode';

/** Tras un cambio de vista que desmonta el control pulsado, el foco pasa al radio activo de «Modo de vista». */
export function focusActiveViewMode(tries = 0): void {
  requestAnimationFrame(() => {
    const radio = document.querySelector<HTMLElement>('[data-testid="viewmode-selector"] [role="radio"][aria-checked="true"]');
    if (radio) radio.focus({ preventScroll: true });
    else if (tries < 3) focusActiveViewMode(tries + 1);
  });
}

export const ViewModeExplode: React.FC = () => {
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
  if (viewModeOf(layout, freeView) !== 'assembly') return null;

  // Sin grupo seleccionado solo se puede separar toda la figura.
  const scope = wantedScope === 'group' && groupKey ? 'group' : 'all';
  const factor = explode?.factor ?? 0;
  const pct = Math.round(factor * 100);
  const apply = (nextScope: 'all' | 'group', nextFactor: number) =>
    setFigureExplode({ scope: nextScope, groupKey: nextScope === 'group' ? groupKey : null, factor: Math.min(1, Math.max(0, nextFactor)) });

  return (
    <div className="kura-viewmode-explode" data-testid="viewmode-explode-bar" title={t(language, 'viewMode.explode.tip')}>
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
        onKeyDown={(e) => {
          // RePág / AvPág saltan 10 % (flechas: 1 %).
          if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
          e.preventDefault();
          apply(scope, (pct + (e.key === 'PageUp' ? 10 : -10)) / 100);
        }}
      />
      <span className="kura-viewmode-pct" aria-hidden="true">{pct} %</span>
      <select
        className="kura-select"
        value={scope}
        data-testid="viewmode-scope"
        aria-label={t(language, 'viewMode.explode.scope')}
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
  );
};
