/**
 * @file src/store/insertCatalog.ts
 * @description Catálogo de lo que se puede agregar a la escena: las primitivas paramétricas (con sus valores por
 * defecto) y los generadores (Texto 3D, Importar SVG, Imagen → 3D, Rosca ISO, Cubo de calibración, Asistentes,
 * Alojamiento de imán). Es la única
 * fuente del botón «Agregar» de la barra vertical, del menú «Insertar» de la barra superior y de la hoja
 * «Agregar» en móvil; `runInsert` hace lo mismo desde cualquiera de ellos. El Texto 3D abre su panel de
 * creación (`useText3DPanel`) para validar el texto y el tamaño antes de crearlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import { discParams } from '../core/scene/pieceSizing';
import { t, type TranslationKey } from '../i18n';
import type { PrimitiveType } from '../types/kura';
import { closeAssistants, openAssistants, useAssistantsPanel } from './assistantsPanel';
import { closeMagnetPanel, openMagnetPanel, useMagnetPanel } from './magnetPanel';
import { closeScrewBossPanel, openScrewBossPanel, useScrewBossPanel } from './screwBossPanel';
import { closeKeyholePanel, openKeyholePanel, useKeyholePanel } from './keyholePanel';
import { useKuraStore } from './useKuraStore';

export type ShapeId = 'box' | 'cylinder' | 'disc' | 'tube' | 'sphere' | 'cone' | 'torus' | 'prism' | 'text';
export type GeneratorId = 'svg' | 'image' | 'thread' | 'calibration' | 'assistants' | 'magnet' | 'screwBoss' | 'keyhole';
export type InsertId = ShapeId | GeneratorId;

interface ShapeDef {
  id: ShapeId;
  type: PrimitiveType;
  params?: Record<string, unknown>;
}

/** Primitivas en el orden en que se muestran (Texto 3D al final, abre su panel). */
export const SHAPES: readonly ShapeDef[] = [
  { id: 'box', type: 'box', params: { width: 30, height: 30, depth: 30 } },
  { id: 'cylinder', type: 'cylinder', params: { radius: 14, height: 36 } },
  { id: 'disc', type: 'cylinder', params: { ...discParams(16) } },
  { id: 'tube', type: 'tube', params: { outerRadius: 16, innerRadius: 11, height: 36 } },
  { id: 'sphere', type: 'sphere', params: { radius: 16 } },
  { id: 'cone', type: 'cone', params: { radius: 16, height: 34 } },
  { id: 'torus', type: 'torus', params: { outerRadius: 18, tubeRadius: 5.5 } },
  { id: 'prism', type: 'prism', params: { radius: 16, height: 28, sides: 6 } },
  { id: 'text', type: 'text' },
];

/** Generadores del menú Insertar (y de la hoja Agregar en móvil). */
export const GENERATORS: readonly GeneratorId[] = ['svg', 'image', 'thread', 'calibration', 'assistants', 'magnet', 'screwBoss', 'keyhole'];

/** Nombre visible de cada entrada. */
export function insertLabelKey(id: InsertId): TranslationKey {
  switch (id) {
    case 'svg':
      return 'topbar.importSvg';
    case 'image':
      return 'topbar.imageTo3d';
    case 'thread':
      return 'sidebar.generators.thread';
    case 'calibration':
      return 'sidebar.shapes.createStarter';
    case 'assistants':
      return 'asis.title';
    case 'magnet':
      return 'magnet.title';
    case 'screwBoss':
      return 'turret.title';
    case 'keyhole':
      return 'keyhole.title';
    default:
      return `sidebar.primitive.${id}` as TranslationKey;
  }
}

/** Descripción (tooltip) de cada generador; las formas usan `r3a.insert.shapeTip` con su nombre. */
export function insertTipKey(id: InsertId): TranslationKey | null {
  switch (id) {
    case 'svg':
      return 'topbar.importSvgTip';
    case 'image':
      return 'topbar.imageTo3dTip';
    case 'thread':
      return 'sidebar.generators.threadTip';
    case 'text':
      return 'r3a.insert.textTip';
    case 'assistants':
      return 'asis.menuTip';
    case 'magnet':
      return 'magnet.menuTip';
    case 'screwBoss':
      return 'turret.menuTip';
    case 'keyhole':
      return 'keyhole.menuTip';
    default:
      return null;
  }
}

/** Panel de creación de Texto 3D (abierto o no). */
export const useText3DPanel = create<{ open: boolean }>(() => ({ open: false }));

export function setText3DPanelOpen(open: boolean): void {
  useText3DPanel.setState({ open });
}

let panelExclusionOff: (() => void) | null = null;

/**
 * Texto 3D, Asistentes y Alojamiento de imán comparten el mismo hueco de panel: abrir uno cierra los otros. Se arranca una sola vez desde
 * `App.tsx` (no al importar el módulo); llamarla de nuevo no duplica las suscripciones. Devuelve la función que las quita.
 */
export function startPanelExclusion(): () => void {
  if (!panelExclusionOff) {
    // Texto 3D, Asistentes y Alojamiento de imán: al abrir uno se cierran los otros.
    const panels = [
      { store: useText3DPanel, close: () => setText3DPanelOpen(false) },
      { store: useAssistantsPanel, close: closeAssistants },
      { store: useMagnetPanel, close: closeMagnetPanel },
      { store: useScrewBossPanel, close: closeScrewBossPanel },
      { store: useKeyholePanel, close: closeKeyholePanel },
    ];
    const offs = panels.map((panel) =>
      panel.store.subscribe((s: { open: boolean }, prev: { open: boolean }) => {
        if (!s.open || prev.open) return;
        for (const other of panels) if (other !== panel && other.store.getState().open) other.close();
      }),
    );
    panelExclusionOff = () => {
      offs.forEach((off) => off());
      panelExclusionOff = null;
    };
  }
  return panelExclusionOff;
}

/** Agrega la entrada elegida: crea la primitiva, abre el generador o el panel de Texto 3D. */
export async function runInsert(id: InsertId): Promise<void> {
  const state = useKuraStore.getState();
  if (id === 'text') {
    setText3DPanelOpen(true);
    return;
  }
  if (id === 'assistants') {
    openAssistants();
    return;
  }
  if (id === 'magnet') {
    openMagnetPanel();
    return;
  }
  if (id === 'screwBoss') {
    openScrewBossPanel();
    return;
  }
  if (id === 'keyhole') {
    openKeyholePanel();
    return;
  }
  if (id === 'svg' || id === 'image' || id === 'thread') {
    state.setActiveDialog(id);
    return;
  }
  if (id === 'calibration') {
    await state.createStarterCube();
    return;
  }
  const shape = SHAPES.find((s) => s.id === id);
  if (!shape) return;
  // El disco es un cilindro bajo: lleva su propio nombre para no llamarse «Cilindro».
  const label = id === 'disc' ? t(state.language, 'menu.shape.disc') : undefined;
  await state.createPrimitive(shape.type, shape.params, { placement: 'free', ...(label ? { label } : {}) });
}
