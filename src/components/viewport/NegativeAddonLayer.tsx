/**
 * @file src/components/viewport/NegativeAddonLayer.tsx
 * @description Capa del visor común de los agregados negativos que se colocan con clic (ojo de cerradura, paso de
 * cable), activa solo con su panel abierto: las piezas sólidas reciben el cursor con la copia invisible
 * (`AddonCatcher`) y sobre la cara bajo el cursor se dibuja la vista previa (naranja de los negativos) con las mismas
 * medidas y orientación que la pieza que se crearía. Cada agregado aporta sus mallas locales y su pose.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { isSolid } from '../../core/scene/objectRole';
import type { AddonHover } from '../../store/addonHover';
import type { AddonPanel } from '../../store/addonPanelStore';
import { useKuraStore } from '../../store/useKuraStore';
import type { MeshData, SceneObject, Vec3 } from '../../types/kura';
import { AddonCatcher, AddonGhost, type GhostPart } from './AddonCatcher';
import { useAddonPlacement, type AddonPlacementTarget } from './useAddonPlacement';

export interface NegativeAddonLayerProps<P, R> {
  name: string;
  tag: string;
  panel: AddonPanel<P, R>;
  /** Mallas locales de la vista previa (dependen solo de las medidas). */
  ghostMeshes: (params: P) => MeshData[];
  /** Pose de la vista previa sobre la cara bajo el cursor. */
  ghostPose: (params: P, hover: AddonHover) => { position: Vec3; rotation: Vec3 } | null;
}

const ghostPart = (mesh: MeshData): GhostPart => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return { geometry, edges: new THREE.EdgesGeometry(geometry, 20), color: '#f97316' };
};

const Catcher: React.FC<{ obj: SceneObject; target: AddonPlacementTarget; tag: string }> = ({ obj, target, tag }) => {
  const handlers = useAddonPlacement(obj, target);
  return <AddonCatcher obj={obj} handlers={handlers} tag={tag} />;
};

function Ghost<P, R>({ panel, ghostMeshes, ghostPose }: Pick<NegativeAddonLayerProps<P, R>, 'panel' | 'ghostMeshes' | 'ghostPose'>) {
  const hover = panel.usePanel((s) => s.hover);
  const params = panel.usePanel((s) => s.params);
  const blocked = panel.usePanel((s) => s.blocked);
  const parts = useMemo(() => (blocked ? null : ghostMeshes(params).map(ghostPart)), [params, blocked, ghostMeshes]);
  useEffect(() => () => {
    for (const p of parts ?? []) {
      p.geometry.dispose();
      p.edges.dispose();
    }
  }, [parts]);
  const pose = hover && parts ? ghostPose(params, hover) : null;
  if (!pose || !parts) return null;
  return <AddonGhost position={pose.position} rotation={pose.rotation} parts={parts} />;
}

export function NegativeAddonLayer<P, R>({ name, tag, panel, ghostMeshes, ghostPose }: NegativeAddonLayerProps<P, R>) {
  const open = panel.usePanel((s) => s.open);
  const objects = useKuraStore((s) => s.objects);
  const target = useMemo<AddonPlacementTarget>(() => ({
    setHover: panel.setHover,
    hoverHostId: () => panel.usePanel.getState().hover?.hostId,
    place: panel.placeAt,
  }), [panel]);
  // Un agregado no es anfitrión de otro.
  const hosts = useMemo(() => objects.filter((o) => o.visible && isSolid(o) && !o.locked && !o.metadata?.addon), [objects]);
  if (!open) return null;
  return (
    <group name={name}>
      {hosts.map((o) => <Catcher key={o.id} obj={o} target={target} tag={tag} />)}
      <Ghost panel={panel} ghostMeshes={ghostMeshes} ghostPose={ghostPose} />
    </group>
  );
}
