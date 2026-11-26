/**
 * @file src/components/split/SplitJointHighlight.tsx
 * @description Resalta en el visor la unión señalada en la lista "Uniones": contorno grueso con color de
 * acento (ámbar en oscuro, naranja oscuro en claro, para tener contraste en ambos) de las dos
 * piezas que une, el resto del grupo atenuado (`useSplitJointDimmed`) y, si el grupo está armado y sin explosionar, esferas en los centros de sus
 * conectores (los guardados en la pieza, con su radio). No toca mallas ni selección y no recibe clics.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { groupJointRecords } from '../../core/scene/splitJointStatus';
import { effectiveFirmness, type JointFirmness } from '../../core/scene/jointFirmness';
import { explodedSplitPositions, splitGroupOf, splitIsAssembled } from '../../core/scene/splitGroups';
import { useKuraStore } from '../../store/useKuraStore';
import { computeWorldBounds } from '../viewport/viewportHelpers';
import { useResolvedDarkScheme } from '../dialogs/useResolvedDarkScheme';

/** Color de acento del resalte según el esquema (contraste con el fondo del visor en ambos). */
const TINT_DARK = '#fbbf24';
const TINT_LIGHT = '#c2410c';
/** Grosor del contorno en píxeles. */
const OUTLINE_PX = 4;

/** Color y patrón del contorno según la firmeza de la unión (el patrón distingue el nivel sin depender del color). */
const FIRMNESS_TINT: Record<JointFirmness, { dark: string; light: string; dash: { dashSize: number; gapSize: number } | null }> = {
  firm: { dark: '#4ade80', light: '#15803d', dash: null },
  fair: { dark: '#facc15', light: '#a16207', dash: { dashSize: 4, gapSize: 2 } },
  weak: { dark: '#fb923c', light: '#c2410c', dash: { dashSize: 1.5, gapSize: 1.5 } },
  glue: { dark: '#22d3ee', light: '#0e7490', dash: { dashSize: 0.6, gapSize: 2 } },
};

/** Las 12 aristas de una caja centrada en el origen, como pares de puntos. */
export function boxEdgePoints(size: [number, number, number]): Array<[number, number, number]> {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const c = (i: number): [number, number, number] => [i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz];
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) out.push(c(i), c(i | bit));
  return out;
}

/** `true` para las piezas del grupo que NO forman parte de la unión señalada (se dibujan atenuadas). */
export function useSplitJointDimmed(obj: { metadata?: { split?: { groupId: string; joints?: Array<{ label: string }> } } }): boolean {
  return useKuraStore((s) => {
    const f = s.splitJointFocus;
    const sp = obj.metadata?.split;
    return Boolean(f && sp && sp.groupId === f.groupId && !(sp.joints ?? []).some((j) => j.label === f.label));
  });
}

export const SplitJointHighlight: React.FC = () => {
  const focus = useKuraStore((s) => s.splitJointFocus);
  const objects = useKuraStore((s) => s.objects);
  const explode = useKuraStore((s) => s.splitExplode);
  const colorScheme = useKuraStore((s) => s.colorScheme);
  const dark = useResolvedDarkScheme(colorScheme);
  const tint = dark ? TINT_DARK : TINT_LIGHT;

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
    // Armado no depende de la cama ni de la placa: es la pose de `metadata.split.assembly`.
    const showCenters = factor === 0 && splitIsAssembled(group);
    const firmness = record.strength ? effectiveFirmness(record.strength) : null;
    return { boxes, centers: showCenters ? record.connectorCenters : [], radius: Math.max(1, record.connector?.size ?? 2), firmness };
  }, [focus, objects, explode]);

  const edges = useMemo(() => (data ? data.boxes.map((b) => ({ ...b, points: boxEdgePoints(b.size) })) : []), [data]);

  if (!data) return null;
  // Con firmeza guardada el contorno toma el color y el patrón de su nivel; sin ella, el acento de siempre.
  const level = data.firmness ? FIRMNESS_TINT[data.firmness] : null;
  const color = level ? (dark ? level.dark : level.light) : tint;
  const dash = level?.dash ?? null;
  return (
    <group raycast={() => null}>
      {edges.map((e) => (
        <group key={e.key} position={e.center}>
          <mesh renderOrder={20} raycast={() => null}>
            <boxGeometry args={e.size} />
            <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <Line points={e.points} segments lineWidth={OUTLINE_PX} color={color} {...(dash ? { dashed: true, ...dash } : {})} depthTest={false} transparent renderOrder={21} raycast={() => null} />
        </group>
      ))}
      {data.centers.map((c, i) => (
        <mesh key={i} position={c} renderOrder={22} raycast={() => null}>
          <sphereGeometry args={[data.radius, 16, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
};
