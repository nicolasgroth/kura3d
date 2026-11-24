/**
 * @file src/components/viewport/MagnetPlacementLayer.tsx
 * @description Capa del visor para el alojamiento de imán (solo con su panel abierto): una copia invisible y apenas
 * agrandada de cada pieza sólida recibe el cursor antes que la pieza (como «colocar con clic» de Proyectar), y la
 * vista previa del hueco (el negativo que se crearía) se dibuja sobre la cara bajo el cursor, visible a través
 * de la pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { placePocket } from '../../core/addons/magnetPocket';
import { isSolid } from '../../core/scene/objectRole';
import { useMagnetPanel } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { useMagnetCursor } from './magnetCursor';
import { pocketGhostGeometry } from './pocketGhostGeometry';
import { useMagnetPlacement } from './useMagnetPlacement';

const NO_RAYCAST = () => null;

const Catcher: React.FC<{ obj: SceneObject }> = ({ obj }) => {
  const handlers = useMagnetPlacement(obj);
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
      userData={{ magnetCatcher: obj.id }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

const PocketGhost: React.FC = () => {
  const hover = useMagnetPanel((s) => s.hover);
  const params = useMagnetPanel((s) => s.params);
  const blocked = useMagnetPanel((s) => s.blocked);
  const plan = hover && !blocked ? placePocket(params, hover.point, hover.normal) : null;
  // Misma primitiva que crea el negativo: la vista previa no puede divergir del resultado.
  const primitive = plan?.primitive;
  const key = primitive ? `${primitive.type}:${JSON.stringify(primitive.params)}` : null;
  const geometry = useMemo(() => (primitive ? pocketGhostGeometry(primitive) : null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!plan || !geometry) return null;
  return (
    <mesh geometry={geometry} position={plan.position} rotation={plan.rotation} raycast={NO_RAYCAST} renderOrder={40}>
      <meshBasicMaterial color="#f97316" transparent opacity={0.55} depthTest={false} depthWrite={false} />
    </mesh>
  );
};

export const MagnetPlacementLayer: React.FC = () => {
  const open = useMagnetPanel((s) => s.open);
  const objects = useKuraStore((s) => s.objects);
  const hosts = useMemo(() => objects.filter((o) => o.visible && isSolid(o) && !o.locked), [objects]);
  if (!open) return null;
  return (
    <group name="magnet-placement">
      {hosts.map((o) => <Catcher key={o.id} obj={o} />)}
      <PocketGhost />
    </group>
  );
};
