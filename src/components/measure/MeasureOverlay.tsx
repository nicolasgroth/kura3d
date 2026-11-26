/**
 * @file src/components/measure/MeasureOverlay.tsx
 * @description Capa del visor de la herramienta Medir: punto de imán bajo el cursor, puntos en curso,
 * líneas y etiquetas de distancia y ángulo, regiones de área resaltadas y el "líquido" translúcido
 * de la capacidad. Se dibuja encima de las piezas (sin prueba de profundidad) y no toca la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useMeasureStore } from '../../store/measureStore';
import { resolveMeasurements, type ResolvedMeasurement } from '../../store/measureResolve';
import { useKuraStore } from '../../store/useKuraStore';
import type { MeshData, Vec3 } from '../../types/kura';
import { formatAngle, formatArea, formatLength } from '../../utils/measureUnits';
import '../../store/measureSceneSync';
import '../../styles/measure.css';
import { MeasureMissHint } from './MeasureMissHint';

const LINE = '#f59e0b';
const SNAP_COLORS = { vertex: '#ef4444', 'edge-mid': '#22c55e', 'face-center': '#3b82f6', surface: '#f59e0b' } as const;
const ON_TOP = 999;

const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

const Dot: React.FC<{ at: Vec3; color: string; size?: number }> = ({ at, color, size = 0.9 }) => (
  <mesh position={at} renderOrder={ON_TOP}>
    <sphereGeometry args={[size, 12, 8]} />
    <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
  </mesh>
);

/** Etiqueta legible sobre cualquier color de pieza y en ambos temas (pastilla con borde). */
const Label: React.FC<{ at: Vec3; text: string }> = ({ at, text }) => (
  <Html position={at} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
    <span className="kura-measure-label">{text}</span>
  </Html>
);

const Seg: React.FC<{ points: Vec3[]; dashed?: boolean }> = ({ points, dashed }) => (
  <Line
    points={points}
    color={LINE}
    lineWidth={2.5}
    dashed={dashed}
    dashSize={2}
    gapSize={1.2}
    depthTest={false}
    renderOrder={ON_TOP}
  />
);

/** Geometría a partir de triángulos sueltos (región de área). */
function useTriangles(positions: Float32Array): THREE.BufferGeometry {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

const AreaHighlight: React.FC<{ positions: Float32Array }> = ({ positions }) => {
  const geo = useTriangles(positions);
  return (
    <mesh geometry={geo} renderOrder={ON_TOP - 1}>
      <meshBasicMaterial color={LINE} transparent opacity={0.45} side={THREE.DoubleSide} depthTest={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
};

const Liquid: React.FC<{ mesh: MeshData }> = ({ mesh }) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={ON_TOP - 2}>
      {/* Sin prueba de profundidad: el nivel se ve a través de la pared, como un vaso transparente. */}
      <meshStandardMaterial color="#1d4ed8" emissive="#1e3a8a" emissiveIntensity={0.6} transparent opacity={0.7} depthWrite={false} depthTest={false} roughness={0.2} />
    </mesh>
  );
};

const MeasurementShape: React.FC<{ m: ResolvedMeasurement }> = ({ m }) => {
  const unit = useKuraStore((s) => s.unitSystem);
  const lang = useKuraStore((s) => s.language);
  switch (m.kind) {
    case 'distance':
      return (
        <group>
          <Dot at={m.a} color={LINE} size={0.6} />
          <Dot at={m.b} color={LINE} size={0.6} />
          <Seg points={[m.a, m.b]} />
          <Label at={mid(m.a, m.b)} text={formatLength(m.distanceMm, unit, lang)} />
        </group>
      );
    case 'angle':
      return (
        <group>
          {m.points.map((p, i) => <Dot key={i} at={p} color={LINE} size={0.6} />)}
          <Seg points={[m.points[0], m.points[1], m.points[2]]} />
          <Label at={m.points[1]} text={formatAngle(m.deg, lang)} />
        </group>
      );
    case 'faceAngle':
      return (
        <group>
          {m.points.map((p, i) => <Dot key={i} at={p} color={LINE} size={0.6} />)}
          <Seg points={m.points} dashed />
          <Label at={mid(m.points[0], m.points[1])} text={formatAngle(m.deg, lang)} />
        </group>
      );
    case 'area':
      return (
        <group>
          <AreaHighlight positions={m.highlight} />
          <Label at={m.centroid} text={formatArea(m.areaMm2, unit, lang)} />
        </group>
      );
  }
};

export const MeasureOverlay: React.FC = () => {
  const all = useMeasureStore((s) => s.measurements);
  const pending = useMeasureStore((s) => s.pending);
  const hover = useMeasureStore((s) => s.hover);
  const mode = useMeasureStore((s) => s.mode);
  const capacity = useMeasureStore((s) => s.capacity);
  const objects = useKuraStore((s) => s.objects);
  // En Capacidad solo se ve el líquido; las mediciones desactualizadas no se dibujan (no hay valor fiable).
  const measurements = useMemo(
    () => (mode === 'capacity' ? [] : resolveMeasurements(all, objects).filter((m) => !m.stale)),
    [all, objects, mode],
  );
  const current = capacity ? objects.find((o) => o.id === capacity.objectId) : undefined;
  const showLiquid = mode === 'capacity' && capacity?.liquid && current === capacity.source;

  return (
    <group name="kura-measure-overlay">
      {measurements.map((m) => <MeasurementShape key={m.id} m={m} />)}
      {pending.map((p, i) => <Dot key={i} at={p.point} color={LINE} size={0.7} />)}
      {pending.length > 0 && hover && mode !== 'area' && <Seg points={[pending[pending.length - 1].point, hover.point]} dashed />}
      {hover && <Dot at={hover.point} color={SNAP_COLORS[hover.kind]} size={hover.kind === 'surface' ? 0.5 : 0.9} />}
      {showLiquid && <Liquid mesh={capacity!.liquid!} />}
      <MeasureMissHint />
    </group>
  );
};
