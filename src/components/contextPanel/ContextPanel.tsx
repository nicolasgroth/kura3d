/**
 * @file src/components/contextPanel/ContextPanel.tsx
 * @description Panel derecho contextual: muestra una sola cosa según `panelContextOf` (proyecto, resumen de un
 * objeto, selección múltiple u opciones de la acción activa). Se ensancha o reduce con el separador del borde,
 * se pliega con el botón ‹ / › (ancho y estado se recuerdan) y anuncia el cambio de contexto en una región
 * `aria-live` discreta. En pantallas estrechas el mismo contenido va en la hoja inferior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
      return t(language, 'panel.announce.action', { name: entry ? t(language, entry.title) : ctx.id });
    }
  }
}

/** Anuncia el contexto nuevo (no el inicial) en una región viva discreta. */
function useContextAnnouncement(language: LanguageCode, ctx: PanelContext, objects: SceneObject[]): string {
  const key = panelContextKey(ctx);
  const previous = useRef(key);
  const [text, setText] = useState('');
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    setText(announcement(language, ctx, objects));
    // Solo cuando cambia el contexto, no con cada edición del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return text;
}

const ObjectSummary: React.FC<{ primary: SceneObject; ui: InspectorLocalState }> = ({ primary, ui }) => {
  const language = useKuraStore((s) => s.language);
  const scrollRef = useScrollTopOnSelection(primary.id);
  const sourceLabel = t(language, `inspector.source.${primary.source}` as TranslationKey);
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
        <IdentitySection primary={primary} />
        <ParametersSection primary={primary} />
        <TransformSection primary={primary} ui={ui} />
        <GeometrySection primary={primary} />
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
  const ctx = useMemo(() => panelContextOf({ activeAction, activeTool, selectedIds, objects }), [activeAction, activeTool, selectedIds, objects]);
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
      <div className="kura-ctx-live" role="status" aria-live="polite" data-testid="panel-live">
        {live}
      </div>
      {body}
    </aside>
  );
};
