/**
 * @file src/components/viewport/GroupTransformGizmo.tsx
 * @description Manipulador del visor para un grupo o una selección múltiple: un nodo auxiliar en el
 * centro de la caja del conjunto recibe el arrastre y el store aplica la transformación a todos los
 * miembros como cuerpo rígido con el mismo pivote que el inspector (`rigidPivot`: escala desde la base,
 * giro desde el centro; escala siempre proporcional).
 * Un arrastre es un paso de deshacer; Escape lo cancela (lo gestiona `useGizmoDrag`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { gizmoRigidDelta, selectionPivot } from '../../core/scene/groupTransform';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';
import { useUserAxisGizmoColors } from './gizmoAxisColors';

type Baseline = Array<Pick<SceneObject, 'id' | 'position' | 'rotation' | 'scale'>>;

export const GroupTransformGizmo: React.FC<{
  epoch: number;
  ctrlHeld: boolean;
  onDragChange: (dragging: boolean) => void;
}> = ({ epoch, ctrlHeld, onDragChange }) => {
  const gizmoAxesRef = useUserAxisGizmoColors();
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const transformMode = useKuraStore((s) => s.transformMode);
  const snapGridMm = useKuraStore((s) => s.snapGridMm);
  const transformSelectionRigid = useKuraStore((s) => s.transformSelectionRigid);
  const commitTransformSnapshot = useKuraStore((s) => s.commitTransformSnapshot);
  const [proxy, setProxy] = useState<THREE.Group | null>(null);
  const drag = useRef<{ baseline: Baseline; start: Vec3 } | null>(null);

  // Un arrastre cancelado (Escape) remonta el manipulador: se olvida la base del arrastre.
  useEffect(() => {
    drag.current = null;
  }, [epoch]);

  const members = useMemo(() => objects.filter((o) => selectedIds.includes(o.id)), [objects, selectedIds]);
  // El nodo auxiliar vuelve al centro del conjunto cuando no se arrastra.
  const pivot = useMemo(() => selectionPivot(members), [members]);
  if (proxy && !drag.current) {
    proxy.position.set(pivot[0], pivot[1], pivot[2]);
    proxy.rotation.set(0, 0, 0);
    proxy.scale.set(1, 1, 1);
  }

  return (
    <>
      <group ref={setProxy} />
      {proxy && proxy.parent && (
        <TransformControls
          key={epoch}
          ref={gizmoAxesRef}
          object={proxy}
          mode={transformMode}
          size={0.78}
          translationSnap={ctrlHeld || snapGridMm > 0 ? (snapGridMm > 0 ? snapGridMm : 1) : null}
          rotationSnap={ctrlHeld ? Math.PI / 12 : snapGridMm > 0 ? THREE.MathUtils.degToRad(5) : null}
          scaleSnap={ctrlHeld ? 0.1 : snapGridMm > 0 ? 0.05 : null}
          onMouseDown={() => {
            const s = useKuraStore.getState();
            const baseline = s.objects
              .filter((o) => s.selectedIds.includes(o.id))
              .map((o) => ({ id: o.id, position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3 }));
            // El pivote lo decide el store (`rigidPivot`), igual que en el inspector: escalar crece
            // desde la base del conjunto; girar usa el centro de la caja.
            drag.current = { baseline, start: [proxy!.position.x, proxy!.position.y, proxy!.position.z] };
            onDragChange(true);
          }}
          onMouseUp={() => {
            drag.current = null;
            onDragChange(false);
            commitTransformSnapshot();
          }}
          onObjectChange={() => {
            const d = drag.current;
            if (!d) return;
            const delta = gizmoRigidDelta(transformMode, d.start, {
              position: [proxy.position.x, proxy.position.y, proxy.position.z],
              rotation: [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z],
              scale: [proxy.scale.x, proxy.scale.y, proxy.scale.z],
            });
            // Escala proporcional: el nodo auxiliar muestra el mismo factor en los tres ejes.
            if (delta.scale !== undefined) proxy.scale.setScalar(delta.scale);
            transformSelectionRigid(delta, { baseline: d.baseline });
          }}
        />
      )}
    </>
  );
};
