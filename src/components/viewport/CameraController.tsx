/**
 * @file src/components/viewport/CameraController.tsx
 * @description Controlador de cámara del visor: presets de vista y encuadre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { type CameraPresetType, useKuraStore } from '../../store/useKuraStore';

export const CameraController: React.FC<{
  orbitRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ orbitRef }) => {
  const { camera } = useThree();
  const cameraRequest = useKuraStore((s) => s.cameraRequest);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const printerProfile = useKuraStore((s) => s.printerProfile);

  const snapshotRef = useRef({ objects, selectedIds, printerProfile });
  snapshotRef.current = { objects, selectedIds, printerProfile };

  useEffect(() => {
    if (!cameraRequest) return;
    const controls = orbitRef.current;
    const {
      objects: curObjects,
      selectedIds: curSelectedIds,
      printerProfile: curProfile,
    } = snapshotRef.current;

    const applyView = (preset: CameraPresetType) => {
      const target = new THREE.Vector3(0, 15, 0);
      let distance = Math.max(130, curProfile.bedWidthMm * 0.65);

      if (preset === 'fit' && curObjects.length > 0) {
        const focusObjs =
          curSelectedIds.length > 0
            ? curObjects.filter((o) => curSelectedIds.includes(o.id))
            : curObjects;
        const box = new THREE.Box3();
        for (const obj of focusObjs) {
          const [sx, sy, sz] = obj.scale;
          const [dx, dy, dz] = obj.stats.dimensionsMm;
          const half = new THREE.Vector3(
            Math.max(1, dx * sx * 0.5),
            Math.max(1, dy * sy * 0.5),
            Math.max(1, dz * sz * 0.5),
          );
          const center = new THREE.Vector3(
            obj.position[0],
            obj.position[1] + half.y * 0.2,
            obj.position[2],
          );
          box.expandByPoint(center.clone().sub(half));
          box.expandByPoint(center.clone().add(half));
        }
        if (!box.isEmpty()) {
          box.getCenter(target);
          const size = box.getSize(new THREE.Vector3());
          distance = Math.max(55, size.length() * 1.45);
        }
      }

      switch (preset) {
        case 'top':
          camera.position.set(target.x, target.y + distance * 1.3, target.z + 0.01);
          break;
        case 'front':
          camera.position.set(target.x, target.y + distance * 0.15, target.z + distance * 1.25);
          break;
        case 'right':
          camera.position.set(target.x + distance * 1.25, target.y + distance * 0.15, target.z);
          break;
        case 'iso':
        case 'fit':
        default:
          camera.position.set(
            target.x + distance * 0.72,
            target.y + distance * 0.62,
            target.z + distance * 0.85,
          );
          break;
      }

      if (controls) {
        controls.target.copy(target);
        controls.update();
      } else {
        camera.lookAt(target);
      }
    };

    applyView(cameraRequest.preset);
  }, [cameraRequest, camera, orbitRef]);

  return null;
};

/**
 * Silueta 3D de cama e impresora multi-marca:
 * - Marco exterior de placa PEI + escuadras L en esquinas con acento por marca
 * - Zona frontal de purga (`purgeZoneMm`)
 * - Placa identificativa con marca, modelo y dimensiones exactas
 * - Jaula de volumen con borde rojo de alerta cuando algún sólido excede los límites
 */
