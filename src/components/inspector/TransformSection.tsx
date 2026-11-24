/**
 * @file src/components/inspector/TransformSection.tsx
 * @description Sección Transformación del inspector: posición, rotación y escala en la unidad activa.
 * Muestra y recibe los valores en los ejes del usuario (Z = altura) vía `core/scene/displayAxes`. Con `focus`
 * (herramienta Mover, Rotar o Escalar activa) solo se ve ese grupo de campos (`styles/toolPanel.css`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import * as THREE from 'three';
import {
  ArrowDownToLine,
  Crosshair,
  FlipHorizontal2,
  Link2,
  RotateCcw,
  Unlink2,
} from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PrecisionNumberInput, type PrecisionModifierState } from '../PrecisionNumberInput';
import { type TransformMode, type Vec3 } from '../../types/kura';
import { fromMm, getUnitLabel, getUnitStep, toMm } from '../../utils/units';
import { AXES, MIN_SCALE } from './inspectorConstants';
import { MAX_ABS_COORDINATE, MAX_SCALE } from '../../store/transformLimits';
import {
  fromUserPosition,
  fromUserRotation,
  fromUserScale,
  internalAxisOfUser,
  toUserPosition,
  toUserRotation,
  toUserScale,
  toUserSize,
} from '../../core/scene/displayAxes';
import { RelativeTransformFields } from './RelativeTransformFields';
import { type InspectorSectionProps } from './inspectorTypes';
import { UnitDoubtLink } from './UnitDoubtLink';

/** Giro máximo aceptado por campo (grados): 100 vueltas. */
const ROTATION_LIMIT_DEG = 36000;

