/**
 * @file src/components/viewport/AddonCatcher.tsx
 * @description Piezas comunes de las capas de colocación de agregados (imán, torreta): la copia invisible y apenas
 * agrandada de una pieza sólida que recibe el cursor antes que la pieza (con el cursor en cruz), y la vista previa
 * de una forma visible a través de la pieza con contorno doble (línea clara y línea oscura) que contrasta con
 * cualquier color de pieza y en ambos temas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SceneObject, Vec3 } from '../../types/kura';
import { useMagnetCursor } from './magnetCursor';
import type { AddonPlacementHandlers } from './useAddonPlacement';

const NO_RAYCAST = () => null;

export const AddonCatcher: React.FC<{ obj: SceneObject; handlers: AddonPlacementHandlers; tag: string }> = ({ obj, handlers, tag }) => {
  const cursor = useMagnetCursor();
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(obj.mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(obj.mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [obj.mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={obj.position}
      rotation={obj.rotation}
      // Apenas más grande para que el rayo la toque antes que la pieza real; el punto exacto se recalcula sobre la cara.
      scale={[obj.scale[0] * 1.003, obj.scale[1] * 1.003, obj.scale[2] * 1.003]}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerOut={handlers.onPointerOut}
      onClick={handlers.onClick}
      onPointerOver={cursor.onPointerOver}
      onPointerLeave={cursor.onPointerLeave}
      userData={{ [tag]: obj.id }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** Una forma de la vista previa: geometría local (base en el origen, eje +Y) con su color. */
export interface GhostPart {
  geometry: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
  color: string;
}

/** Vista previa en `position`/`rotation`, dibujada encima de la pieza (sin prueba de profundidad). */
export const AddonGhost: React.FC<{ position: Vec3; rotation: Vec3; parts: readonly (GhostPart & { offset?: Vec3 })[] }> = ({ position, rotation, parts }) => (
  <group position={position} rotation={rotation} renderOrder={40}>
    {parts.map((p, i) => (
      <group key={i} position={p.offset ?? [0, 0, 0]}>
        <mesh geometry={p.geometry} raycast={NO_RAYCAST} renderOrder={40}>
          <meshBasicMaterial color={p.color} transparent opacity={0.55} depthTest={false} depthWrite={false} />
        </mesh>
        <lineSegments geometry={p.edges} scale={[1.06, 1, 1.06]} raycast={NO_RAYCAST} renderOrder={41}>
          <lineBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={p.edges} raycast={NO_RAYCAST} renderOrder={42}>
          <lineBasicMaterial color="#111827" depthTest={false} depthWrite={false} />
        </lineSegments>
      </group>
    ))}
  </group>
);
