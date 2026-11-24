/**
 * @file src/components/viewport/PaintToolbar.tsx
 * @description Barra contextual de la herramienta Pintar en el visor: a qué objeto va la pintura y la ayuda. En
 * escritorio las opciones (modo, radio, paleta, goma) están en el panel derecho; en pantallas estrechas la barra
 * las trae también (`PaintControls`), como hoja plegable en móvil, y también con el panel plegado. Monta los efectos de la herramienta una vez.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PaintControls, usePaintToolEffects } from '../paint/PaintControls';
import { PaintRefineHint } from './PaintRefineHint';
import '../../styles/paintTools.css';

export const PaintToolbar: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const targetName = useKuraStore((s) => s.objects.find((o) => o.id === s.selectedIds[0])?.name ?? null);
  // En móvil la barra es una hoja inferior plegable; en escritorio el botón no se muestra.
  const [folded, setFolded] = useState(false);
  // Con el panel derecho plegado (o en modo sin distracciones) las opciones vuelven a la barra del visor.
  const panelHidden = useKuraStore((s) => s.rightCollapsed || s.uiDensity === 'zen');
  usePaintToolEffects();

  return (
    <div
      className={`kura-hud-card kura-paint-toolbar ${folded ? 'is-folded' : ''} ${panelHidden ? 'has-controls' : ''}`}
      data-viewport-occluder
      role="toolbar"
      aria-label={t(language, 'viewport.paint.toolbar')}
    >
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-paint-fold"
        aria-expanded={!folded}
        title={t(language, folded ? 'viewport.paint.expand' : 'viewport.paint.collapse')}
        onClick={() => setFolded((v) => !v)}
      >
        {folded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        <span>{t(language, folded ? 'viewport.paint.expand' : 'viewport.paint.collapse')}</span>
      </button>
      <div className="kura-paint-hud-controls">
        <PaintControls />
      </div>
      <span
        className={`kura-paint-target ${targetName ? '' : 'is-empty'}`}
        role="status"
        title={targetName ?? undefined}
      >
        {targetName
          ? t(language, 'viewport.paint.target', { name: targetName })
          : t(language, 'viewport.paint.noTarget')}
      </span>
      <span className="kura-paint-hint">{t(language, 'viewport.paint.hint')}</span>
      <PaintRefineHint />
    </div>
  );
};
