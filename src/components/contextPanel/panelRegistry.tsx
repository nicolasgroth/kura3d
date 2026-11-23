/**
 * @file src/components/contextPanel/panelRegistry.tsx
 * @description Registro del contenido de cada acción con opciones en el panel derecho contextual: título y qué
 * secciones existentes del inspector muestra. Punto de extensión para una acción nueva: agrégala a
 * `PANEL_ACTIONS` (`store/actionsCatalog.ts`) y registra aquí su entrada con `registerPanelContent` (o en
 * `PANEL_CONTENT`); el panel pone el encabezado, «Volver», Esc, el foco y el anuncio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import type { TranslationKey } from '../../i18n';
import type { ActionId } from '../../store/actionsCatalog';
import type { InspectorSectionProps } from '../inspector/inspectorTypes';
import { HollowPanel } from '../inspector/HollowPanel';
import { MeshRefinePanel } from '../inspector/MeshRefinePanel';
import { ModulesPanel } from '../inspector/ModulesPanel';
import { PrintCheckPanel } from '../inspector/PrintCheckPanel';
import { StructureDetectionPanel } from '../inspector/StructureDetectionPanel';
import { TexturePanel } from '../inspector/TexturePanel';

export interface PanelContentEntry {
  /** Título del panel (y del anuncio). */
  title: TranslationKey;
  /** Opciones de la acción sobre el objeto (incluyen su botón de aplicar). */
  render: (props: InspectorSectionProps) => React.ReactNode;
}

const PANEL_CONTENT = new Map<ActionId, PanelContentEntry>([
  ['hollow', { title: 'panel.title.hollow', render: (p) => <HollowPanel {...p} /> }],
  ['simplify', { title: 'panel.title.simplify', render: (p) => <MeshRefinePanel {...p} /> }],
  ['refine', { title: 'panel.title.refine', render: (p) => <MeshRefinePanel {...p} /> }],
  ['texture', { title: 'panel.title.texture', render: (p) => <TexturePanel {...p} /> }],
  ['modules', { title: 'panel.title.modules', render: (p) => <ModulesPanel {...p} /> }],
  ['validate', { title: 'panel.title.validate', render: (p) => <PrintCheckPanel primary={p.primary} /> }],
  ['detect', { title: 'panel.title.detect', render: (p) => <StructureDetectionPanel {...p} /> }],
]);

/** Registra (o reemplaza) el contenido de una acción del panel. */
export function registerPanelContent(id: ActionId, entry: PanelContentEntry): void {
  PANEL_CONTENT.set(id, entry);
}

export function panelContentOf(id: ActionId): PanelContentEntry | undefined {
  return PANEL_CONTENT.get(id);
}
