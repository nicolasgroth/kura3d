/**
 * @file src/components/RightInspector.tsx
 * @description Inspector paramétrico derecho de Kura3D:
 * - Colapsable independientemente y adaptable a modo Compacto (264px).
 * - Identidad, Materiales PBR realistas, Paleta & Leyenda de Filamentos en escena.
 * - Transformaciones en la unidad activa y métricas Manifold en vivo.
 * - Módulos dinámicos (+ / −) para cualquier primitiva o modelo STL/3MF/OBJ importado.
 * - Herramientas Maker Pro: Moldes/Silicona, Proyección Texto/SVG, Roscas ISO, Validador
 *   Estructural (Voladizos + Peso), Simplificar/Refinar Malla, Convex Hull y Alineación Inteligente.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useLayoutEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  AlignCenter,
  ArrowDownToLine,
  Bolt,
  Box,
  ChevronLeft,
  ChevronRight,
  Combine,
  Crosshair,
  Eye,
  EyeOff,
  FileUp,
  FlipHorizontal2,
  Grid,
  Link2,
  MinusCircle,
  PaintBucket,
  Palette,
  PlusCircle,
  RotateCcw,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Sparkles,
  Split,
  Type,
  Unlink2,
  Wand2,
  Zap,
} from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import {
  PrecisionNumberInput,
  type PrecisionModifierState,
} from './PrecisionNumberInput';
import {
  PRINT_COLOR_PALETTE,
  type AlignMode,
  type MaterialPresetId,
  type PrimitiveType,
  type TexturePatternType,
  type TransformMode,
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

const MATERIAL_IDS: MaterialPresetId[] = [
  'pla_matte',
  'pla_silk',
  'petg_clear',
  'abs',
  'carbon_fiber',
  'silicone',
  'wax_candle',
  'metallic',
];

const MODULAR_PRIMITIVES: PrimitiveType[] = [
  'sphere',
  'cylinder',
  'box',
  'tube',
  'cone',
  'torus',
  'prism',
  'text',
];

const AXES = ['x', 'y', 'z'] as const;
const MIN_SCALE = 0.05;

function RelativeTransformFields({
  label,
  applyLabel,
  step,
  precision,
  disabled,
  onApply,
}: {
  label: string;
  applyLabel: string;
  step: number;
  precision: number;
  disabled: boolean;
  onApply: (delta: Vec3) => void;
}) {
  const [delta, setDelta] = useState<Vec3>([0, 0, 0]);

  return (
    <>
      <div className="kura-vec3-grid">
        {AXES.map((axis, index) => (
          <PrecisionNumberInput
            key={axis}
            prefix={`Δ${axis.toUpperCase()}`}
            axisTone={axis}
            step={step}
            precision={precision}
            defaultValue={0}
            disabled={disabled}
            value={delta[index]}
            onChange={(value) => setDelta((previous) => {
              const next: Vec3 = [...previous];
              next[index] = value;
              return next;
            })}
            ariaLabel={`${label} Δ${axis.toUpperCase()}`}
          />
        ))}
      </div>
      <button
        type="button"
        className="kura-btn kura-btn-sm kura-precision-apply"
        disabled={disabled || delta.every((value) => value === 0)}
        onClick={() => {
          onApply(delta);
          setDelta([0, 0, 0]);
        }}
      >
        {applyLabel}
      </button>
    </>
  );
}

export const RightInspector: React.FC<{ precisionRequest?: { mode: TransformMode } | null }> = ({ precisionRequest }) => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const rightCollapsed = useKuraStore((s) => s.rightCollapsed);
  const toggleRightInspector = useKuraStore((s) => s.toggleRightInspector);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const activePrintReport = useKuraStore((s) => s.activePrintReport);
  const showOverhangs = useKuraStore((s) => s.showOverhangs);
  const setShowOverhangs = useKuraStore((s) => s.setShowOverhangs);

  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const setObjectMaterial = useKuraStore((s) => s.setObjectMaterial);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const centerObjectOnBed = useKuraStore((s) => s.centerObjectOnBed);
  const resetObjectOrientation = useKuraStore((s) => s.resetObjectOrientation);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const addModularPrimitive = useKuraStore((s) => s.addModularPrimitive);
  const importModelAsModuleFromDialog = useKuraStore((s) => s.importModelAsModuleFromDialog);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const splitObjectByColor = useKuraStore((s) => s.splitObjectByColor);
  const applyTextureToObject = useKuraStore((s) => s.applyTextureToObject);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const simplifySelectedMesh = useKuraStore((s) => s.simplifySelectedMesh);
  const refineSelectedMesh = useKuraStore((s) => s.refineSelectedMesh);
  const runConvexHull = useKuraStore((s) => s.runConvexHull);
  const alignSelectedObjects = useKuraStore((s) => s.alignSelectedObjects);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const proportionalScale = useKuraStore((s) => s.proportionalScale);
  const toggleProportionalScale = useKuraStore((s) => s.toggleProportionalScale);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const activeSegmentation = useKuraStore((s) => s.activeSegmentation);
  const segmentationCreaseDeg = useKuraStore((s) => s.segmentationCreaseDeg);
  const setSegmentationCreaseDeg = useKuraStore((s) => s.setSegmentationCreaseDeg);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const colorizeDetectedStructures = useKuraStore((s) => s.colorizeDetectedStructures);
  const extractDetectedStructure = useKuraStore((s) => s.extractDetectedStructure);
  const splitAllDetectedObjectStructures = useKuraStore(
    (s) => s.splitAllDetectedObjectStructures,
  );

  // Estados locales para parámetros de operaciones Manifold & Pro
  const [wallThicknessMm, setWallThicknessMm] = useState(2.2);
  const [drainHole, setDrainHole] = useState(false);
  const [drainRadiusMm, setDrainRadiusMm] = useState(4);

  const [texturePattern, setTexturePattern] = useState<TexturePatternType>('fuzzy');
  const [textureDepthMm, setTextureDepthMm] = useState(0.45);
  const [textureScaleMm, setTextureScaleMm] = useState(4);
  const [positionRelative, setPositionRelative] = useState(false);
  const [rotationRelative, setRotationRelative] = useState(false);
  const [scaleBySize, setScaleBySize] = useState(false);

  useLayoutEffect(() => {
    if (!precisionRequest) return;
    const group = document.getElementById(`kura-precision-${precisionRequest.mode}`);
    group?.focus({ preventScroll: true });
    group?.scrollIntoView({ block: 'nearest' });
  }, [precisionRequest]);

  const [modularShape, setModularShape] = useState<PrimitiveType>('cylinder');
  const [simplifyTolMm, setSimplifyTolMm] = useState(0.15);
  const [refineEdgeMm, setRefineEdgeMm] = useState(1.5);
  const [refineSmooth, setRefineSmooth] = useState(false);

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const primary = selectedObjects[0] ?? null;
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;
  const hasAnyHoles = holeCount > 0;
  const isBusy = Boolean(busyOperation);

  // Leyenda global de colores / filamentos distintos en la escena
  const sceneColors = useMemo(() => {
    const map = new Map<string, number>();
    for (const obj of objects) {
      if (obj.isHole) continue;
      if (obj.mesh.faceColors && obj.mesh.faceColors.length > 0) {
        const distinct = new Set(obj.mesh.faceColors.map((c) => c.toLowerCase()));
        for (const c of distinct) {
          map.set(c, (map.get(c) ?? 0) + 1);
        }
      } else {
        const c = obj.color.toLowerCase();
        map.set(c, (map.get(c) ?? 0) + 1);
      }
    }
    return Array.from(map.entries());
  }, [objects]);

  const edgeToggleBtn = (
    <button
      type="button"
      className="kura-panel-edge-btn is-right"
      onClick={toggleRightInspector}
      title={
        rightCollapsed
          ? t(language, 'ui.panel.expandRight')
          : t(language, 'ui.panel.collapseRight')
      }
      aria-label={
        rightCollapsed
          ? t(language, 'ui.panel.expandRight')
          : t(language, 'ui.panel.collapseRight')
      }
    >
      {rightCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
    </button>
  );

  const filamentLegendCard = sceneColors.length > 0 && (
    <section className="kura-card">
      <div className="kura-field-row">
        <span className="kura-section-label" style={{ margin: 0 }}>
          {t(language, 'scene.filamentLegend')}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>
          {t(language, 'scene.colorsCount', { count: sceneColors.length })}
        </span>
      </div>
      <div className="kura-filament-legend">
        {sceneColors.map(([hex, count]) => (
          <span key={hex} className="kura-filament-chip">
            <span className="kura-color-dot" style={{ backgroundColor: hex }} />
            <span>{hex.toUpperCase()}</span>
            <span style={{ color: 'var(--text-muted)' }}>×{count}</span>
          </span>
        ))}
      </div>
    </section>
  );

  const alignButtons: Array<{ mode: AlignMode; label: string }> = [
    { mode: 'minX', label: 'Min X' },
    { mode: 'centerX', label: 'Cen X' },
    { mode: 'maxX', label: 'Max X' },
    { mode: 'minY', label: 'Min Y' },
    { mode: 'centerY', label: 'Cen Y' },
    { mode: 'maxY', label: 'Max Y' },
    { mode: 'minZ', label: 'Min Z' },
    { mode: 'centerZ', label: 'Cen Z' },
    { mode: 'maxZ', label: 'Max Z' },
  ];

  // Sin selección
  if (selectedObjects.length === 0) {
    return (
      <aside
        id="kura-inspector-panel"
        className={`kura-sidebar-right ${rightCollapsed ? 'is-collapsed' : ''}`}
        aria-label={t(language, 'inspector.title')}
      >
        {edgeToggleBtn}
        <div className="kura-panel-header">{t(language, 'inspector.title')}</div>
        <div className="kura-scroll-area">
          <div className="kura-card">
            <strong>{t(language, 'inspector.emptyTitle')}</strong>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(language, 'inspector.emptyDesc')}
            </p>
          </div>

          {filamentLegendCard}

          {objects.length > 0 && (
            <div className="kura-card">
              <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                onClick={() => alignSelectedObjects('arrange_grid')}
              >
                <Grid size={13} />
                <span>{t(language, 'inspector.pro.arrangeGrid')}</span>
              </button>
            </div>
          )}

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

  // Multi-selección (2+ objetos): Booleanas CSG, Convex Hull y Alineación
  if (selectedObjects.length >= 2) {
    return (
      <aside
        id="kura-inspector-panel"
        className={`kura-sidebar-right ${rightCollapsed ? 'is-collapsed' : ''}`}
        aria-label={t(language, 'inspector.title')}
      >
        {edgeToggleBtn}
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

          {filamentLegendCard}

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

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy}
              onClick={() => void runConvexHull()}
            >
              <Box size={13} />
              <span>{t(language, 'inspector.pro.hull')}</span>
            </button>

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

          <div className="kura-card">
            <h3 className="kura-section-label">{t(language, 'inspector.pro.alignTitle')}</h3>
            <div className="kura-align-grid">
              {alignButtons.map((btn) => (
                <button
                  key={btn.mode}
                  type="button"
                  className="kura-btn kura-btn-sm"
                  onClick={() => alignSelectedObjects(btn.mode)}
                >
                  <AlignCenter size={11} />
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              onClick={() => alignSelectedObjects('arrange_grid')}
            >
              <Grid size={13} />
              <span>{t(language, 'inspector.pro.arrangeGrid')}</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Un solo objeto seleccionado
  if (!primary) return null;

  const stepUnit = getUnitStep(unitSystem);
  const unitLabel = getUnitLabel(unitSystem);
  const unitPrecision = unitSystem === 'in' ? 3 : unitSystem === 'm' || unitSystem === 'ft' ? 4 : 2;
  const positionLabel = `${t(language, 'inspector.field.position')} (${unitLabel})`;
  const rotationLabel = t(language, 'inspector.field.rotation');
  const scaleLabel = scaleBySize
    ? `${t(language, 'precision.localSize')} (${unitLabel})`
    : t(language, 'inspector.field.scale');
  const transformDisabled = primary.locked || isBusy;
  const currentMaterial = primary.materialPreset ?? 'pla_matte';
  const currentReport =
    activePrintReport && activePrintReport.objectId === primary.id
      ? activePrintReport
      : null;

  const handlePosChange = (axisIdx: 0 | 1 | 2, num: number, modifiers?: PrecisionModifierState) => {
    const millimeters = toMm(num, unitSystem);
    if (!Number.isFinite(millimeters) || millimeters === primary.position[axisIdx]) return;
    const nextPos: Vec3 = [...primary.position] as Vec3;
    nextPos[axisIdx] = millimeters;
    setObjectTransform(primary.id, { position: nextPos }, !modifiers?.isScrubbing);
  };

  const handleRotChange = (axisIdx: 0 | 1 | 2, deg: number, modifiers?: PrecisionModifierState) => {
    const radians = THREE.MathUtils.degToRad(deg);
    if (!Number.isFinite(radians) || radians === primary.rotation[axisIdx]) return;
    const nextRot: Vec3 = [...primary.rotation] as Vec3;
    nextRot[axisIdx] = radians;
    setObjectTransform(primary.id, { rotation: nextRot }, !modifiers?.isScrubbing);
  };

  const smallestScale = Math.min(...primary.scale);
  const handleScaleChange = (
    axisIdx: 0 | 1 | 2,
    factor: number,
    modifiers?: PrecisionModifierState,
  ) => {
    if (!Number.isFinite(factor)) return;
    const recordHistory = !modifiers?.isScrubbing;
    const isUniform = proportionalScale || Boolean(modifiers?.shiftKey);
    if (isUniform) {
      if (smallestScale <= 0) return;
      const requestedRatio = factor / primary.scale[axisIdx];
      const nextSmallest = Math.max(MIN_SCALE, smallestScale * requestedRatio);
      if (nextSmallest === smallestScale) return;
      const nextScale = primary.scale.map(
        (value) => nextSmallest * (value / smallestScale),
      ) as Vec3;
      if (!nextScale.every(Number.isFinite)) return;
      setObjectTransform(primary.id, { scale: nextScale }, recordHistory);
      return;
    }
    const nextFactor = Math.max(MIN_SCALE, factor);
    if (nextFactor === primary.scale[axisIdx]) return;
    const nextScale: Vec3 = [...primary.scale] as Vec3;
    nextScale[axisIdx] = nextFactor;
    setObjectTransform(primary.id, { scale: nextScale }, recordHistory);
  };

  const scaledDims: Vec3 = [
    primary.stats.dimensionsMm[0] * primary.scale[0],
    primary.stats.dimensionsMm[1] * primary.scale[1],
    primary.stats.dimensionsMm[2] * primary.scale[2],
  ];
  const scaledVolumeMm3 =
    primary.stats.volumeMm3 * primary.scale[0] * primary.scale[1] * primary.scale[2];

  return (
    <aside
      id="kura-inspector-panel"
      className={`kura-sidebar-right ${rightCollapsed ? 'is-collapsed' : ''}`}
      aria-label={t(language, 'inspector.title')}
    >
      {edgeToggleBtn}

      <div className="kura-panel-header">
        <span>{t(language, 'inspector.title')}</span>
        <span
          style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}
          title={t(language, 'inspector.sourceLabel', { source: t(language, `inspector.source.${primary.source}` as TranslationKey) })}
        >
          {t(language, `inspector.source.${primary.source}` as TranslationKey)}
        </span>
      </div>

      <div className="kura-scroll-area">
        {/* 1. Identidad, Material PBR y Color */}
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
            <label htmlFor="kura-obj-material">{t(language, 'material.title')}</label>
            <select
              id="kura-obj-material"
              className="kura-select"
              value={currentMaterial}
              onChange={(e) =>
                setObjectMaterial(primary.id, e.target.value as MaterialPresetId)
              }
            >
              {MATERIAL_IDS.map((matId) => (
                <option key={matId} value={matId}>
                  {t(language, `material.${matId}` as TranslationKey)}
                </option>
              ))}
            </select>
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

        {filamentLegendCard}

        {/* 2. Transformación en la unidad activa */}
        <section className="kura-card">
          <h3 className="kura-section-label">
            {t(language, 'inspector.section.transform', { unit: unitLabel })}
          </h3>

          <div
            className="kura-form-field kura-transform-group"
            id="kura-precision-translate"
            role="group"
            tabIndex={-1}
            aria-labelledby="kura-precision-translate-label"
          >
            <div className="kura-field-row">
              <span className="kura-field-label" id="kura-precision-translate-label">{positionLabel}</span>
              <select
                className="kura-select kura-transform-mode"
                value={positionRelative ? 'relative' : 'absolute'}
                onChange={(event) => setPositionRelative(event.target.value === 'relative')}
                aria-label={`${positionLabel} · ${t(language, 'precision.coordinateMode')}`}
              >
                <option value="absolute">{t(language, 'precision.absolute')}</option>
                <option value="relative">{t(language, 'precision.relative')}</option>
              </select>
            </div>
            {positionRelative ? (
              <RelativeTransformFields
                key={`${primary.id}:${unitSystem}`}
                label={positionLabel}
                applyLabel={t(language, 'precision.applyDelta')}
                step={stepUnit}
                precision={unitPrecision}
                disabled={transformDisabled}
                onApply={(delta) => {
                  const position = primary.position.map(
                    (value, index) => value + toMm(delta[index], unitSystem),
                  ) as Vec3;
                  if (position.every(Number.isFinite)) setObjectTransform(primary.id, { position }, true);
                }}
              />
            ) : (
              <div className="kura-vec3-grid">
                {AXES.map((axis, idx) => (
                  <PrecisionNumberInput
                    key={`${primary.id}:${unitSystem}:${axis}`}
                    prefix={axis.toUpperCase()}
                    axisTone={axis}
                    step={stepUnit}
                    precision={unitPrecision}
                    commitOnBlur
                    defaultValue={0}
                    disabled={transformDisabled}
                    value={Number(fromMm(primary.position[idx], unitSystem).toFixed(unitPrecision))}
                    onChange={(val, mods) => handlePosChange(idx as 0 | 1 | 2, val, mods)}
                    onCommit={commitTransformSnapshot}
                    ariaLabel={`${positionLabel} ${axis.toUpperCase()}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="kura-form-field kura-transform-group"
            id="kura-precision-rotate"
            role="group"
            tabIndex={-1}
            aria-labelledby="kura-precision-rotate-label"
          >
            <div className="kura-field-row">
              <span className="kura-field-label" id="kura-precision-rotate-label">{rotationLabel}</span>
              <select
                className="kura-select kura-transform-mode"
                value={rotationRelative ? 'relative' : 'absolute'}
                onChange={(event) => setRotationRelative(event.target.value === 'relative')}
                aria-label={`${rotationLabel} · ${t(language, 'precision.coordinateMode')}`}
              >
                <option value="absolute">{t(language, 'precision.absolute')}</option>
                <option value="relative">{t(language, 'precision.relative')}</option>
              </select>
            </div>
            {rotationRelative ? (
              <>
                <p className="kura-transform-note">{t(language, 'precision.relativeRotation')}</p>
                <RelativeTransformFields
                  key={primary.id}
                  label={rotationLabel}
                  applyLabel={t(language, 'precision.applyDelta')}
                  step={5}
                  precision={2}
                  disabled={transformDisabled}
                  onApply={(delta) => {
                    const rotation = primary.rotation.map(
                      (value, index) => value + THREE.MathUtils.degToRad(delta[index]),
                    ) as Vec3;
                    if (rotation.every(Number.isFinite)) setObjectTransform(primary.id, { rotation }, true);
                  }}
                />
              </>
            ) : (
              <div className="kura-vec3-grid">
                {AXES.map((axis, idx) => (
                  <PrecisionNumberInput
                    key={`${primary.id}:${axis}`}
                    prefix={axis.toUpperCase()}
                    axisTone={axis}
                    step={5}
                    precision={2}
                    commitOnBlur
                    defaultValue={0}
                    disabled={transformDisabled}
                    value={Number(THREE.MathUtils.radToDeg(primary.rotation[idx]).toFixed(2))}
                    onChange={(val, mods) => handleRotChange(idx as 0 | 1 | 2, val, mods)}
                    onCommit={commitTransformSnapshot}
                    ariaLabel={`${rotationLabel} ${axis.toUpperCase()}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="kura-form-field kura-transform-group"
            id="kura-precision-scale"
            role="group"
            tabIndex={-1}
            aria-labelledby="kura-precision-scale-label"
          >
            <div className="kura-field-row">
              <span className="kura-field-label" id="kura-precision-scale-label">{scaleLabel}</span>
              <div className="kura-transform-scale-actions">
                <select
                  className="kura-select kura-transform-mode"
                  value={scaleBySize ? 'size' : 'factor'}
                  onChange={(event) => setScaleBySize(event.target.value === 'size')}
                  aria-label={`${scaleLabel} · ${t(language, 'precision.coordinateMode')}`}
                >
                  <option value="factor">{t(language, 'precision.factor')}</option>
                  <option value="size">{t(language, 'precision.localSize')}</option>
                </select>
                <button
                  type="button"
                  className={`kura-lock-btn ${proportionalScale ? 'is-active' : ''}`}
                  onClick={toggleProportionalScale}
                  title={t(language, 'inspector.scale.lockTip')}
                  aria-label={t(language, 'inspector.scale.lockTip')}
                  aria-pressed={proportionalScale}
                >
                  {proportionalScale ? <Link2 size={12} /> : <Unlink2 size={12} />}
                </button>
              </div>
            </div>
            <div className="kura-vec3-grid">
              {AXES.map((axis, idx) => {
                const baseSize = fromMm(primary.stats.dimensionsMm[idx], unitSystem);
                const precision = scaleBySize ? unitPrecision : 4;
                const value = scaleBySize ? baseSize * primary.scale[idx] : primary.scale[idx];
                const minimumFactor = proportionalScale && smallestScale > 0
                  ? MIN_SCALE * (primary.scale[idx] / smallestScale)
                  : MIN_SCALE;
                return (
                  <PrecisionNumberInput
                    key={`${primary.id}:${scaleBySize ? unitSystem : 'factor'}:${axis}`}
                    prefix={axis.toUpperCase()}
                    axisTone={axis}
                    step={scaleBySize ? stepUnit : 0.1}
                    min={scaleBySize ? baseSize * minimumFactor : minimumFactor}
                    precision={precision}
                    commitOnBlur
                    defaultValue={scaleBySize ? baseSize : 1}
                    disabled={transformDisabled || (scaleBySize && baseSize <= 0)}
                    value={value}
                    onChange={(val, mods) => {
                      const factor = scaleBySize ? val / baseSize : val;
                      handleScaleChange(idx as 0 | 1 | 2, factor, mods);
                    }}
                    onCommit={commitTransformSnapshot}
                    ariaLabel={`${scaleLabel} ${axis.toUpperCase()}`}
                  />
                );
              })}
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

          <div className="kura-form-field">
            <label>{t(language, 'inspector.mirror.title')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5 }}>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button
                  key={axis}
                  type="button"
                  className="kura-btn kura-btn-sm"
                  style={{ minWidth: 0, padding: '0 6px' }}
                  title={t(language, `inspector.mirror.${axis}`)}
                  disabled={primary.locked || isBusy}
                  onClick={() => mirrorObject(primary.id, axis)}
                >
                  <FlipHorizontal2 size={12} />
                  <span>{axis.toUpperCase()}</span>
                </button>
              ))}
            </div>
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

        {/* 4. Herramientas Maker */}
        <section className="kura-card">
          <h3 className="kura-section-label">{t(language, 'inspector.pro.title')}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              disabled={isBusy}
              onClick={() => setActiveDialog('mold')}
            >
              <PaintBucket size={13} />
              <span>{t(language, 'inspector.pro.mold')}</span>
            </button>

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy || primary.locked}
              onClick={() => setActiveDialog('project')}
            >
              <Type size={13} />
              <span>{t(language, 'inspector.pro.project')}</span>
            </button>

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy}
              onClick={() => setActiveDialog('thread')}
            >
              <Bolt size={13} />
              <span>{t(language, 'inspector.pro.thread')}</span>
            </button>

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy}
              onClick={() => runPrintabilityCheck(primary.id)}
            >
              <ShieldCheck size={13} style={{ color: 'var(--accent-green)' }} />
              <span>{t(language, 'inspector.pro.validate')}</span>
            </button>
          </div>

          {/* Tarjeta de resultados del Validador Estructural */}
          {currentReport && (
            <div className="kura-report-card">
              <div className="kura-field-row">
                <span className="kura-field-label">{t(language, 'inspector.pro.score')}</span>
                <span
                  className={`kura-score-pill ${
                    currentReport.score >= 80
                      ? 'is-good'
                      : currentReport.score >= 55
                        ? 'is-warn'
                        : 'is-bad'
                  }`}
                >
                  {currentReport.score}/100
                </span>
              </div>

              <div className="kura-stats-grid">
                <div className="kura-stat-box">
                  <div className="kura-stat-title">{t(language, 'inspector.pro.weight')}</div>
                  <div className="kura-stat-val">
                    {currentReport.estimatedWeightGrams.toFixed(1)} g
                  </div>
                </div>
                <div className="kura-stat-box">
                  <div className="kura-stat-title">{t(language, 'inspector.pro.filament')}</div>
                  <div className="kura-stat-val">
                    {currentReport.estimatedFilamentMeters.toFixed(2)} m
                  </div>
                </div>
                <div className="kura-stat-box">
                  <div className="kura-stat-title">{t(language, 'inspector.pro.overhangs')}</div>
                  <div className="kura-stat-val">
                    {currentReport.overhangPercent.toFixed(1)}%
                  </div>
                </div>
                <div className="kura-stat-box">
                  <div className="kura-stat-title">{t(language, 'viewport.bedLabel')}</div>
                  <div
                    className={`kura-stat-val ${
                      currentReport.fitsInBed && !currentReport.isFloating
                        ? 'kura-badge-ok'
                        : 'kura-badge-warn'
                    }`}
                  >
                    {!currentReport.fitsInBed
                      ? t(language, 'inspector.pro.outOfBed')
                      : currentReport.isFloating
                        ? t(language, 'inspector.pro.floating', {
                            mm: currentReport.minYWorldMm.toFixed(1),
                          })
                        : t(language, 'inspector.pro.grounded')}
                  </div>
                </div>
              </div>

              {currentReport.overhangFaceCount > 0 && (
                <button
                  type="button"
                  className={`kura-btn kura-btn-sm ${showOverhangs ? 'is-active' : ''}`}
                  onClick={() => setShowOverhangs(!showOverhangs)}
                >
                  {showOverhangs ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>
                    {showOverhangs
                      ? t(language, 'inspector.pro.hideOverhangs')
                      : t(language, 'inspector.pro.showOverhangs')}
                  </span>
                </button>
              )}

              {currentReport.warnings.length > 0 ? (
                <ul className="kura-warning-list">
                  {currentReport.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>
                  {t(language, 'inspector.pro.noWarnings')}
                </span>
              )}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

          {/* Detección de Estructuras (100 % Local) */}
          <div className="kura-struct-panel">
            <div className="kura-field-row">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700 }}>
                <ScanSearch size={13} style={{ color: 'var(--accent-cyan)' }} />
                <span>{t(language, 'inspector.struct.title')}</span>
              </label>
              <span
                className="kura-source-pill is-local"
                title={t(language, 'badge.local100Tip')}
              >
                <Zap size={10} />
                <span>{t(language, 'badge.local100')}</span>
              </span>
            </div>

            <div className="kura-slider-header">
              <span className="kura-field-label">
                {t(language, 'inspector.struct.sensitivity')}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {segmentationCreaseDeg}°
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={65}
              step={1}
              value={segmentationCreaseDeg}
              aria-label={t(language, 'inspector.struct.sensitivity')}
              aria-valuetext={`${segmentationCreaseDeg}°`}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setSegmentationCreaseDeg(28)}
              onChange={(e) => setSegmentationCreaseDeg(Number(e.target.value))}
            />

            <button
              type="button"
              className="kura-btn kura-btn-sm kura-btn-primary"
              disabled={isBusy}
              onClick={() => void detectObjectStructures(primary.id, segmentationCreaseDeg)}
            >
              <ScanSearch size={13} />
              <span>{t(language, 'inspector.struct.detectBtn')}</span>
            </button>

            {activeSegmentation && activeSegmentation.objectId === primary.id && (
              <div className="kura-struct-results">
                <div className="kura-field-row">
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t(language, 'inspector.struct.regionsCount', {
                      count: activeSegmentation.regions.length,
                    })}
                  </span>
                </div>

                {activeSegmentation.regions.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                    {t(language, 'inspector.struct.empty')}
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 5 }}>
                      <button
                        type="button"
                        className="kura-btn kura-btn-sm"
                        style={{ minWidth: 0 }}
                        disabled={isBusy || primary.locked}
                        onClick={() => void colorizeDetectedStructures(primary.id)}
                      >
                        <Palette size={12} style={{ color: 'var(--accent-cyan)' }} />
                        <span>{t(language, 'inspector.struct.colorizeBtn')}</span>
                      </button>
                      <button
                        type="button"
                        className="kura-btn kura-btn-sm kura-btn-amber"
                        style={{ minWidth: 0 }}
                        disabled={isBusy || primary.locked}
                        onClick={() => void splitAllDetectedObjectStructures(primary.id)}
                      >
                        <Split size={12} />
                        <span>{t(language, 'inspector.struct.splitAllBtn')}</span>
                      </button>
                    </div>

                    <div className="kura-struct-list">
                      {activeSegmentation.regions.map((region) => {
                        const label = language === 'es' ? region.labelEs : region.labelEn;
                        return (
                          <div key={region.id} className="kura-struct-item">
                            <div className="kura-struct-item-head">
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  className="kura-color-dot"
                                  style={{ backgroundColor: region.color }}
                                />
                                <span className="kura-struct-label" title={label}>
                                  {label}
                                </span>
                              </span>
                              <span className="kura-struct-badge">
                                {t(language, 'inspector.struct.confidence', {
                                  pct: Math.round(region.confidence),
                                })}
                              </span>
                            </div>

                            <div className="kura-struct-meta">
                              <span>
                                {formatDimension(region.dimensionsMm[0], unitSystem, 1)} ×{' '}
                                {formatDimension(region.dimensionsMm[1], unitSystem, 1)} ×{' '}
                                {formatDimension(region.dimensionsMm[2], unitSystem, 1)}
                              </span>
                              <span>{region.percentOfModel.toFixed(1)}%</span>
                            </div>

                            <div className="kura-struct-actions">
                              <button
                                type="button"
                                className="kura-btn kura-btn-sm"
                                disabled={isBusy}
                                onClick={() => void extractDetectedStructure(region.id, false)}
                              >
                                <PlusCircle size={11} />
                                <span>{t(language, 'inspector.struct.extractCopy')}</span>
                              </button>
                              <button
                                type="button"
                                className="kura-btn kura-btn-sm"
                                disabled={isBusy || primary.locked}
                                title={t(language, 'inspector.struct.detachTip')}
                                onClick={() => void extractDetectedStructure(region.id, true)}
                              >
                                <Scissors size={11} />
                                <span>{t(language, 'inspector.struct.detach')}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', width: '100%' }} />

          {/* Simplificar / Refinar Malla */}
          <div className="kura-form-field">
            <label>{t(language, 'inspector.pro.meshTitle')}</label>
            <div className="kura-field-row">
              <span className="kura-field-label">{t(language, 'inspector.pro.simplifyTol')}</span>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <PrecisionNumberInput
                  style={{ width: 92 }}
                  min={0.01}
                  max={5}
                  step={0.05}
                  precision={2}
                  defaultValue={0.15}
                  value={simplifyTolMm}
                  onChange={setSimplifyTolMm}
                  ariaLabel={t(language, 'inspector.pro.simplifyTol')}
                />
                <button
                  type="button"
                  className="kura-btn kura-btn-sm"
                  disabled={isBusy || primary.locked}
                  onClick={() => void simplifySelectedMesh(primary.id, simplifyTolMm)}
                >
                  {t(language, 'inspector.pro.simplifyBtn')}
                </button>
              </div>
            </div>

            <div className="kura-field-row">
              <span className="kura-field-label">{t(language, 'inspector.pro.refineEdge')}</span>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <PrecisionNumberInput
                  style={{ width: 92 }}
                  min={0.2}
                  max={10}
                  step={0.2}
                  precision={2}
                  defaultValue={1.5}
                  value={refineEdgeMm}
                  onChange={setRefineEdgeMm}
                  ariaLabel={t(language, 'inspector.pro.refineEdge')}
                />
                <button
                  type="button"
                  className="kura-btn kura-btn-sm"
                  disabled={isBusy || primary.locked}
                  onClick={() => void refineSelectedMesh(primary.id, refineEdgeMm, refineSmooth)}
                >
                  <Wand2 size={12} />
                  <span>{t(language, 'inspector.pro.refineBtn')}</span>
                </button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
              <input
                type="checkbox"
                checked={refineSmooth}
                onChange={(e) => setRefineSmooth(e.target.checked)}
              />
              <span>{t(language, 'inspector.pro.refineSmooth')}</span>
            </label>

            <button
              type="button"
              className="kura-btn kura-btn-sm"
              disabled={isBusy}
              onClick={() => void runConvexHull([primary.id])}
            >
              <Box size={13} />
              <span>{t(language, 'inspector.pro.hull')}</span>
            </button>
          </div>
        </section>

        {/* 5. Operaciones 3D determinísticas (Manifold) + Módulos Dinámicos */}
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

          {/* Módulos dinámicos (+ / −) para cualquier forma o STL/3MF importado */}
          <div className="kura-form-field">
            <label htmlFor="kura-modular-shape">{t(language, 'inspector.op.modularTitle')}</label>
            <div className="kura-modular-picker">
              <select
                id="kura-modular-shape"
                className="kura-select"
                value={modularShape}
                onChange={(e) => setModularShape(e.target.value as PrimitiveType)}
              >
                {MODULAR_PRIMITIVES.map((shape) => (
                  <option key={shape} value={shape}>
                    {t(language, `sidebar.primitive.${shape}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="kura-btn kura-btn-sm kura-btn-primary"
                disabled={isBusy}
                onClick={() => void addModularPrimitive(modularShape, 'positive', primary.id)}
                title={t(language, 'inspector.op.modularAdd')}
              >
                <PlusCircle size={13} />
                <span>+</span>
              </button>
              <button
                type="button"
                className="kura-btn kura-btn-sm kura-btn-amber"
                disabled={isBusy}
                onClick={() => void addModularPrimitive(modularShape, 'negative', primary.id)}
                title={t(language, 'inspector.op.modularSub')}
              >
                <MinusCircle size={13} />
                <span>−</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy}
                onClick={() => void importModelAsModuleFromDialog('positive', primary.id)}
              >
                <FileUp size={12} />
                <span>{t(language, 'inspector.op.importModuleAdd')}</span>
              </button>
              <button
                type="button"
                className="kura-btn kura-btn-sm"
                disabled={isBusy}
                onClick={() => void importModelAsModuleFromDialog('negative', primary.id)}
              >
                <FileUp size={12} style={{ color: 'var(--accent-amber)' }} />
                <span>{t(language, 'inspector.op.importModuleSub')}</span>
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
              <PrecisionNumberInput
                style={{ width: 92 }}
                min={0.8}
                max={12}
                step={0.2}
                precision={1}
                defaultValue={2.2}
                suffix="mm"
                value={wallThicknessMm}
                onChange={setWallThicknessMm}
                ariaLabel={t(language, 'inspector.op.wallThickness')}
              />
            </div>
            <input
              type="range"
              min={0.8}
              max={12}
              step={0.2}
              value={wallThicknessMm}
              aria-label={t(language, 'inspector.op.wallThickness')}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setWallThicknessMm(2.2)}
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
                <PrecisionNumberInput
                  style={{ width: 94 }}
                  min={1}
                  max={25}
                  step={0.5}
                  precision={1}
                  defaultValue={4}
                  suffix="mm"
                  value={drainRadiusMm}
                  onChange={setDrainRadiusMm}
                  ariaLabel={t(language, 'inspector.op.drainRadius')}
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
              <PrecisionNumberInput
                style={{ width: 88 }}
                min={0.1}
                max={2.5}
                step={0.05}
                precision={2}
                defaultValue={0.45}
                suffix="mm"
                value={textureDepthMm}
                onChange={setTextureDepthMm}
                ariaLabel={t(language, 'inspector.op.textureDepth')}
              />
            </div>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={textureDepthMm}
              aria-label={t(language, 'inspector.op.textureDepth')}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setTextureDepthMm(0.45)}
              onChange={(e) => setTextureDepthMm(Number(e.target.value))}
            />

            <div className="kura-slider-header">
              <span className="kura-field-label">
                {t(language, 'inspector.op.textureScale')}
              </span>
              <PrecisionNumberInput
                style={{ width: 88 }}
                min={1}
                max={16}
                step={0.5}
                precision={1}
                defaultValue={4}
                suffix="mm"
                value={textureScaleMm}
                onChange={setTextureScaleMm}
                ariaLabel={t(language, 'inspector.op.textureScale')}
              />
            </div>
            <input
              type="range"
              min={1}
              max={16}
              step={0.5}
              value={textureScaleMm}
              aria-label={t(language, 'inspector.op.textureScale')}
              title={t(language, 'ui.sliderResetTip')}
              onDoubleClick={() => setTextureScaleMm(4)}
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
        </section>
      </div>
    </aside>
  );
};
