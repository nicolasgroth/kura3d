/**
 * @file src/components/viewport/PaintBrushCursor.tsx
 * @description Previsualización del pincel de pintura en el visor: un anillo del radio real (mm de mundo)
 * apoyado sobre la superficie bajo el puntero y orientado según la normal de la cara. La posición se
 * guarda en un objeto mutable (no en el store) para no re-renderizar React a la frecuencia del puntero.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useKuraStore } from '../../store/useKuraStore';

const cursor = {
  visible: false,
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(0, 1, 0),
};

const normalMatrix = new THREE.Matrix3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** El cursor no debe interceptar el rayo del puntero. */
const noRaycast = () => undefined;

/** Actualiza el cursor con el punto y la normal (en mundo) de la cara bajo el puntero. */
export function updatePaintCursor(e: ThreeEvent<PointerEvent>): void {
  cursor.point.copy(e.point);
  if (e.face) {
    normalMatrix.getNormalMatrix(e.object.matrixWorld);
    cursor.normal.copy(e.face.normal).applyMatrix3(normalMatrix).normalize();
  }
  cursor.visible = true;
}

export function hidePaintCursor(): void {
  cursor.visible = false;
}

export const PaintBrushCursor: React.FC = () => {
  const radius = useKuraStore((s) => s.paintRadiusMm);
  const color = useKuraStore((s) => s.paintColor);
  const mode = useKuraStore((s) => s.paintMode);
  const ref = useRef<THREE.Group>(null);
  // Anillo unitario escalado al radio: cambiar el radio no recrea geometría.
  const ring = useMemo(() => new THREE.RingGeometry(0.92, 1, 48), []);
  const disc = useMemo(() => new THREE.CircleGeometry(1, 48), []);
  useEffect(() => () => {
    ring.dispose();
    disc.dispose();
  }, [ring, disc]);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    group.visible = cursor.visible && mode === 'brush';
    if (!group.visible) return;
    // Se separa levemente de la superficie para que no parpadee con la malla.
    group.position.copy(cursor.point).addScaledVector(cursor.normal, 0.05);
    group.quaternion.setFromUnitVectors(Z_AXIS, cursor.normal);
    group.scale.setScalar(radius);
  });

  return (
    <group ref={ref} visible={false} renderOrder={20}>
      <mesh geometry={ring} raycast={noRaycast}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={disc} raycast={noRaycast}>
        <meshBasicMaterial color={color} transparent opacity={0.28} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
