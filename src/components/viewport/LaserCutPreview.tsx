/**
 * @file src/components/viewport/LaserCutPreview.tsx
 * @description Vista previa láser del plano de corte y conectores fantasma en el visor.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useKuraStore } from '../../store/useKuraStore';
import { type Vec3 } from '../../types/kura';

export const LaserCutPreview: React.FC = () => {
  const cutPreview = useKuraStore((s) => s.cutPreview);
  const objects = useKuraStore((s) => s.objects);

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
      <mesh position={planePos} rotation={planeRot} renderOrder={20}>
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

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
