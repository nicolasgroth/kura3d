/**
 * @file src/components/contextPanel/ContextPanel.tsx
 * @description Panel derecho contextual: muestra una sola cosa según `panelContextOf` (proyecto, resumen de un
 * objeto, selección múltiple, opciones de la acción activa u opciones de la herramienta activa). Las secciones del
 * resumen del objeto se pliegan y lo recuerdan (`PanelFold`). Se ensancha o reduce con el separador del borde,
 * se pliega con el botón ‹ / › (ancho y estado se recuerdan) y anuncia el cambio de contexto en una región
 * `aria-live` discreta. En pantallas estrechas el mismo contenido va en la hoja inferior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parametricStateOf } from '../../core/scene/parametric';
import { t, type TranslationKey } from '../../i18n';
import { panelContextKey, panelContextOf, type PanelContext } from '../../store/panelContext';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { FilamentLegendCard } from '../inspector/FilamentLegendCard';
import { GeometrySection } from '../inspector/GeometrySection';
import { IdentitySection } from '../inspector/IdentitySection';
import { InspectorEdgeToggle } from '../inspector/InspectorEdgeToggle';
import { InspectorMulti } from '../inspector/InspectorMulti';
import type { InspectorLocalState } from '../inspector/inspectorTypes';
import { ParametersSection } from '../inspector/ParametersSection';
import { TransformSection } from '../inspector/TransformSection';
import { useScrollTopOnSelection } from '../inspector/useScrollTopOnSelection';
import { SplitJointsSection } from '../split/SplitJointsSection';
import { SplitPartInfo } from '../split/SplitPartInfo';
import { ActionPanel } from './ActionPanel';
import { ObjectOperations } from './ObjectOperations';
import { panelContentOf } from './panelRegistry';
import { PanelResizer } from './PanelResizer';
import { ProjectSummary } from './ProjectSummary';
import { PanelFold } from './PanelFold';
import { ToolPanel, toolPanelTitle } from './ToolPanel';
import '../../styles/contextPanel.css';

function announcement(language: LanguageCode, ctx: PanelContext, objects: SceneObject[]): string {
  switch (ctx.kind) {
    case 'project':
      return t(language, 'panel.announce.project');
    case 'object':
      return t(language, 'panel.announce.object', { name: objects.find((o) => o.id === ctx.id)?.name ?? '' });
    case 'multi':
      return t(language, 'panel.announce.multi', { count: ctx.count });
    case 'action': {
      const entry = panelContentOf(ctx.id);
      return t(language, 'panel.announce.action', { name: entry ? t(language, entry.title) : '' });
    }
    case 'tool':
      return t(language, 'panel.announce.action', { name: t(language, toolPanelTitle(ctx.tool)) });
  }
}

/**
 * Anuncia el contexto nuevo (no el inicial) en una región viva discreta. El texto se guarda con el idioma en que se
 * generó: si el idioma de la interfaz cambia, el anuncio viejo se descarta en vez de leerse en el idioma anterior.
 */
export function useContextAnnouncement(language: LanguageCode, ctx: PanelContext, objects: SceneObject[]): string {
  const key = panelContextKey(ctx);
  const previous = useRef(key);
  const [announced, setAnnounced] = useState<{ text: string; language: LanguageCode }>({ text: '', language });
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    setAnnounced({ text: announcement(language, ctx, objects), language });
    // Solo cuando cambia el contexto, no con cada edición del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return announced.language === language ? announced.text : '';
}

