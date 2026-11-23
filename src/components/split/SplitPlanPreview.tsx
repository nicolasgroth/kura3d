/**
 * @file src/components/split/SplitPlanPreview.tsx
 * @description Vista previa del plan de división en el visor, sin tocar la escena: planos de corte
 * como láminas translúcidas con borde (los que no admiten unión, con borde discontinuo y rótulo de
 * aviso), cajas de cada pieza prevista (su código lo rotula `SplitLabels`; las que irán acostadas, marcadas).
 * Cada plano se arrastra a lo largo de su eje y publica la posición al panel por `splitPlaneDrag`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { t } from '../../i18n';
import type { PlannedPiece, SplitAxis, SplitPlane } from '../../engine';
import { useKuraStore } from '../../store/useKuraStore';
import { closestAxisParam } from '../viewport/cutPlaneDrag';
import { emitSplitPlaneMove, planeKey } from './splitPlaneDrag';
import { userAxisLabel } from '../../core/scene/displayAxes';

const AXIS_INDEX: Record<SplitAxis, number> = { x: 0, y: 1, z: 2 };
const AXIS_DIR: Record<SplitAxis, THREE.Vector3> = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const OK_COLOR = '#f97316';
const WARN_COLOR = '#eab308';

/** Lámina de un plano con su borde; arrastrable. */
const PlaneSheet: React.FC<{
  plane: SplitPlane;
  min: THREE.Vector3;
  max: THREE.Vector3;
  noJoint: boolean;
  active: boolean;
  dimmed: boolean;
}> = ({ plane, min, max, noJoint, active, dimmed }) => {
  const language = useKuraStore((s) => s.language);
  const setActive = useKuraStore((s) => s.setSplitActivePlane);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);
  const [hover, setHover] = useState(false);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const drag = useRef<{ startT: number; start: number } | null>(null);
  const a = AXIS_INDEX[plane.axis];
  const pos = dragPos ?? plane.position;

  // Medidas de la lámina: la caja del modelo en los otros dos ejes, con un 12 % de margen.
  const { w, h, rotation } = useMemo(() => {
    const ext = [max.x - min.x, max.y - min.y, max.z - min.z].map((v) => Math.max(10, v * 1.12));
    if (plane.axis === 'x') return { w: ext[2], h: ext[1], rotation: [0, Math.PI / 2, 0] as const };
    if (plane.axis === 'y') return { w: ext[0], h: ext[2], rotation: [-Math.PI / 2, 0, 0] as const };
    return { w: ext[0], h: ext[1], rotation: [0, 0, 0] as const };
  }, [plane.axis, min, max]);
  const edges = useMemo(() => {
    const g = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
    return g;
  }, [w, h]);
  useEffect(() => () => edges.dispose(), [edges]);
  const lineRef = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    lineRef.current?.computeLineDistances();
  }, [edges, noJoint]);

  // Al llegar el plan nuevo se suelta la posición local del arrastre.
  useEffect(() => {
    if (!drag.current) setDragPos(null);
  }, [plane.position]);

  const center = new THREE.Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  const position: [number, number, number] = [center.x, center.y, center.z];
  position[a] = pos;
  const color = noJoint ? WARN_COLOR : OK_COLOR;
  const lo = [min.x, min.y, min.z][a];
  const hi = [max.x, max.y, max.z][a];

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const startT = closestAxisParam(e.ray, center, AXIS_DIR[plane.axis]);
    if (startT === null) return;
    e.stopPropagation();
    drag.current = { startT, start: plane.position };
    setActive(planeKey(plane.axis, plane.index));
    if (controls) controls.enabled = false;
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const now = closestAxisParam(e.ray, center, AXIS_DIR[plane.axis]);
    if (now === null) return;
    const next = Math.min(hi, Math.max(lo, Math.round(d.start + now - d.startT)));
    setDragPos(next);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    drag.current = null;
    if (controls) controls.enabled = true;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    if (dragPos !== null && dragPos !== plane.position) emitSplitPlaneMove({ axis: plane.axis, index: plane.index, position: dragPos });
  };

  const emphasis = active || hover || dragPos !== null;
  return (
    <group position={position} rotation={rotation as unknown as [number, number, number]}>
      <mesh
        renderOrder={20}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => {
          setHover(true);
          gl.domElement.style.cursor = plane.axis === 'y' ? 'ns-resize' : 'ew-resize';
        }}
        onPointerOut={() => {
          setHover(false);
          if (!drag.current) gl.domElement.style.cursor = '';
        }}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={(emphasis ? 0.34 : 0.2) * (dimmed ? 0.6 : 1)}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments ref={lineRef} geometry={edges} renderOrder={22} raycast={() => null}>
        {noJoint ? (
          <lineDashedMaterial color={color} dashSize={8} gapSize={6} transparent opacity={0.95} depthWrite={false} />
        ) : (
          <lineBasicMaterial color={color} transparent opacity={emphasis ? 1 : 0.8} depthWrite={false} />
        )}
      </lineSegments>
      <Html position={[w / 2, h / 2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span className="kura-split-plane-tag" data-no-joint={noJoint || undefined} data-active={active || undefined}>
          {t(language, 'split.planeName', { axis: userAxisLabel(plane.axis), n: plane.index + 1 })}
          {noJoint ? ` · ${t(language, 'split.noJoint')}` : ''}
          {dragPos !== null ? ` · ${Math.round(dragPos)} mm` : ''}
        </span>
      </Html>
    </group>
  );
};

/** Caja de una pieza prevista con su código. */
const PieceBox: React.FC<{ piece: PlannedPiece; dimmed: boolean }> = ({ piece, dimmed }) => {
  const { min, max } = piece.bounds;
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const [sizeX, sizeY, sizeZ] = size;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(sizeX, sizeY, sizeZ)), [sizeX, sizeY, sizeZ]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group position={center}>
      <lineSegments geometry={edges} renderOrder={19} raycast={() => null}>
        <lineBasicMaterial color="#22d3ee" transparent opacity={dimmed ? 0.25 : 0.55} depthWrite={false} />
      </lineSegments>
    </group>
  );
};

export const SplitPlanPreview: React.FC = () => {
  const preview = useKuraStore((s) => s.splitPlanPreview);
  const activePlane = useKuraStore((s) => s.splitActivePlane);
  const plan = preview.plan;
  const bounds = useMemo(() => {
    if (!plan) return null;
    return { min: new THREE.Vector3(...plan.bounds.min), max: new THREE.Vector3(...plan.bounds.max) };
  }, [plan]);
  if (!plan || !bounds || preview.status === 'idle') return null;
  const dimmed = preview.status === 'pending';
  return (
    <group>
      {plan.planes.map((p) => (
        <PlaneSheet
          key={planeKey(p.axis, p.index)}
          plane={p}
          min={bounds.min}
          max={bounds.max}
          noJoint={Boolean(plan.connector) && !p.admitsConnectors}
          active={activePlane === planeKey(p.axis, p.index)}
          dimmed={dimmed}
        />
      ))}
      {plan.pieces.length > 1 && plan.pieces.map((piece) => <PieceBox key={piece.code} piece={piece} dimmed={dimmed} />)}
    </group>
  );
};