/** Sección 2: transformación en la unidad activa. */
export const TransformSection: React.FC<InspectorSectionProps & { focus?: TransformMode }> = ({ primary, ui, focus }) => {
  const { positionRelative, setPositionRelative, rotationRelative, setRotationRelative, scaleBySize, setScaleBySize } = ui;
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const setObjectTransform = useKuraStore((s) => s.setObjectTransform);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const centerObjectOnBed = useKuraStore((s) => s.centerObjectOnBed);
  const resetObjectOrientation = useKuraStore((s) => s.resetObjectOrientation);
  const proportionalScale = useKuraStore((s) => s.proportionalScale);
  const toggleProportionalScale = useKuraStore((s) => s.toggleProportionalScale);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const isBusy = Boolean(busyOperation);
  const stepUnit = getUnitStep(unitSystem);
  const unitLabel = getUnitLabel(unitSystem);
  const unitPrecision = unitSystem === 'in' ? 3 : unitSystem === 'm' || unitSystem === 'ft' ? 4 : 2;
  const positionLabel = `${t(language, 'inspector.field.position')} (${unitLabel})`;
  const rotationLabel = t(language, 'inspector.field.rotation');
  const scaleLabel = scaleBySize
    ? `${t(language, 'precision.localSize')} (${unitLabel})`
    : t(language, 'inspector.field.scale');
  const transformDisabled = primary.locked || isBusy;
  // Valores en ejes del usuario (X derecha, Y fondo, Z arriba); el objeto guarda los internos.
  const userPosition = toUserPosition(primary.position);
  const userRotation = toUserRotation(primary.rotation);
  const userScale = toUserScale(primary.scale);
  const userDimensions = toUserSize(primary.stats.dimensionsMm);
  const handlePosChange = (axisIdx: 0 | 1 | 2, num: number, modifiers?: PrecisionModifierState) => {
    const millimeters = toMm(num, unitSystem);
    if (!Number.isFinite(millimeters) || millimeters === userPosition[axisIdx]) return;
    const nextUser: Vec3 = [...userPosition];
    nextUser[axisIdx] = millimeters;
    setObjectTransform(primary.id, { position: fromUserPosition(nextUser) }, !modifiers?.isScrubbing);
  };
  const handleRotChange = (axisIdx: 0 | 1 | 2, deg: number, modifiers?: PrecisionModifierState) => {
    const radians = THREE.MathUtils.degToRad(deg);
    if (!Number.isFinite(radians)) return;
    if (Math.abs(radians - userRotation[axisIdx]) < 1e-9) return;
    const nextUser: Vec3 = [...userRotation];
    nextUser[axisIdx] = radians;
    setObjectTransform(primary.id, { rotation: fromUserRotation(nextUser) }, !modifiers?.isScrubbing);
  };
  const smallestScale = Math.min(...userScale);
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
      const requestedRatio = factor / userScale[axisIdx];
      const nextSmallest = Math.max(MIN_SCALE, smallestScale * requestedRatio);
      if (nextSmallest === smallestScale) return;
      const nextScale = userScale.map(
        (value) => nextSmallest * (value / smallestScale),
      ) as Vec3;
      if (!nextScale.every(Number.isFinite)) return;
      setObjectTransform(primary.id, { scale: fromUserScale(nextScale) }, recordHistory);
      return;
    }
    const nextFactor = Math.max(MIN_SCALE, factor);
    if (nextFactor === userScale[axisIdx]) return;
    const nextScale: Vec3 = [...userScale];
    nextScale[axisIdx] = nextFactor;
    setObjectTransform(primary.id, { scale: fromUserScale(nextScale) }, recordHistory);
  };

  return (
    <section className="kura-card" data-transform-focus={focus}>
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
          <span className="kura-field-label" id="kura-precision-translate-label" title={t(language, 'inspector.axisHintTip')}>{positionLabel}</span>
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
            limit={fromMm(MAX_ABS_COORDINATE * 2, unitSystem)}
            disabled={transformDisabled}
            onApply={(delta) => {
              const position = userPosition.map(
                (value, index) => value + toMm(delta[index], unitSystem),
              ) as Vec3;
              if (position.every(Number.isFinite)) {
                setObjectTransform(primary.id, { position: fromUserPosition(position) }, true);
              }
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
                unit={unitSystem}
                min={fromMm(-MAX_ABS_COORDINATE, unitSystem)}
                max={fromMm(MAX_ABS_COORDINATE, unitSystem)}
                strictRange
                defaultValue={0}
                disabled={transformDisabled}
                value={Number(fromMm(userPosition[idx], unitSystem).toFixed(unitPrecision))}
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
          <span className="kura-field-label" id="kura-precision-rotate-label" title={t(language, 'inspector.axisHintTip')}>{rotationLabel}</span>
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
              limit={ROTATION_LIMIT_DEG}
              disabled={transformDisabled}
              onApply={(delta) => {
                const rotation = userRotation.map(
                  (value, index) => value + THREE.MathUtils.degToRad(delta[index]),
                ) as Vec3;
                if (rotation.every(Number.isFinite)) {
                  setObjectTransform(primary.id, { rotation: fromUserRotation(rotation) }, true);
                }
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
                min={-ROTATION_LIMIT_DEG}
                max={ROTATION_LIMIT_DEG}
                strictRange
                defaultValue={0}
                disabled={transformDisabled}
                value={Number(THREE.MathUtils.radToDeg(userRotation[idx]).toFixed(2))}
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
            const baseSize = fromMm(userDimensions[idx], unitSystem);
            const precision = scaleBySize ? unitPrecision : 4;
            const value = scaleBySize ? baseSize * userScale[idx] : userScale[idx];
            const minimumFactor = proportionalScale && smallestScale > 0
              ? MIN_SCALE * (userScale[idx] / smallestScale)
              : MIN_SCALE;
            return (
              <PrecisionNumberInput
                key={`${primary.id}:${scaleBySize ? unitSystem : 'factor'}:${axis}`}
                prefix={axis.toUpperCase()}
                axisTone={axis}
                step={scaleBySize ? stepUnit : 0.1}
                min={scaleBySize ? baseSize * minimumFactor : minimumFactor}
                max={scaleBySize ? baseSize * MAX_SCALE : MAX_SCALE}
                strictRange
                nonPositiveMessage={t(language, 'ux4.scale.positive')}
                precision={precision}
                commitOnBlur
                unit={scaleBySize ? unitSystem : null}
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
        <UnitDoubtLink object={primary} />
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
              onClick={() => mirrorObject(primary.id, internalAxisOfUser(axis).axis)}
            >
              <FlipHorizontal2 size={12} />
              <span>{axis.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
