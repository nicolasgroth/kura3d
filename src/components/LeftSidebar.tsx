/**
 * @file src/components/LeftSidebar.tsx
 * @description Panel lateral izquierdo de Kura3D:
 * - Adaptable a modo Expandido (268px), Compacto (rail vertical de íconos 56px con tooltips) y colapsado.
 * - Pestaña Formas: Primitivas paramétricas + Generadores 2D/Pro → 3D (SVG, Imagen, Rosca ISO M3–M20).
 * - Pestaña Escena (Outliner): resumen de filamentos/colores y lista de objetos operable con teclado
 *   (`scene/SceneObjectList.tsx`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo, useState } from 'react';
import {
  Bolt,
  Box,
  ChevronLeft,
  ChevronRight,
  Circle,
  Cone,
  Cylinder,
  Disc,
  FileCode2,
  Hexagon,
  Image as ImageIcon,
  Layers,
  Shapes,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { PrimitiveType } from '../types/kura';
import { colorName, colorNameWithHex } from '../utils/colorNames';
import { tCount } from '../utils/plural';
import { SceneObjectList } from './scene/SceneObjectList';

export const LeftSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shapes' | 'scene'>('shapes');
  const [textDraft, setTextDraft] = useState('KURA3D');
  const [showTextBox, setShowTextBox] = useState(false);

  const language = useKuraStore((s) => s.language);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const leftCollapsed = useKuraStore((s) => s.leftCollapsed);
  const toggleLeftSidebar = useKuraStore((s) => s.toggleLeftSidebar);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const createStarterCube = useKuraStore((s) => s.createStarterCube);
  const clearScene = useKuraStore((s) => s.clearScene);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  // Resumen de colores / filamentos únicos usados en los sólidos visibles de la escena
  const filamentColors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of objects) {
      if (obj.isHole) continue;
      if (obj.mesh.faceColors && obj.mesh.faceColors.length > 0) {
        const distinct = new Set(obj.mesh.faceColors.map((c) => c.toLowerCase()));
        for (const hex of distinct) {
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
      } else {
        const hex = obj.color.toLowerCase();
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries());
  }, [objects]);

  const primitiveCards: Array<{
    type: PrimitiveType;
    icon: React.ReactNode;
    defaultParams?: Record<string, unknown>;
  }> = [
    { type: 'box', icon: <Box size={19} />, defaultParams: { width: 30, height: 30, depth: 30 } },
    { type: 'cylinder', icon: <Cylinder size={19} />, defaultParams: { radius: 14, height: 36 } },
    { type: 'tube', icon: <Disc size={19} />, defaultParams: { outerRadius: 16, innerRadius: 11, height: 36 } },
    { type: 'sphere', icon: <Circle size={19} />, defaultParams: { radius: 16 } },
    { type: 'cone', icon: <Cone size={19} />, defaultParams: { radius: 16, height: 34 } },
    { type: 'torus', icon: <Sparkles size={19} />, defaultParams: { outerRadius: 18, tubeRadius: 5.5 } },
    { type: 'prism', icon: <Hexagon size={19} />, defaultParams: { radius: 16, height: 28, sides: 6 } },
    { type: 'text', icon: <Type size={19} /> },
  ];

  const handlePrimitiveClick = async (type: PrimitiveType, params?: Record<string, unknown>) => {
    if (type === 'text') {
      if (uiDensity === 'compact') {
        await createPrimitive('text', { text: textDraft.trim() || 'KURA3D', fontSize: 18, height: 6 });
        return;
      }
      setShowTextBox((prev) => !prev);
      return;
    }
    await createPrimitive(type, params);
  };

  const handleCreateText = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = textDraft.trim() || 'KURA3D';
    await createPrimitive('text', { text: cleaned, fontSize: 18, height: 6 }, { name: `Texto "${cleaned}"` });
    setShowTextBox(false);
  };

  const isCompactRail = uiDensity === 'compact';

  return (
    <aside
      id="kura-shapes-panel"
      className={`kura-sidebar-left ${leftCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t(language, 'sidebar.tab.shapes')}
    >
      {/* Botón delgado en el borde para colapsar/expandir independientemente */}
      <button
        type="button"
        className="kura-panel-edge-btn is-left"
        onClick={toggleLeftSidebar}
        title={
          leftCollapsed
            ? t(language, 'ui.panel.expandLeft')
            : t(language, 'ui.panel.collapseLeft')
        }
        aria-label={
          leftCollapsed
            ? t(language, 'ui.panel.expandLeft')
            : t(language, 'ui.panel.collapseLeft')
        }
      >
        {leftCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {isCompactRail ? (
        <div className="kura-compact-rail">
          {primitiveCards.map((item) => (
            <button
              key={item.type}
              type="button"
              className="kura-btn kura-btn-icon"
              title={`${t(language, `sidebar.primitive.${item.type}`)} (+)`}
              aria-label={t(language, `sidebar.primitive.${item.type}`)}
              onClick={() => void handlePrimitiveClick(item.type, item.defaultParams)}
            >
              <span className="kura-primitive-icon">{item.icon}</span>
            </button>
          ))}

          <div className="kura-compact-rail-sep" />

          <button
            type="button"
            className="kura-btn kura-btn-icon"
            title={t(language, 'topbar.importSvgTip')}
            aria-label={t(language, 'topbar.importSvg')}
            onClick={() => setActiveDialog('svg')}
          >
            <FileCode2 size={16} />
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-icon"
            title={t(language, 'topbar.imageTo3dTip')}
            aria-label={t(language, 'topbar.imageTo3d')}
            onClick={() => setActiveDialog('image')}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-icon"
            title={t(language, 'sidebar.generators.threadTip')}
            aria-label={t(language, 'sidebar.generators.thread')}
            onClick={() => setActiveDialog('thread')}
          >
            <Bolt size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="kura-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'shapes'}
              className={`kura-tab-btn ${activeTab === 'shapes' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('shapes')}
            >
              <Shapes size={14} />
              <span>{t(language, 'sidebar.tab.shapes')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'scene'}
              className={`kura-tab-btn ${activeTab === 'scene' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('scene')}
            >
              <Layers size={14} />
              <span>
                {t(language, 'sidebar.tab.scene')} ({objects.length})
              </span>
            </button>
          </div>

          {activeTab === 'shapes' ? (
            <div className="kura-scroll-area">
              <section>
                <h2 className="kura-section-label">
                  {t(language, 'sidebar.shapes.primitivesTitle')}
                </h2>
                <div className="kura-primitive-grid">
                  {primitiveCards.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="kura-primitive-card"
                      title={`${t(language, `sidebar.primitive.${item.type}`)} (+)`}
                      onClick={() => void handlePrimitiveClick(item.type, item.defaultParams)}
                    >
                      <span className="kura-primitive-icon">{item.icon}</span>
                      <span>{t(language, `sidebar.primitive.${item.type}`)}</span>
                    </button>
                  ))}
                </div>

                {showTextBox && (
                  <form className="kura-card" style={{ marginTop: 8 }} onSubmit={handleCreateText}>
                    <label className="kura-field-label" htmlFor="kura-text3d-input">
                      {t(language, 'sidebar.textPrompt')}
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        id="kura-text3d-input"
                        className="kura-input"
                        style={{ flex: 1 }}
                        value={textDraft}
                        onChange={(e) => setTextDraft(e.target.value)}
                        maxLength={24}
                      />
                      <button type="submit" className="kura-btn kura-btn-sm kura-btn-primary">
                        OK
                      </button>
                    </div>
                  </form>
                )}
              </section>

              <section>
                <h2 className="kura-section-label">
                  {t(language, 'sidebar.shapes.generatorsTitle')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    className="kura-btn"
                    style={{ justifyContent: 'flex-start' }}
                    title={t(language, 'topbar.importSvgTip')}
                    onClick={() => setActiveDialog('svg')}
                  >
                    <FileCode2 size={15} />
                    <span>{t(language, 'topbar.importSvg')}</span>
                  </button>
                  <button
                    type="button"
                    className="kura-btn"
                    style={{ justifyContent: 'flex-start' }}
                    title={t(language, 'topbar.imageTo3dTip')}
                    onClick={() => setActiveDialog('image')}
                  >
                    <ImageIcon size={15} />
                    <span>{t(language, 'topbar.imageTo3d')}</span>
                  </button>
                  <button
                    type="button"
                    className="kura-btn"
                    style={{ justifyContent: 'flex-start' }}
                    title={t(language, 'sidebar.generators.threadTip')}
                    onClick={() => setActiveDialog('thread')}
                  >
                    <Bolt size={15} style={{ color: 'var(--accent-cyan)' }} />
                    <span>{t(language, 'sidebar.generators.thread')}</span>
                  </button>
                </div>
              </section>

              <section>
                <h2 className="kura-section-label">
                  {t(language, 'sidebar.shapes.quickActionsTitle')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    className="kura-btn kura-btn-sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => void createStarterCube()}
                  >
                    <Box size={14} />
                    <span>{t(language, 'sidebar.shapes.createStarter')}</span>
                  </button>
                  <button
                    type="button"
                    className="kura-btn kura-btn-sm kura-btn-danger"
                    style={{ justifyContent: 'flex-start' }}
                    disabled={objects.length === 0}
                    onClick={clearScene}
                  >
                    <Trash2 size={14} />
                    <span>{t(language, 'sidebar.shapes.clearScene')}</span>
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="kura-scroll-area">
              <div className="kura-field-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>{t(language, 'sidebar.scene.objectsCount', { count: objects.length })}</span>
                <span>{t(language, 'sidebar.scene.selectedCount', { count: selectedIds.length })}</span>
              </div>

              {/* Resumen de filamentos/colores activos en la escena */}
              {filamentColors.length > 0 && (
                <div className="kura-card" style={{ padding: 8, gap: 5 }}>
                  <div className="kura-field-row" style={{ fontSize: 10.5 }}>
                    <span className="kura-field-label">{t(language, 'scene.filamentLegend')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {tCount(language, { one: 'scene.colorsCount.one', other: 'scene.colorsCount' }, filamentColors.length)}
                    </span>
                  </div>
                  <div className="kura-filament-legend">
                    {filamentColors.map(([hex, count]) => (
                      <span key={hex} className="kura-filament-chip" title={`${colorNameWithHex(language, hex)} (${count})`}>
                        <span className="kura-color-dot" style={{ backgroundColor: hex }} aria-hidden="true" />
                        <span>{colorName(language, hex)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {objects.length === 0 ? (
                <div className="kura-card" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {t(language, 'sidebar.scene.empty')}
                </div>
              ) : (
                <SceneObjectList />
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
};
