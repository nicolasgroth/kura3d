/**
 * @file src/components/viewport/MagnetPlacementLayer.tsx
 * @description Capa del visor para el alojamiento de imán (solo con su panel abierto): una copia invisible y apenas
 * agrandada de cada pieza sólida recibe el cursor antes que la pieza (como «colocar con clic» de Proyectar), y la
 * vista previa del hueco (el negativo que se crearía) se dibuja sobre la cara bajo el cursor, visible a través
 * de la pieza, con un contorno de alto contraste (línea oscura y línea clara) para que se distinga sobre cualquier
 * color de pieza y en ambos temas. Las piezas comunes con la torreta están en `AddonCatcher`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import { placePocket } from '../../core/addons/magnetPocket';
import { isSolid } from '../../core/scene/objectRole';
import { useMagnetPanel } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { AddonCatcher, AddonGhost } from './AddonCatcher';
import { pocketGhostEdges, pocketGhostGeometry } from './pocketGhostGeometry';
import { useMagnetPlacement } from './useMagnetPlacement';

const Catcher: React.FC<{ obj: SceneObject }> = ({ obj }) => {
  const handlers = useMagnetPlacement(obj);
  return <AddonCatcher obj={obj} handlers={handlers} tag="magnetCatcher" />;
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
  return <AddonGhost position={plan.position} rotation={plan.rotation} parts={[{ geometry, edges, color: '#f97316' }]} />;
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
