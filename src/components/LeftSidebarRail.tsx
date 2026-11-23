/**
 * @file src/components/LeftSidebarRail.tsx
 * @description Barra lateral izquierda en estado compacto (rail de 56 px, solo iconos): pestañas Formas y
 * Escena, primitivas, generadores y acciones rápidas, cada botón con nombre accesible y tooltip. La
 * pestaña Escena no cabe en 56 px: muestra un botón que expande la barra a completa en esa pestaña.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Bolt, Box, FileCode2, Image as ImageIcon, Layers, Maximize2, Shapes, Trash2 } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { confirmClearScene } from './confirmClearScene';

export interface RailPrimitive {
  id: string;
  icon: React.ReactNode;
  onCreate: () => void;
}

export const LeftSidebarRail: React.FC<{
  activeTab: 'shapes' | 'scene';
  onTab: (tab: 'shapes' | 'scene') => void;
  primitives: RailPrimitive[];
}> = ({ activeTab, onTab, primitives }) => {
  const language = useKuraStore((s) => s.language);
  const objectCount = useKuraStore((s) => s.objects.length);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const createStarterCube = useKuraStore((s) => s.createStarterCube);
  const setLeftSidebarMode = useKuraStore((s) => s.setLeftSidebarMode);
  const shapesLabel = t(language, 'sidebar.tab.shapes');
  const sceneLabel = `${t(language, 'sidebar.tab.scene')} (${objectCount})`;
  const expandLabel = t(language, 'ux6.sidebar.expandScene', { count: objectCount });

  const iconBtn = (key: string, label: string, tip: string, icon: React.ReactNode, onClick: () => void, extra?: { danger?: boolean; disabled?: boolean }) => (
    <button
      key={key}
      type="button"
      className={`kura-btn kura-btn-icon${extra?.danger ? ' kura-btn-danger' : ''}`}
      title={tip}
      aria-label={label}
      disabled={extra?.disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <div className="kura-compact-rail" data-testid="left-sidebar-rail">
      <div role="tablist" style={{ display: 'contents' }}>
        {(['shapes', 'scene'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`kura-btn kura-btn-icon ${activeTab === tab ? 'is-active' : ''}`}
            title={tab === 'shapes' ? shapesLabel : sceneLabel}
            aria-label={tab === 'shapes' ? shapesLabel : sceneLabel}
            onClick={() => onTab(tab)}
          >
            {tab === 'shapes' ? <Shapes size={16} /> : <Layers size={16} />}
          </button>
        ))}
      </div>
      <div className="kura-compact-rail-sep" />

      {activeTab === 'scene' ? (
        iconBtn('expand', expandLabel, expandLabel, <Maximize2 size={16} />, () => setLeftSidebarMode('full'))
      ) : (
        <>
          {primitives.map((item) => {
            const name = t(language, `sidebar.primitive.${item.id}` as TranslationKey);
            return iconBtn(item.id, name, `${name} (+)`, <span className="kura-primitive-icon">{item.icon}</span>, item.onCreate);
          })}
          <div className="kura-compact-rail-sep" />
          {iconBtn('svg', t(language, 'topbar.importSvg'), t(language, 'topbar.importSvgTip'), <FileCode2 size={16} />, () => setActiveDialog('svg'))}
          {iconBtn('image', t(language, 'topbar.imageTo3d'), t(language, 'topbar.imageTo3dTip'), <ImageIcon size={16} />, () => setActiveDialog('image'))}
          {iconBtn('thread', t(language, 'sidebar.generators.thread'), t(language, 'sidebar.generators.threadTip'), <Bolt size={16} />, () => setActiveDialog('thread'))}
          <div className="kura-compact-rail-sep" />
          {iconBtn('starter', t(language, 'sidebar.shapes.createStarter'), t(language, 'sidebar.shapes.createStarter'), <Box size={16} />, () => void createStarterCube())}
          {iconBtn('clear', t(language, 'sidebar.shapes.clearScene'), t(language, 'sidebar.shapes.clearScene'), <Trash2 size={16} />, () => void confirmClearScene(), { danger: true, disabled: objectCount === 0 })}
        </>
      )}
    </div>
  );
};
