/**
 * @file src/components/contextPanel/ToolPanel.tsx
 * @description Contexto «herramienta» del panel derecho: solo lo que sirve a la herramienta activa. Pintar: modo,
 * pincel, paleta, goma, separar por colores y filamentos; Mover / Rotar / Escalar: esa parte de la transformación
 * del objeto (y un acceso al resumen completo); Esculpir / Borrar: el radio; Cortar: abrir el corte; Medir: cómo
 * se usa. Reutiliza las secciones existentes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef } from 'react';
import { ListTree, Scissors } from 'lucide-react';
import { isSolid } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import type { PanelToolId } from '../../store/panelContext';
import { paintTargetText } from '../../store/paintTarget';
import { useKuraStore } from '../../store/useKuraStore';
import type { TransformMode } from '../../types/kura';
import { ColorSplitControl } from '../inspector/ColorSplitControl';
import { FilamentLegendCard } from '../inspector/FilamentLegendCard';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { TransformSection } from '../inspector/TransformSection';
import { PanelHeader } from '../shell/PanelHeader';
import { usePanelEscape } from '../shell/usePanelEscape';
import { usePanelFocusReturn } from '../shell/usePanelFocus';
import { PaintControls } from '../paint/PaintControls';
import '../../styles/toolPanel.css';

const TITLE: Record<PanelToolId, TranslationKey> = {
  paint: 'topbar.tool.paint',
  erase: 'topbar.tool.erase',
  measure: 'topbar.tool.measure',
  cut: 'topbar.tool.cut',
  move: 'rediseno.tool.move',
  rotate: 'rediseno.tool.rotate',
  scale: 'rediseno.tool.scale',
};

const HELP: Record<PanelToolId, TranslationKey> = {
  paint: 'rediseno.help.paint',
  erase: 'rediseno.help.erase',
  measure: 'rediseno.help.measure',
  cut: 'rediseno.help.cut',
  move: 'rediseno.help.move',
  rotate: 'rediseno.help.rotate',
  scale: 'rediseno.help.scale',
};

const FOCUS: Partial<Record<PanelToolId, TransformMode>> = { move: 'translate', rotate: 'rotate', scale: 'scale' };

/** Nombre del panel de una herramienta (también para el anuncio). */
export function toolPanelTitle(tool: PanelToolId): TranslationKey {
  return TITLE[tool];
}

export const ToolPanel: React.FC<{ tool: PanelToolId; objectId: string | null; ui: InspectorLocalState }> = ({ tool, objectId, ui }) => {
  const language = useKuraStore((s) => s.language);
  const primary = useKuraStore((s) => (objectId ? s.objects.find((o) => o.id === objectId) ?? null : null));
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const eraseRadiusMm = useKuraStore((s) => s.eraseRadiusMm);
  const setEraseRadiusMm = useKuraStore((s) => s.setEraseRadiusMm);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const setTransformFocus = useKuraStore((s) => s.setTransformFocus);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const focus = FOCUS[tool];
  const paintTarget = paintTargetText(language, objects, selectedIds);

  let body: React.ReactNode = null;
  if (tool === 'paint') {
    body = (
      <>
        <section className="kura-card" aria-labelledby="kura-tool-paint-opts">
          <h3 className="kura-section-label" id="kura-tool-paint-opts">{t(language, 'rediseno3b.panel.paintOptions')}</h3>
          <PaintControls />
          <p className="kura-ctx-hint">{t(language, 'viewport.paint.hint')}</p>
        </section>
        {primary && isSolid(primary) && (
          <section className="kura-card" aria-labelledby="kura-tool-paint-split">
            <h3 className="kura-section-label" id="kura-tool-paint-split">{t(language, 'inspector.op.splitColors')}</h3>
            <ColorSplitControl primary={primary} />
          </section>
        )}
        <FilamentLegendCard />
      </>
    );
  } else if (focus && primary) {
    body = (
      <>
        <TransformSection primary={primary} ui={ui} focus={focus} />
        <button type="button" className="kura-btn kura-btn-sm kura-tool-panel-summary" onClick={() => setTransformFocus(null)} title={t(language, 'rediseno3b.panel.showSummaryTip')}>
          <ListTree size={13} aria-hidden="true" />
          <span>{t(language, 'rediseno3b.panel.showSummary')}</span>
        </button>
      </>
    );
  } else if (tool === 'erase') {
    body = (
      <section className="kura-card">
        <label className="kura-tool-panel-range">
          <span>{t(language, 'viewport.erase.radius')}: {eraseRadiusMm} mm</span>
          <input
            type="range"
            min={1}
            max={25}
            step={0.5}
            value={eraseRadiusMm}
            aria-label={t(language, 'viewport.erase.radius')}
            aria-valuetext={`${eraseRadiusMm} mm`}
            title={t(language, 'viewport.erase.radius')}
            onChange={(e) => setEraseRadiusMm(Number(e.target.value))}
          />
        </label>
        <p className="kura-ctx-hint">{t(language, 'viewport.erase.hint')}</p>
      </section>
    );
  } else if (tool === 'cut') {
    body = (
      <section className="kura-card">
        <p className="kura-ctx-hint">{t(language, 'viewport.cut.hint')}</p>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-primary"
          disabled={!primary}
          title={primary ? t(language, 'viewport.cut.openDialog') : t(language, 'rediseno3b.panel.pickObject')}
          onClick={() => setActiveDialog('cut')}
        >
          <Scissors size={13} aria-hidden="true" />
          <span>{t(language, 'viewport.cut.openDialog')}</span>
        </button>
      </section>
    );
  } else if (tool === 'measure') {
    body = (
      <section className="kura-card">
        <p className="kura-ctx-hint">{t(language, 'rediseno3b.panel.measureHint')}</p>
      </section>
    );
  }

  // «Volver»: Mover / Rotar / Escalar quitan el foco de transformación (vuelve el resumen); las demás vuelven a
  // Seleccionar. El foco regresa al botón de la herramienta en el riel (o al título del panel si no está).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = usePanelFocusReturn(rootRef, { remember: false });
  const goBack = () => {
    if (focus) setTransformFocus(null);
    else setActiveTool('select');
    restoreFocus(() => document.querySelector<HTMLElement>(`[data-help="tool.${tool}"]`));
  };

  // Esc: un solo dueño (cadena de prioridad en `store/escapeChain`). Medir cancela antes su punto en curso (captura).
  usePanelEscape(rootRef, goBack, { level: 'tool', outside: 'tool' });

  return (
    <div ref={rootRef} className="kura-ctx-tool" data-tool-panel={tool} data-testid="panel-tool">
      <PanelHeader onBack={goBack} title={t(language, TITLE[tool])} titleClassName="kura-ctx-heading" focusableTitle />
      {tool === 'paint' ? (
        // Pintar: la misma frase que la barra del visor, con cualquier selección (ninguno, uno o varios).
        <p className={`kura-ctx-target ${paintTarget.name ? '' : 'is-empty'}`} title={paintTarget.name ?? undefined}>{paintTarget.text}</p>
      ) : (
        <p className={`kura-ctx-target ${primary ? '' : 'is-empty'}`} title={primary?.name}>
          {primary ? t(language, 'panel.action.target', { name: primary.name }) : t(language, 'rediseno3b.panel.pickObject')}
        </p>
      )}
      <div className="kura-scroll-area kura-ctx-body">
        <p className="kura-ctx-hint kura-tool-panel-help">{t(language, HELP[tool])}</p>
        {body}
      </div>
    </div>
  );
};
