/**
 * @file src/components/viewport/MagnetPlacementLayer.tsx
 * @description Capa del visor para el alojamiento de imán (solo con su panel abierto): una copia invisible y apenas
 * agrandada de cada pieza sólida recibe el cursor antes que la pieza (como «colocar con clic» de Proyectar), y la
 * vista previa del hueco (el negativo que se crearía) se dibuja sobre la cara bajo el cursor, visible a través
 * de la pieza, con un contorno de alto contraste (línea oscura y línea clara) para que se distinga sobre cualquier
 * color de pieza y en ambos temas.
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
import { pocketGhostEdges, pocketGhostGeometry } from './pocketGhostGeometry';
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
  // Comparte con el negativo que se crearía la forma, las medidas y el eje (misma primitiva). NO comparte el largo de
  // la sobresalida: en una cara cóncava el hueco real sobresale más (lo calcula el Worker); aquí es la mínima.
  const primitive = plan?.primitive;
  const type = primitive?.type;
  const { height, radius, segments, width, depth } = primitive?.params ?? {};
  const geometry = useMemo(
    () => (type ? pocketGhostGeometry({ type, params: { height, radius, segments, width, depth } }) : null),
    [type, height, radius, segments, width, depth],
  );
  const edges = useMemo(() => (geometry ? pocketGhostEdges(geometry) : null), [geometry]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => edges?.dispose(), [edges]);
  if (!plan || !geometry || !edges) return null;
  return (
    <group position={plan.position} rotation={plan.rotation} renderOrder={40}>
      <mesh geometry={geometry} raycast={NO_RAYCAST} renderOrder={40}>
        <meshBasicMaterial color="#f97316" transparent opacity={0.55} depthTest={false} depthWrite={false} />
      </mesh>
      {/* Contorno doble: una línea clara apenas más ancha y una oscura encima; una de las dos contrasta con cualquier fondo. */}
      <lineSegments geometry={edges} scale={[1.06, 1, 1.06]} raycast={NO_RAYCAST} renderOrder={41}>
        <lineBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={edges} raycast={NO_RAYCAST} renderOrder={42}>
        <lineBasicMaterial color="#111827" depthTest={false} depthWrite={false} />
      </lineSegments>
    </group>
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
