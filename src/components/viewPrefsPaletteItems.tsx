/**
 * @file src/components/viewPrefsPaletteItems.tsx
 * @description Entradas de la paleta de comandos para las preferencias de vista: vista sin cama y los
 * tres estados de la barra lateral izquierda. Se leen y cambian en el store al ejecutarse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { EyeOff, Grid2x2X, PanelLeft, PanelLeftClose } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { LanguageCode } from '../types/kura';

export interface ViewPrefsPaletteItem {
  id: string;
  label: string;
  category: string;
  keywords: string;
  shortcut?: string;
  kind: 'local';
  icon: React.ReactNode;
  run: () => void;
}

export function viewPrefsPaletteItems(language: LanguageCode, category: string, showBed: boolean): ViewPrefsPaletteItem[] {
  const set = (mode: 'full' | 'compact' | 'hidden') => () => useKuraStore.getState().setLeftSidebarMode(mode);
  return [
    {
      id: 'view-bed',
      label: t(language, showBed ? 'ux6.bed.cmdHide' : 'ux6.bed.cmdShow'),
      category,
      keywords: 'cama rejilla placa volumen flotando sin cama bed grid floating hide',
      shortcut: 'B',
      kind: 'local',
      icon: <Grid2x2X size={15} />,
      run: () => useKuraStore.getState().toggleShowBed(),
    },
    {
      id: 'view-sidebar-full',
      label: t(language, 'ux6.sidebar.cmdFull'),
      category,
      keywords: 'barra lateral completa formas escena sidebar full',
      kind: 'local',
      icon: <PanelLeft size={15} />,
      run: set('full'),
    },
    {
      id: 'view-sidebar-compact',
      label: t(language, 'ux6.sidebar.cmdCompact'),
      category,
      keywords: 'barra lateral compacta iconos rail sidebar compact icons',
      kind: 'local',
      icon: <PanelLeftClose size={15} />,
      run: set('compact'),
    },
    {
      id: 'view-sidebar-hidden',
      label: t(language, 'ux6.sidebar.cmdHidden'),
      category,
      keywords: 'barra lateral ocultar esconder sidebar hide',
      kind: 'local',
      icon: <EyeOff size={15} />,
      run: set('hidden'),
    },
  ];
}
