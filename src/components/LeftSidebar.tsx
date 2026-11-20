/**
 * @file src/components/LeftSidebar.tsx
 * @description Panel lateral izquierdo de Kura3D con dos pestañas:
 * 1) Formas / Primitivas paramétricas + Generadores 2D→3D (SVG e Imagen).
 * 2) Árbol de Escena (Outliner) con visibilidad, bloqueo, selección múltiple y acciones rápidas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Box,
  Circle,
  Cone,
  Copy,
  Cylinder,
  Disc,
  Eye,
  EyeOff,
  FileCode2,
  Hexagon,
  Image as ImageIcon,
  Layers,
  Lock,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { PrimitiveType } from '../types/kura';

export const LeftSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shapes' | 'scene'>('shapes');
  const [textDraft, setTextDraft] = useState('KURA3D');
  const [showTextBox, setShowTextBox] = useState(false);

  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const createStarterCube = useKuraStore((s) => s.createStarterCube);
  const clearScene = useKuraStore((s) => s.clearScene);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const selectObject = useKuraStore((s) => s.selectObject);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const deleteObjects = useKuraStore((s) => s.deleteObjects);

  const primitiveCards: Array<{
    type: PrimitiveType;
    icon: React.ReactNode;
    defaultParams?: Record<string, unknown>;
  }> = [
    { type: 'box', icon: <Box size={20} />, defaultParams: { width: 30, height: 30, depth: 30 } },
    { type: 'cylinder', icon: <Cylinder size={20} />, defaultParams: { radius: 14, height: 36 } },
    { type: 'tube', icon: <Disc size={20} />, defaultParams: { outerRadius: 16, innerRadius: 11, height: 36 } },
    { type: 'sphere', icon: <Circle size={20} />, defaultParams: { radius: 16 } },
    { type: 'cone', icon: <Cone size={20} />, defaultParams: { radius: 16, height: 34 } },
    { type: 'torus', icon: <Sparkles size={20} />, defaultParams: { outerRadius: 18, tubeRadius: 5.5 } },
    { type: 'prism', icon: <Hexagon size={20} />, defaultParams: { radius: 16, height: 28, sides: 6 } },
    { type: 'text', icon: <Type size={20} /> },
  ];

  const handlePrimitiveClick = async (type: PrimitiveType, params?: Record<string, unknown>) => {
    if (type === 'text') {
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

  return (
    <aside className="kura-sidebar-left" aria-label={t(language, 'sidebar.tab.shapes')}>
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
                onClick={() => setActiveDialog('svg')}
              >
                <FileCode2 size={15} />
                <span>{t(language, 'topbar.importSvg')}</span>
              </button>
              <button
                type="button"
                className="kura-btn"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => setActiveDialog('image')}
              >
                <ImageIcon size={15} />
                <span>{t(language, 'topbar.imageTo3d')}</span>
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

          {objects.length === 0 ? (
            <div className="kura-card" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {t(language, 'sidebar.scene.empty')}
            </div>
          ) : (
            <div className="kura-scene-list">
              {objects.map((obj) => {
                const isSelected = selectedIds.includes(obj.id);
                return (
                  <div
                    key={obj.id}
                    className={`kura-scene-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={(e) => selectObject(obj.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                  >
                    <div className="kura-scene-item-main">
                      <span
                        className="kura-color-dot"
                        style={{ backgroundColor: obj.isHole ? '#f97316' : obj.color }}
                      />
                      <span className="kura-scene-name" title={obj.name}>
                        {obj.name}
                      </span>
                      {obj.isHole && (
                        <span className="kura-hole-tag">
                          {t(language, 'sidebar.scene.holeBadge')}
                        </span>
                      )}
                    </div>

                    <div
                      className="kura-scene-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="kura-mini-icon-btn"
                        title={t(language, 'sidebar.scene.toggleVisible')}
                        onClick={() => updateObjectMeta(obj.id, { visible: !obj.visible })}
                      >
                        {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>

                      <button
                        type="button"
                        className="kura-mini-icon-btn"
                        title={t(language, 'sidebar.scene.toggleLock')}
                        onClick={() => updateObjectMeta(obj.id, { locked: !obj.locked })}
                      >
                        {obj.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>

                      <button
                        type="button"
                        className="kura-mini-icon-btn"
                        title={t(language, 'sidebar.scene.dropToBed')}
                        onClick={() => dropObjectToBed(obj.id)}
                      >
                        <ArrowDownToLine size={13} />
                      </button>

                      <button
                        type="button"
                        className="kura-mini-icon-btn"
                        title={t(language, 'sidebar.scene.duplicate')}
                        onClick={() => duplicateObjects([obj.id])}
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        className="kura-mini-icon-btn"
                        title={t(language, 'sidebar.scene.delete')}
                        disabled={obj.locked}
                        onClick={() => deleteObjects([obj.id])}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            {t(language, 'sidebar.scene.multiSelectHint')}
          </p>
        </div>
      )}
    </aside>
  );
};
