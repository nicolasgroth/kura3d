/**
 * @file src/components/split/useSplitExplode.ts
 * @description Posición visual de una pieza en la vista explosionada de su grupo (solo dibujo: no
 * cambia la escena ni el historial). Devuelve la posición de la pieza si no hay explosión activa o
 * si el grupo no está armado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useMemo } from 'react';
import { explodedSplitPositions, splitGroupOf, splitIsAssembled } from '../../core/scene/splitGroups';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

export function useSplitExplodedPosition(obj: SceneObject): Vec3 {
  const explode = useKuraStore((s) => s.splitExplode);
  const groupId = obj.metadata?.split?.groupId ?? null;
  const active = Boolean(explode && groupId && explode.groupId === groupId && explode.factor > 0);
  const objects = useKuraStore((s) => (active ? s.objects : null));
  const positions = useMemo(() => {
    if (!active || !objects || !explode) return null;
    const group = splitGroupOf(objects, obj.id);
    if (!group || !splitIsAssembled(group)) return null;
    return explodedSplitPositions(group, explode.factor);
  }, [active, objects, explode, obj.id]);
  return positions?.get(obj.id) ?? obj.position;
}
