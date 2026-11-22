/**
 * @file src/components/viewport/LaserCutPreview.tsx
 * @description Vista previa láser del plano de corte (translúcido, con borde) y conectores fantasma
 * en el visor. El plano se arrastra con el ratón a lo largo de su eje (sin orbitar mientras tanto)
 * y publica el desplazamiento al panel de corte por `cutPlaneDrag`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo, useRef, useState } from 'react';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKuraStore } from '../../store/useKuraStore';
import { type Vec3 } from '../../types/kura';
import { cutOffsetRange } from '../../engine/cutConnectorSuggest';
import { closestAxisParam, emitCutPlaneDrag } from './cutPlaneDrag';

const AXIS_DIR = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export const LaserCutPreview: React.FC = () => {
  const cutPreview = useKuraStore((s) => s.cutPreview);
  const objects = useKuraStore((s) => s.objects);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const gl = useThree((s) => s.gl);
  const drag = useRef<{ startT: number; startOffset: number; min: number; max: number } | null>(null);
  const [hover, setHover] = useState(false);

  const targetObj = useMemo(() => {
    if (!cutPreview.active || !cutPreview.objectId) return null;
    return objects.find((o) => o.id === cutPreview.objectId) ?? null;
  }, [cutPreview.active, cutPreview.objectId, objects]);

  const previewGeometry = useMemo(() => {
    if (!targetObj) return null;
    const pos = targetObj.mesh.positions;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] * targetObj.scale[0];
      const y = pos[i + 1] * targetObj.scale[1];
      const z = pos[i + 2] * targetObj.scale[2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    const center = new THREE.Vector3(
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5,
    );
    const euler = new THREE.Euler(
      targetObj.rotation[0],
      targetObj.rotation[1],
      targetObj.rotation[2],
      'XYZ',
    );
    center.applyEuler(euler);
    center.add(new THREE.Vector3(...targetObj.position));

    const span =
      Math.max(
        20,
        targetObj.stats.dimensionsMm[0] * targetObj.scale[0],
        targetObj.stats.dimensionsMm[1] * targetObj.scale[1],
        targetObj.stats.dimensionsMm[2] * targetObj.scale[2],
      ) * 1.45;

    return { center, span };
  }, [targetObj]);

  if (!cutPreview.active || !targetObj || !previewGeometry) {
    return null;
  }

  const axisDir = AXIS_DIR[cutPreview.axis];
  const axisOrigin = previewGeometry.center;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    const startT = closestAxisParam(e.ray, axisOrigin, axisDir);
    if (startT === null) return;
    e.stopPropagation();
    const range = cutOffsetRange(targetObj, cutPreview.axis);
    drag.current = { startT, startOffset: cutPreview.offset, min: range.min, max: range.max };
    if (controls) controls.enabled = false;
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const now = closestAxisParam(e.ray, axisOrigin, axisDir);
    if (now === null) return;
    const next = Math.min(d.max, Math.max(d.min, Math.round((d.startOffset + now - d.startT) * 2) / 2));
    if (next !== cutPreview.offset) emitCutPlaneDrag(next);
  };
  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    if (controls) controls.enabled = true;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
  };
  const setCursor = (value: string) => {
    gl.domElement.style.cursor = value;
  };

  const { center, span } = previewGeometry;
  const planePos: Vec3 = [center.x, center.y, center.z];
  let planeRot: Vec3 = [-Math.PI / 2, 0, 0];
  let connRot: Vec3 = [0, 0, 0];

  if (cutPreview.axis === 'x') {
    planePos[0] += cutPreview.offset;
    planeRot = [0, Math.PI / 2, 0];
    connRot = [0, 0, Math.PI / 2];
  } else if (cutPreview.axis === 'y') {
    planePos[1] += cutPreview.offset;
    planeRot = [-Math.PI / 2, 0, 0];
    connRot = [0, 0, 0];
  } else {
    planePos[2] += cutPreview.offset;
    planeRot = [0, 0, 0];
    connRot = [Math.PI / 2, 0, 0];
  }

  const count = Math.max(1, Math.min(4, cutPreview.connectorCount));
  const connectorOffsets: Vec3[] = [];
  const spread = Math.min(span * 0.24, Math.max(8, cutPreview.connectorSize * 2.8));

  for (let i = 0; i < count; i++) {
    let u = 0;
    let v = 0;
    if (count === 2) {
      u = i === 0 ? -spread : spread;
    } else if (count === 3) {
      const ang = (i * Math.PI * 2) / 3;
      u = Math.cos(ang) * spread;
      v = Math.sin(ang) * spread;
    } else if (count === 4) {
      u = i % 2 === 0 ? -spread : spread;
      v = i < 2 ? -spread : spread;
    }

    if (cutPreview.axis === 'x') {
      connectorOffsets.push([planePos[0], planePos[1] + u, planePos[2] + v]);
    } else if (cutPreview.axis === 'y') {
      connectorOffsets.push([planePos[0] + u, planePos[1], planePos[2] + v]);
    } else {
      connectorOffsets.push([planePos[0] + u, planePos[1] + v, planePos[2]]);
    }
  }

  return (
    <group>
      <mesh
        position={planePos}
        rotation={planeRot}
        renderOrder={20}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => {
          setHover(true);
          setCursor(cutPreview.axis === 'y' ? 'ns-resize' : 'ew-resize');
        }}
        onPointerOut={() => {
          setHover(false);
          if (!drag.current) setCursor('');
        }}
      >
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={hover ? 0.4 : 0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments position={planePos} rotation={planeRot} renderOrder={22}>
        <edgesGeometry args={[new THREE.PlaneGeometry(span, span)]} />
        <lineBasicMaterial color="#f97316" transparent opacity={0.95} depthWrite={false} />
      </lineSegments>
      {cutPreview.connectorType !== 'none' &&
        connectorOffsets.map((pos, idx) => (
          <mesh key={`dot-${idx}`} position={pos} renderOrder={23}>
            <sphereGeometry args={[Math.max(0.8, cutPreview.connectorSize * 0.35), 14, 10]} />
            <meshBasicMaterial color="#0ea5e9" depthTest={false} depthWrite={false} />
          </mesh>
        ))}

      {cutPreview.connectorType !== 'none' &&
        connectorOffsets.map((pos, idx) => (
          <mesh key={idx} position={pos} rotation={connRot} renderOrder={21}>
            {cutPreview.connectorType === 'peg' || cutPreview.connectorType === 'dovetail' ? (
              <boxGeometry
                args={[
                  cutPreview.connectorSize * 1.6,
                  cutPreview.connectorDepth * 1.4,
                  cutPreview.connectorSize * 1.6,
                ]}
              />
            ) : (
              <cylinderGeometry
                args={[
                  cutPreview.connectorSize,
                  cutPreview.connectorSize,
                  cutPreview.connectorDepth * 1.4,
                  20,
                ]}
              />
            )}
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  );
};