const ObjectSummary: React.FC<{ primary: SceneObject; ui: InspectorLocalState }> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const scrollRef = useScrollTopOnSelection(primary.id);
  const sourceLabel = t(language, `inspector.source.${primary.source}` as TranslationKey);
  // La huella paramétrica solo cambia con el objeto: no se recalcula en cada render.
  const hasParams = useMemo(() => parametricStateOf(primary).status !== 'none', [primary]);
  return (
    <>
      <div className="kura-panel-header">
        <h2 className="kura-ctx-heading" tabIndex={-1}>{t(language, 'inspector.title')}</h2>
        <span className="kura-ctx-source" title={t(language, 'inspector.sourceLabel', { source: sourceLabel })}>
          {sourceLabel}
        </span>
      </div>
      <div className="kura-scroll-area" ref={scrollRef} data-testid="panel-object">
        {primary.metadata?.split && (
          <section className="kura-card">
            <SplitPartInfo primary={primary} />
            <SplitJointsSection primary={primary} />
          </section>
        )}
        <PanelFold id="identity" title="inspector.section.identity"><IdentitySection primary={primary} /></PanelFold>
        {hasParams && (
          <PanelFold id="parameters" title="rediseno3b.fold.parameters"><ParametersSection primary={primary} /></PanelFold>
        )}
        <PanelFold id="transform" title="rediseno3b.fold.transform"><TransformSection primary={primary} ui={ui} /></PanelFold>
        <PanelFold id="geometry" title="inspector.section.stats"><GeometrySection primary={primary} /></PanelFold>
        <ObjectOperations primary={primary} />
        <FilamentLegendCard />
      </div>
    </>
  );
};

export const ContextPanel: React.FC<{ ui: InspectorLocalState }> = ({ ui }) => {
  const language = useKuraStore((s) => s.language);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const width = useKuraStore((s) => s.rightPanelWidth);
  const activeAction = useKuraStore((s) => s.activeAction);
  const activeTool = useKuraStore((s) => s.activeTool);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const objects = useKuraStore((s) => s.objects);
  const transformFocus = useKuraStore((s) => s.transformFocus);
  const ctx = useMemo(
    () => panelContextOf({ activeAction, activeTool, selectedIds, objects, transformFocus }),
    [activeAction, activeTool, selectedIds, objects, transformFocus],
  );
  const live = useContextAnnouncement(language, ctx, objects);

  let body: React.ReactNode;
  if (ctx.kind === 'project') {
    body = (
      <>
        <div className="kura-panel-header">
          <h2 className="kura-ctx-heading" tabIndex={-1}>{t(language, 'panel.project.title')}</h2>
        </div>
        <div className="kura-scroll-area">
          <ProjectSummary />
        </div>
      </>
    );
  } else if (ctx.kind === 'multi') {
    body = (
      <>
        <div className="kura-panel-header">
          <h2 className="kura-ctx-heading" tabIndex={-1}>{t(language, 'inspector.title')}</h2>
        </div>
        <div className="kura-scroll-area" data-testid="panel-multi">
          <InspectorMulti />
        </div>
      </>
    );
  } else if (ctx.kind === 'tool') {
    body = <ToolPanel tool={ctx.tool} objectId={ctx.objectId} ui={ui} />;
  } else if (ctx.kind === 'action' && panelContentOf(ctx.id)?.renderScene) {
    body = <ActionPanel id={ctx.id} primary={objects.find((o) => o.id === ctx.objectId) ?? null} ui={ui} />;
  } else {
    const primary = objects.find((o) => o.id === (ctx.kind === 'object' ? ctx.id : ctx.objectId));
    if (primary) {
      body = ctx.kind === 'action' ? <ActionPanel id={ctx.id} primary={primary} ui={ui} /> : <ObjectSummary primary={primary} ui={ui} />;
    }
  }

  return (
    <aside
      id="kura-inspector-panel"
      className={`kura-sidebar-right kura-ctx-panel ${rightCollapsed ? 'is-collapsed' : ''}`}
      style={{ '--kura-right-w': `${width}px` } as React.CSSProperties}
      aria-label={t(language, 'inspector.title')}
      data-context={ctx.kind}
    >
      <InspectorEdgeToggle />
      {!rightCollapsed && <PanelResizer />}
      <div className="kura-ctx-live" role="status" aria-live="polite" lang={language} data-testid="panel-live">
        {live}
      </div>
      {body}
    </aside>
  );
};
