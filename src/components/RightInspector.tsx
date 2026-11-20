/**
 * @file src/components/RightInspector.tsx
 * @description Inspector paramétrico derecho de Kura3D: identidad, colores, transformaciones
 * en la unidad activa, métricas Manifold en vivo y operaciones 3D determinísticas (ahuecado,
 * booleanas CSG, corte con conectores, separación por islas/colores y texturas procedurales).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import * as THREE from 'three';
import {
  ArrowDownToLine,
  Combine,
  Crosshair,
  MinusCircle,
  Palette,
  RotateCcw,
  Scissors,
  Sparkles,
  Split,
  Zap,
} from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import {
  PRINT_COLOR_PALETTE,
  type TexturePatternType,
  type Vec3,
} from '../types/kura';
import {
  formatDimension,
  formatVolume,
  fromMm,
  getUnitLabel,
  getUnitStep,
  toMm,
} from '../utils/units';

export const RightInspector: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);

  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const centerObjectOnBed = useKuraStore((s) => s.centerObjectOnBed);
  const resetObjectOrientation = useKuraStore((s) => s.resetObjectOrientation);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const addSubtractHelperPrimitive = useKuraStore((s) => s.addSubtractHelperPrimitive);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const splitObjectByColor = useKuraStore((s) => s.splitObjectByColor);
  const applyTextureToObject = useKuraStore((s) => s.applyTextureToObject);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);

  // Estados locales para parámetros de operaciones Manifold
  const [wallThicknessMm, setWallThicknessMm] = useState(2.2);
  const [drainHole, setDrainHole] = useState(false);
  const [drainRadiusMm, setDrainRadiusMm] = useState(4);

  const [texturePattern, setTexturePattern] = useState<TexturePatternType>('fuzzy');
  const [textureDepthMm, setTextureDepthMm] = useState(0.45);
  const [textureScaleMm, setTextureScaleMm] = useState(4);

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const primary = selectedObjects[0] ?? null;
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;
  const hasAnyHoles = holeCount > 0;
  const isBusy = Boolean(busyOperation);

  if (selectedObjects.length === 0) {
    return (
      <aside className="kura-sidebar-right" aria-label={t(language, 'inspector.title')}>
        <div className="kura-panel-header">{t(language, 'inspector.title')}</div>
        <div className="kura-scroll-area">
          <div className="kura-card">
            <strong>{t(language, 'inspector.emptyTitle')}</strong>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(language, 'inspector.emptyDesc')}
            </p>
          </div>

          {hasAnyHoles && (
            <div className="kura-card">
              <h3 className="kura-section-label">{t(language, 'inspector.op.booleanTitle')}</h3>
              <button
                type="button"
                className="kura-btn kura-btn-amber"
                disabled={isBusy}
                onClick={() => void applyHolesOnSolids()}
              >
                <Combine size={14} />
                <span>{t(language, 'inspector.op.applyHoles')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Multi-selección (2+ objetos): enfocada en Booleanas CSG
  if (selectedObjects.length >= 2) {
    return (
      <aside className="kura-sidebar-right" aria-label={t(language, 'inspector.title')}>
        <div className="kura-panel-header">{t(language, 'inspector.title')}</div>
        <div className="kura-scroll-area">
          <div className="kura-card">
            <strong>
              {t(language, 'inspector.multiTitle', { count: selectedObjects.length })}
            </strong>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(language, 'inspector.multiDesc')}
            </p>
          </div>

          <div className="kura-card">
            <h3 className="kura-section-label">{t(language, 'inspector.op.booleanTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <button
                type="button"
                className="kura-btn kura-btn-primary"
                disabled={isBusy}
                onClick={() => void runBooleanOnSelection('union')}
              >
                {t(language, 'inspector.op.union')}
              </button>
              <button
                type="button"
                className="kura-btn kura-btn-amber"
                disabled={isBusy}
                onClick={() => void runBooleanOnSelection('subtract')}
              >
                {t(language, 'inspector.op.subtract')}
              </button>
              <button
                type="button"
                className="kura-btn"
                disabled={isBusy}
                onClick={() => void runBooleanOnSelection('intersect')}
              >
                {t(language, 'inspector.op.intersect')}
              </button>
            </div>

            {hasAnyHoles && (
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy}
                onClick={() => void applyHolesOnSolids()}
              >
                <Combine size={14} />
                <span>{t(language, 'inspector.op.applyHoles')}</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  // Un solo objeto seleccionado
  if (!primary) return null;

  const stepUnit = getUnitStep(unitSystem);
  const unitLabel = getUnitLabel(unitSystem);

  const handlePosChange = (axisIdx: 0 | 1 | 2, rawValue: string) => {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return;
    const nextPos: Vec3 = [...primary.position] as Vec3;
    nextPos[axisIdx] = toMm(num, unitSystem);
    setObjectTransform(primary.id, { position: nextPos }, true);
  };

  const handleRotChange = (axisIdx: 0 | 1 | 2, rawDeg: string) => {
    const deg = Number(rawDeg);
    if (!Number.isFinite(deg)) return;
    const nextRot: Vec3 = [...primary.rotation] as Vec3;
    nextRot[axisIdx] = THREE.MathUtils.degToRad(deg);
    setObjectTransform(primary.id, { rotation: nextRot }, true);
  };

  const handleScaleChange = (axisIdx: 0 | 1 | 2, rawScale: string) => {
    const factor = Number(rawScale);
    if (!Number.isFinite(factor) || factor <= 0.01) return;
    const nextScale: Vec3 = [...primary.scale] as Vec3;
    nextScale[axisIdx] = factor;
    setObjectTransform(primary.id, { scale: nextScale }, true);
  };

  const scaledDims: Vec3 = [
    primary.stats.dimensionsMm[0] * primary.scale[0],
    primary.stats.dimensionsMm[1] * primary.scale[1],
    primary.stats.dimensionsMm[2] * primary.scale[2],
  ];
  const scaledVolumeMm3 =
    primary.stats.volumeMm3 * primary.scale[0] * primary.scale[1] * primary.scale[2];

  return (
    <aside className="kura-sidebar-right" aria-label={t(language, 'inspector.title')}>
      <div className="kura-panel-header">
        <span>{t(language, 'inspector.title')}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {primary.source.toUpperCase()}
        </span>
      </div>

      <div className="kura-scroll-area">
        {/* 1. Identidad y Material */}
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.section.identity')}</h3>

          <div className="kura-form-field">
            <label htmlFor="kura-obj-name">{t(language, 'inspector.field.name')}</label>
            <input
              id="kura-obj-name"
              className="kura-input"
              value={primary.name}
              onChange={(e) => updateObjectMeta(primary.id, { name: e.target.value })}
            />
          </div>

          <div className="kura-field-row">
            <span className="kura-field-label">{t(language, 'inspector.field.role')}</span>
            <div className="kura-segmented">
              <button
                type="button"
                className={`kura-btn ${!primary.isHole ? 'is-active' : ''}`}
                onClick={() => updateObjectMeta(primary.id, { isHole: false })}
              >
                {t(language, 'inspector.role.solid')}
              </button>
              <button
                type="button"
                className={`kura-btn ${primary.isHole ? 'is-active' : ''}`}
                onClick={() => updateObjectMeta(primary.id, { isHole: true })}
                title={t(language, 'inspector.role.holeTip')}
              >
                {t(language, 'inspector.role.hole')}
              </button>
            </div>
          </div>

          <div className="kura-form-field">
            <label>{t(language, 'inspector.field.color')}</label>
            <div className="kura-swatch-row">
              {PRINT_COLOR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`kura-swatch ${primary.color === hex ? 'is-active' : ''}`}
                  style={{ backgroundColor: hex }}
                  onClick={() => updateObjectMeta(primary.id, { color: hex })}
                  aria-label={hex}
                  title={hex}
                />
              ))}
              <input
                type="color"
                className="kura-swatch-custom"
                value={primary.color}
                onChange={(e) => updateObjectMeta(primary.id, { color: e.target.value })}
                aria-label={t(language, 'inspector.field.color')}
                title={t(language, 'inspector.field.color')}
              />
            </div>
          </div>
        </section>

        {/* 2. Transformación en la unidad activa */}
        <section className="kura-card">
          <h3 className="kura-section-label">
            {t(language, 'inspector.section.transform', { unit: unitLabel })}
          </h3>

          <div className="kura-form-field">
            <label>{t(language, 'inspector.field.position')}</label>
            <div className="kura-vec3-grid">
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <div key={axis} className="kura-axis-input">
                  <span className={`kura-axis-tag ${axis}`}>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step={stepUnit}
                    disabled={primary.locked}
                    value={Number(fromMm(primary.position[idx], unitSystem).toFixed(2))}
                    onChange={(e) => handlePosChange(idx as 0 | 1 | 2, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="kura-form-field">
            <label>{t(language, 'inspector.field.rotation')}</label>
            <div className="kura-vec3-grid">
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <div key={axis} className="kura-axis-input">
                  <span className={`kura-axis-tag ${axis}`}>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step={5}
                    disabled={primary.locked}
                    value={Number(THREE.MathUtils.radToDeg(primary.rotation[idx]).toFixed(1))}
                    onChange={(e) => handleRotChange(idx as 0 | 1 | 2, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="kura-form-field">
            <label>{t(language, 'inspector.field.scale')}</label>
            <div className="kura-vec3-grid">
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <div key={axis} className="kura-axis-input">
                  <span className={`kura-axis-tag ${axis}`}>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.05}
                    disabled={primary.locked}
                    value={Number(primary.scale[idx].toFixed(2))}
                    onChange={(e) => handleScaleChange(idx as 0 | 1 | 2, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={primary.locked}
              onClick={() => dropObjectToBed(primary.id)}
            >
              <ArrowDownToLine size={13} />
              <span>{t(language, 'inspector.action.dropToBed')}</span>
            </button>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={primary.locked}
              onClick={() => centerObjectOnBed(primary.id)}
            >
              <Crosshair size={13} />
              <span>{t(language, 'inspector.action.centerBed')}</span>
            </button>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={primary.locked}
              onClick={() => resetObjectOrientation(primary.id)}
            >
              <RotateCcw size={13} />
              <span>{t(language, 'inspector.action.resetTransform')}</span>
            </button>
          </div>
        </section>

        {/* 3. Geometría y Métricas */}
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.section.stats')}</h3>
          <div className="kura-stats-grid">
            <div className="kura-stat-box" style={{ gridColumn: '1 / -1' }}>
              <div className="kura-stat-title">{t(language, 'inspector.stats.dimensions')}</div>
              <div className="kura-stat-val">
                {formatDimension(scaledDims[0], unitSystem)} ×{' '}
                {formatDimension(scaledDims[1], unitSystem)} ×{' '}
                {formatDimension(scaledDims[2], unitSystem)}
              </div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.stats.volume')}</div>
              <div className="kura-stat-val">{formatVolume(scaledVolumeMm3, unitSystem)}</div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.stats.triangles')}</div>
              <div className="kura-stat-val">{primary.stats.triangles.toLocaleString()}</div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.stats.vertices')}</div>
              <div className="kura-stat-val">{primary.stats.vertices.toLocaleString()}</div>
            </div>
            <div className="kura-stat-box">
              <div className="kura-stat-title">{t(language, 'inspector.stats.manifold')}</div>
              <div
                className={`kura-stat-val ${
                  primary.stats.isManifold ? 'kura-badge-ok' : 'kura-badge-warn'
                }`}
              >
                {primary.stats.isManifold
                  ? t(language, 'inspector.stats.watertight')
                  : t(language, 'inspector.stats.nonManifold')}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Operaciones 3D determinísticas (Manifold) */}
        <section className="kura-card">
          <div className="kura-field-row" style={{ marginBottom: 2 }}>
            <h3 className="kura-section-label" style={{ margin: 0 }}>
              {t(language, 'inspector.section.operations')}
            </h3>
            <span
              className="kura-source-pill is-local"
              title={t(language, 'badge.local100Tip')}
            >
              <Zap size={10} />
              <span>{t(language, 'badge.local100')}</span>
            </span>
          </div>

          {/* Estructura rápida de resta en 1 clic */}
          <div className="kura-form-field">
            <label>{t(language, 'inspector.op.quickSubtractTitle')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy}
                title={t(language, 'inspector.op.subtractSphereTip')}
                onClick={() => void addSubtractHelperPrimitive('sphere', primary.id)}
              >
                <MinusCircle size={13} />
                <span>{t(language, 'inspector.op.subtractSphere')}</span>
              </button>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy}
                title={t(language, 'inspector.op.subtractCylinderTip')}
                onClick={() => void addSubtractHelperPrimitive('cylinder', primary.id)}
              >
                <MinusCircle size={13} />
                <span>{t(language, 'inspector.op.subtractCylinder')}</span>
              </button>
            </div>
            {hasAnyHoles && solidCount > 0 && (
              <button
                type="button"
                className="kura-btn kura-btn-sm kura-btn-amber"
                disabled={isBusy}
                onClick={() => void applyHolesOnSolids()}
              >
                <Combine size={13} />
                <span>{t(language, 'inspector.op.applyBooleansN', { count: holeCount })}</span>
              </button>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

          {/* Ahuecar (Hollow) */}
          <div className="kura-form-field">
            <div className="kura-field-row">
              <label>{t(language, 'inspector.op.hollowTitle')}</label>
              <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {formatDimension(wallThicknessMm, unitSystem)}
              </span>
            </div>
            <input
              type="range"
              min={0.8}
              max={12}
              step={0.2}
              value={wallThicknessMm}
              onChange={(e) => setWallThicknessMm(Number(e.target.value))}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
              <input
                type="checkbox"
                checked={drainHole}
                onChange={(e) => setDrainHole(e.target.checked)}
              />
              <span>{t(language, 'inspector.op.drainHole')}</span>
            </label>
            {drainHole && (
              <div className="kura-field-row">
                <span className="kura-field-label">{t(language, 'inspector.op.drainRadius')}</span>
                <input
                  type="number"
                  className="kura-input"
                  style={{ width: 78 }}
                  min={1}
                  max={25}
                  step={0.5}
                  value={drainRadiusMm}
                  onChange={(e) => setDrainRadiusMm(Number(e.target.value))}
                />
              </div>
            )}
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              disabled={isBusy || primary.locked}
              onClick={() =>
                void hollowObject(primary.id, {
                  enabled: true,
                  wallThickness: wallThicknessMm,
                  drainHole,
                  drainHoleRadius: drainRadiusMm,
                })
              }
            >
              {t(language, 'inspector.op.applyHollow')}
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

          {/* Corte y separación */}
          <div className="kura-form-field">
            <label>{t(language, 'inspector.op.cutAndSplitTitle')}</label>
            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy || primary.locked}
              onClick={() => setActiveDialog('cut')}
            >
              <Scissors size={13} />
              <span>{t(language, 'inspector.op.planeCut')}</span>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy || primary.locked}
                onClick={() => void splitDisconnectedObject(primary.id)}
              >
                <Split size={13} />
                <span>{t(language, 'inspector.op.splitParts')}</span>
              </button>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy || primary.locked}
                onClick={() => splitObjectByColor(primary.id)}
              >
                <Palette size={13} />
                <span>{t(language, 'inspector.op.splitColors')}</span>
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

          {/* Textura superficial */}
          <div className="kura-form-field">
            <label htmlFor="kura-tex-pattern">{t(language, 'inspector.op.textureTitle')}</label>
            <select
              id="kura-tex-pattern"
              className="kura-select"
              value={texturePattern}
              onChange={(e) => setTexturePattern(e.target.value as TexturePatternType)}
            >
              <option value="fuzzy">{t(language, 'inspector.texture.fuzzy')}</option>
              <option value="knurling">{t(language, 'inspector.texture.knurling')}</option>
              <option value="waves">{t(language, 'inspector.texture.waves')}</option>
              <option value="honeycomb">{t(language, 'inspector.texture.honeycomb')}</option>
              <option value="grid">{t(language, 'inspector.texture.grid')}</option>
            </select>

            <div className="kura-slider-header">
              <span className="kura-field-label">
                {t(language, 'inspector.op.textureDepth')}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {textureDepthMm} mm
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={textureDepthMm}
              onChange={(e) => setTextureDepthMm(Number(e.target.value))}
            />

            <div className="kura-slider-header">
              <span className="kura-field-label">
                {t(language, 'inspector.op.textureScale')}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {textureScaleMm} mm
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              step={0.5}
              value={textureScaleMm}
              onChange={(e) => setTextureScaleMm(Number(e.target.value))}
            />

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy || primary.locked}
              onClick={() =>
                applyTextureToObject(primary.id, {
                  pattern: texturePattern,
                  depth: textureDepthMm,
                  scale: textureScaleMm,
                })
              }
            >
              <Sparkles size={13} />
              <span>{t(language, 'inspector.op.applyTexture')}</span>
            </button>
          </div>

          {hasAnyHoles ? (
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-amber"
              disabled={isBusy}
              onClick={() => void applyHolesOnSolids()}
            >
              <Combine size={13} />
              <span>{t(language, 'inspector.op.applyHoles')}</span>
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
              {t(language, 'inspector.op.needTwoObjects')}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
};
