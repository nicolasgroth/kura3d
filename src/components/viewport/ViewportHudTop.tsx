/**
 * @file src/components/viewport/ViewportHudTop.tsx
 * @description HUD superior del visor: vistas de cámara, rejilla, Rayos X, modos del gizmo y herramientas de pintura/borrado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import {
  Camera,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  Scale3d,
  Scissors,
  X,
} from 'lucide-react';
import { t } from '../../i18n';
import { type CameraPresetType, useKuraStore } from '../../store/useKuraStore';
import { PaintToolbar } from './PaintToolbar';
import { ToastStack } from '../ToastStack';
import { SectionViewNotice } from './SectionViewNotice';
import '../../styles/sectionNotice.css';
import { formatDimension } from '../../utils/units';
import { tCount } from '../../utils/plural';

/** Stack superior del HUD (evita colisiones cuando se envuelven controles). */
export const ViewportHudTop: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const setSnapGridMm = useKuraStore((s) => s.setSnapGridMm);
  const sectionPlane = useKuraStore((s) => s.sectionPlane);
  const setSectionPlane = useKuraStore((s) => s.setSectionPlane);
  const requestCameraPreset = useKuraStore((s) => s.requestCameraPreset);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const eraseRadiusMm = useKuraStore((s) => s.eraseRadiusMm);
  const setEraseRadiusMm = useKuraStore((s) => s.setEraseRadiusMm);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const selectedObj = objects.find((o) => o.id === selectedIds[0]) ?? null;
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;
  const maxSceneHeight = useMemo(() => {
    let maxH = printerProfile.maxHeightMm;
    for (const obj of objects) {
      const top = obj.position[1] + obj.stats.dimensionsMm[1] * obj.scale[1];
      if (top > maxH) maxH = Math.ceil(top);
    }
    return Math.max(40, maxH);
  }, [objects, printerProfile.maxHeightMm]);

  return (
    <div className="kura-hud-top-stack">
      {uiDensity === 'zen' && (
        <button
          type="button"
          className="kura-zen-exit-pill"
          onClick={() => useKuraStore.getState().setUiDensity('full')}
        >
          <Minimize2 size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{t(language, 'ui.zen.exit')}</span>
        </button>
      )}

      <div className="kura-hud-top-bar">
        <div className="kura-hud-bar">
          <div className="kura-hud-card">
            <Camera size={13} style={{ color: 'var(--tool-accent)' }} />
            {(['iso', 'top', 'front', 'right'] as CameraPresetType[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className="kura-btn kura-btn-sm"
                onClick={() => requestCameraPreset(preset)}
                title={t(language, `viewport.camera.${preset}`)}
              >
                {t(language, `viewport.camera.${preset}`)}
              </button>
            ))}
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              onClick={() => requestCameraPreset('fit')}
              title={t(language, 'viewport.camera.fit')}
            >
              <Maximize2 size={13} />
              <span>{t(language, 'viewport.camera.fit')}</span>
            </button>
          </div>

          <div className="kura-hud-card">
            <span className="kura-field-label">{t(language, 'viewport.snapLabel')}</span>
            <select
              className="kura-select"
              style={{ height: 26 }}
              value={snapGridMm}
              onChange={(e) => setSnapGridMm(Number(e.target.value))}
              aria-label={t(language, 'viewport.snapLabel')}
            >
              <option value={0}>{t(language, 'viewport.snapOff')}</option>
              <option value={0.5}>0.5 mm</option>
              <option value={1}>1 mm</option>
              <option value={5}>5 mm</option>
              <option value={10}>10 mm</option>
            </select>
          </div>

          {/* Control en vivo de Rayos X / Plano de Sección */}
          <div className="kura-hud-card">
            <button
              type="button"
              className={`kura-btn kura-btn-sm ${sectionPlane.enabled ? 'is-active' : ''}`}
              onClick={() => setSectionPlane({ enabled: !sectionPlane.enabled })}
              title={t(language, 'viewport.section.toggleTip')}
            >
              <Layers size={13} />
              <span>{t(language, 'viewport.section.toggle')}</span>
            </button>
            {sectionPlane.enabled && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <input
                  type="range"
                  min={0}
                  max={maxSceneHeight}
                  step={0.5}
                  value={sectionPlane.heightMm}
                  title={t(language, 'ui.sliderResetTip')}
                  onDoubleClick={() => setSectionPlane({ heightMm: 25 })}
                  onChange={(e) => setSectionPlane({ heightMm: Number(e.target.value) })}
                  aria-label={t(language, 'viewport.section.height')}
                />
                <span style={{ fontFamily: 'monospace', minWidth: 46 }}>
                  {formatDimension(sectionPlane.heightMm, unitSystem, 1)}
                </span>
              </label>
            )}
          </div>
        </div>

        {/* El gizmo de transformación no aplica mientras se pinta: se oculta para no confundir. */}
        {activeTool !== 'paint' && (
        <div className="kura-hud-card">
          <div className="kura-segmented">
            <button
              type="button"
              className={`kura-btn ${transformMode === 'translate' ? 'is-active' : ''}`}
              onClick={() => setTransformMode('translate')}
              title={t(language, 'viewport.gizmo.translate')}
            >
              <Move size={13} />
              <span>{t(language, 'viewport.gizmo.translate')}</span>
            </button>
            <button
              type="button"
              className={`kura-btn ${transformMode === 'rotate' ? 'is-active' : ''}`}
              onClick={() => setTransformMode('rotate')}
              title={t(language, 'viewport.gizmo.rotate')}
            >
              <RotateCw size={13} />
              <span>{t(language, 'viewport.gizmo.rotate')}</span>
            </button>
            <button
              type="button"
              className={`kura-btn ${transformMode === 'scale' ? 'is-active' : ''}`}
              onClick={() => setTransformMode('scale')}
              title={t(language, 'viewport.gizmo.scale')}
            >
              <Scale3d size={13} />
              <span>{t(language, 'viewport.gizmo.scale')}</span>
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Píldora booleana inteligente: aparece cuando existen huecos + sólidos */}
      {holeCount > 0 && solidCount > 0 && (
        <button
          type="button"
          className="kura-hud-card kura-boolean-fab"
          disabled={Boolean(busyOperation)}
          onClick={() => void applyHolesOnSolids()}
          title={tCount(language, { one: 'inspector.op.applyBooleansN.one', other: 'inspector.op.applyBooleansN.other' }, holeCount)}
        >
          <Scissors size={14} />
          <span>{tCount(language, { one: 'inspector.op.applyBooleansN.one', other: 'inspector.op.applyBooleansN.other' }, holeCount)}</span>
        </button>
      )}

      {/* Barra contextual de herramientas (Pintar / Tallar / Cortar) */}
      {activeTool === 'paint' && <PaintToolbar />}

      {activeTool === 'erase' && (
        <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <span>{t(language, 'viewport.erase.radius')}: {eraseRadiusMm} mm</span>
            <input
              type="range"
              min={1}
              max={25}
              step={0.5}
              value={eraseRadiusMm}
              onChange={(e) => setEraseRadiusMm(Number(e.target.value))}
            />
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t(language, 'viewport.erase.hint')}
          </span>
        </div>
      )}

      {activeTool === 'cut' && (
        <div className="kura-hud-card" style={{ gap: 10, alignSelf: 'flex-start' }}>
          <span style={{ fontSize: 11.5 }}>{t(language, 'viewport.cut.hint')}</span>
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-btn-primary"
            disabled={!selectedObj}
            onClick={() => setActiveDialog('cut')}
          >
            <Scissors size={13} />
            <span>{t(language, 'viewport.cut.openDialog')}</span>
          </button>
        </div>
      )}

      {/* Aviso de sección y toasts en la misma columna: se apilan en vez de montarse. */}
      <SectionViewNotice />
      <ToastStack />
    </div>
  );
};
