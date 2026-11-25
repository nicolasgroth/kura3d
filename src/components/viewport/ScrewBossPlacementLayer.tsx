/**
 * @file src/components/viewport/ScrewBossPlacementLayer.tsx
 * @description Capa del visor para la torreta para tornillo (solo con su panel abierto): las piezas sólidas reciben
 * el cursor con la copia invisible común (`AddonCatcher`) y sobre la cara bajo el cursor se dibuja la vista previa
 * de la torreta, el poste (color de la pieza de ayuda) y el agujero (naranja de los negativos), con las mismas
 * medidas y el mismo eje que las piezas que se crearían. El hundimiento en caras curvas lo calcula el Worker; aquí
 * se usa el mínimo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bossHoleMesh, bossPostMesh, placeScrewBoss } from '../../core/addons/screwBoss';
import { isSolid } from '../../core/scene/objectRole';
import { placeScrewBossAt, setScrewBossHover, useScrewBossPanel } from '../../store/screwBossPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { AddonCatcher, AddonGhost, type GhostPart } from './AddonCatcher';
import { useAddonPlacement, type AddonPlacementTarget } from './useAddonPlacement';

const TARGET: AddonPlacementTarget = {
  setHover: (hover) => setScrewBossHover(hover),
  hoverHostId: () => useScrewBossPanel.getState().hover?.hostId,
  place: (hostId, point, normal) => placeScrewBossAt(hostId, point, normal),
  radiusMm: () => useScrewBossPanel.getState().params.outerDiameterMm / 2,
};

const Catcher: React.FC<{ obj: SceneObject }> = ({ obj }) => {
  const handlers = useAddonPlacement(obj, TARGET);
  return <AddonCatcher obj={obj} handlers={handlers} tag="screwBossCatcher" />;
};

const toGeometry = (mesh: MeshData) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return g;
};

const ghostPart = (mesh: MeshData, color: string): GhostPart => {
  const geometry = toGeometry(mesh);
  return { geometry, edges: new THREE.EdgesGeometry(geometry, 20), color };
};

const BossGhost: React.FC = () => {
  const hover = useScrewBossPanel((s) => s.hover);
  const params = useScrewBossPanel((s) => s.params);
  const blocked = useScrewBossPanel((s) => s.blocked);
  const plan = hover && !blocked ? placeScrewBoss(params, hover.point, hover.normal) : null;
  const seat = plan?.seatMm ?? 0;
  const parts = useMemo(() => {
    if (blocked) return null;
    return { post: ghostPart(bossPostMesh(params, seat), '#94a3b8'), hole: ghostPart(bossHoleMesh(params), '#f97316') };
  }, [params, seat, blocked]);
  useEffect(() => () => {
    for (const p of parts ? [parts.post, parts.hole] : []) {
      p.geometry.dispose();
      p.edges.dispose();
    }
  }, [parts]);
  if (!plan || !parts) return null;
  // Las dos piezas comparten rotación; el agujero va desplazado sobre el eje local desde la base del poste.
  const holeOffset: Vec3 = [0, plan.seatMm + params.heightMm - params.holeDepthMm, 0];
  return <AddonGhost position={plan.post.position} rotation={plan.rotation} parts={[parts.post, { ...parts.hole, offset: holeOffset }]} />;
};

export const ScrewBossPlacementLayer: React.FC = () => {
  const open = useScrewBossPanel((s) => s.open);
  const objects = useKuraStore((s) => s.objects);
  // Un poste de torreta no es anfitrión de otra torreta (se une a su pieza al restar).
  const hosts = useMemo(() => objects.filter((o) => o.visible && isSolid(o) && !o.locked && !o.metadata?.addon), [objects]);
  if (!open) return null;
  return (
    <group name="screw-boss-placement">
      {hosts.map((o) => <Catcher key={o.id} obj={o} />)}
      <BossGhost />
    </group>
  );
};
