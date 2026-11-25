/**
 * @file src/components/LeftSidebar.tsx
 * @description Barra lateral izquierda de Kurra3D Studio: solo la Escena (resumen de filamentos, búsqueda y árbol de
 * objetos operable con teclado, `scene/SceneObjectList.tsx`, y «Vaciar cama» con su confirmación). Se muestra u
 * oculta con el tirador `LeftSidebarHandle`; oculta, el visor gana ese ancho. Las formas y generadores viven en
 * «Agregar» (barra vertical) e «Insertar» (barra superior). En pantallas estrechas es la hoja inferior: con la
 * pestaña «Agregar» muestra `AddSheet` (las mismas entradas) y con «Escena», el árbol.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isSolid } from '../core/scene/objectRole';
import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Trash2 } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { colorNameWithHex, distinctColorNames } from '../utils/colorNames';
import { tCount } from '../utils/plural';
import { AddSheet } from './AddSheet';
import { SceneObjectList } from './scene/SceneObjectList';
import { SceneSearch, useRevealSceneOnRequest } from './scene/SceneSearch';
import { confirmClearScene } from './confirmClearScene';
import { useLeftTabRequest } from './leftPanelTabRequest';
import { LeftSidebarHandle } from './LeftSidebarHandle';
import { useNarrowViewport } from './measure/useNarrowViewport';
import '../styles/panelEdge.css';
import '../styles/leftSidebarScene.css';

export const LeftSidebar: React.FC = () => {
  // Solo en pantalla estrecha hay dos contenidos (hoja Agregar o Escena); en escritorio siempre es la Escena.
  const [narrowTab, setNarrowTab] = useState<'shapes' | 'scene'>('shapes');
  useRevealSceneOnRequest(() => setNarrowTab('scene'));
  const leftTabRequest = useLeftTabRequest();
  useEffect(() => {
    if (leftTabRequest.tab) setNarrowTab(leftTabRequest.tab);
    // Solo reacciona a peticiones nuevas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftTabRequest.n]);

  const language = useKuraStore((s) => s.language);
  const leftSidebarMode = useKuraStore((s) => s.leftSidebarMode);
  const narrow = useNarrowViewport();
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);

  // Resumen de colores / filamentos únicos usados en los sólidos visibles de la escena
  const filamentColors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of objects) {
      if (!isSolid(obj)) continue;
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
  const legendNames = useMemo(() => distinctColorNames(language, filamentColors.map(([hex]) => hex)), [language, filamentColors]);

  const showAdd = narrow && narrowTab === 'shapes';
  const sceneTitle = t(language, 'r3a.sidebar.label');

  return (
    <aside
      id="kura-shapes-panel"
      className={`kura-sidebar-left ${leftSidebarMode === 'hidden' ? 'is-collapsed' : ''}`}
      data-mode={leftSidebarMode}
      aria-label={showAdd ? t(language, 'r3a.add.button') : sceneTitle}
    >
      <LeftSidebarHandle />

      {showAdd ? (
        <AddSheet />
      ) : (
        <div className="kura-scroll-area kura-scene-panel">
          <h2 className="kura-scene-panel-title">
            <Layers size={14} aria-hidden="true" />
            <span>{sceneTitle}</span>
          </h2>
          <div className="kura-field-row" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>{tCount(language, { one: 'sidebar.scene.objectsCount.one', other: 'sidebar.scene.objectsCount' }, objects.length)}</span>
            <span>{tCount(language, { one: 'sidebar.scene.selectedCount.one', other: 'sidebar.scene.selectedCount' }, selectedIds.length)}</span>
          </div>

          {/* Resumen de filamentos/colores activos en la escena */}
          {filamentColors.length > 0 && (
            <div className="kura-card" style={{ padding: 8, gap: 5 }}>
              <div className="kura-field-row" style={{ fontSize: 11 }}>
                <span className="kura-field-label">{t(language, 'scene.filamentLegend')}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {tCount(language, { one: 'scene.colorsCount.one', other: 'scene.colorsCount' }, filamentColors.length)}
                </span>
              </div>
              <div className="kura-filament-legend">
                {filamentColors.map(([hex, count]) => (
                  <span key={hex} className="kura-filament-chip" title={`${colorNameWithHex(language, hex)} (${count})`}>
                    <span className="kura-color-dot" style={{ backgroundColor: hex }} aria-hidden="true" />
                    <span>{legendNames.get(hex.toLowerCase())}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t(language, 'ux7.filament.pieces', { count })}</span>
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
            <>
              <SceneSearch />
              <SceneObjectList />
              <button
                type="button"
                className="kura-btn kura-btn-sm kura-btn-danger kura-scene-clear"
                title={t(language, 'sidebar.shapes.clearScene')}
                onClick={() => void confirmClearScene()}
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>{t(language, 'sidebar.shapes.clearScene')}</span>
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
