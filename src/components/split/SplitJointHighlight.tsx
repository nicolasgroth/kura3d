/**
 * @file src/components/split/SplitJointHighlight.tsx
 * @description Resalta en el visor la unión señalada en la lista "Uniones": contorno ámbar de las dos
 * piezas que une y, si el grupo está armado y sin explosionar, esferas en los centros de sus
 * conectores (los guardados en la pieza, con su radio). No toca mallas ni selección y no recibe clics.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { groupJointRecords } from '../../core/scene/splitJointStatus';
import { explodedSplitPositions, splitArrangementOf, splitGroupOf } from '../../core/scene/splitGroups';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';
import { computeWorldBounds } from '../viewport/viewportHelpers';

const TINT = '#fbbf24';

export const SplitJointHighlight: React.FC = () => {
  const focus = useKuraStore((s) => s.splitJointFocus);
  const objects = useKuraStore((s) => s.objects);
  const explode = useKuraStore((s) => s.splitExplode);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);

  const data = useMemo(() => {
    if (!focus) return null;
    const first = objects.find((o) => o.metadata?.split?.groupId === focus.groupId);
    const group = first ? splitGroupOf(objects, first.id) : null;
    const record = group ? groupJointRecords(group).find((r) => r.label === focus.label) : null;
    if (!group || !record) return null;
    const factor = explode && explode.groupId === group.groupId ? explode.factor : 0;
    const moved = factor > 0 ? explodedSplitPositions(group, factor) : null;
    const boxes = group.parts
      .filter((o) => o.metadata.split.code === record.a || o.metadata.split.code === record.b)
      .map((o) => {
        const b = computeWorldBounds(o);
        const d = moved?.get(o.id);
        const dx = d ? d[0] - o.position[0] : 0, dy = d ? d[1] - o.position[1] : 0, dz = d ? d[2] - o.position[2] : 0;
        return {
          key: o.id,
          size: [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ] as [number, number, number],
          center: [(b.minX + b.maxX) / 2 + dx, (b.minY + b.maxY) / 2 + dy, (b.minZ + b.maxZ) / 2 + dz] as [number, number, number],
        };
      });
    const bed = activeBed({ printerProfile, customBedDimensions: customBed });
    const showCenters = factor === 0 && splitArrangementOf(group, bed.widthMm) === 'assembly';
    return { boxes, centers: showCenters ? record.connectorCenters : [], radius: Math.max(1, record.connector?.size ?? 2) };
  }, [focus, objects, explode, printerProfile, customBed]);

  const edges = useMemo(
    () => (data ? data.boxes.map((b) => ({ ...b, geo: new THREE.EdgesGeometry(new THREE.BoxGeometry(...b.size)) })) : []),
    [data],
  );
  useEffect(() => () => edges.forEach((e) => e.geo.dispose()), [edges]);

  if (!data) return null;
  return (
    <group raycast={() => null}>
      {edges.map((e) => (
        <group key={e.key} position={e.center}>
          <mesh renderOrder={20} raycast={() => null}>
            <boxGeometry args={e.size} />
            <meshBasicMaterial color={TINT} transparent opacity={0.14} depthWrite={false} />
          </mesh>
          <lineSegments geometry={e.geo} renderOrder={21} raycast={() => null}>
            <lineBasicMaterial color={TINT} transparent opacity={0.95} depthTest={false} />
          </lineSegments>
        </group>
      ))}
      {data.centers.map((c, i) => (
        <mesh key={i} position={c} renderOrder={22} raycast={() => null}>
          <sphereGeometry args={[data.radius, 16, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
};
