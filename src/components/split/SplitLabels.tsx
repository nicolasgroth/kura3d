/**
 * @file src/components/split/SplitLabels.tsx
 * @description Reúne los rótulos del visor de Dividir y se los pasa a la capa HTML: el código de cada pieza
 * prevista en el plan, el de cada pieza del resultado (armado, explosionado o preparado para imprimir; son
 * los mismos códigos del árbol de Escena, de Uniones y de los nombres de archivo) y "Placa N" de las placas
 * de impresión. Los de pieza dependen de la casilla "Mostrar rótulos de pieza"; los de placa no.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { t } from '../../i18n';
import {
  explodedSplitPositions,
  plateOffsetX,
  splitArrangementOf,
  splitGroupOf,
  splitPlateCount,
} from '../../core/scene/splitGroups';
import { activeBed } from '../../store/splitCommandSchemas';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';
import { computeWorldBounds } from '../viewport/viewportHelpers';
import { SplitLabelLayer, type SplitLabelItem } from './SplitLabelLayer';

type Bounds = ReturnType<typeof computeWorldBounds>;
const boundsCache = new WeakMap<SceneObject, Bounds>();
const boundsOf = (obj: SceneObject): Bounds => {
  let b = boundsCache.get(obj);
  if (!b) {
    b = computeWorldBounds(obj);
    boundsCache.set(obj, b);
  }
  return b;
};

export const SplitLabels: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const show = useKuraStore((s) => s.splitLabels);
  const objects = useKuraStore((s) => s.objects);
  const explode = useKuraStore((s) => s.splitExplode);
  const preview = useKuraStore((s) => s.splitPlanPreview);
  const selectedId = useKuraStore((s) => s.selectedIds[0] ?? null);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  const bed = activeBed({ printerProfile, customBedDimensions: customBed });

  const items = useMemo<SplitLabelItem[]>(() => {
    const out: SplitLabelItem[] = [];

    if (show) {
      const plan = preview.plan;
      if (plan && preview.status !== 'idle' && plan.pieces.length > 1) {
        const dimmed = preview.status === 'pending';
        for (const piece of plan.pieces) {
          const { min, max } = piece.bounds;
          out.push({
            id: `plan:${piece.code}`,
            text: piece.code,
            anchor: [(min[0] + max[0]) / 2, max[1], (min[2] + max[2]) / 2],
            radiusMm: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2,
            kind: 'piece',
            extra: piece.rotated ? `↻ ${t(language, 'split.rotated')}` : undefined,
            title: piece.rotated ? t(language, 'split.rotatedTip') : undefined,
            dimmed,
          });
        }
      }

      const groups = new Map<string, SceneObject[]>();
      for (const o of objects) {
        const g = o.metadata?.split?.groupId;
        if (g && o.visible !== false) groups.set(g, [...(groups.get(g) ?? []), o]);
      }
      for (const [groupId, parts] of groups) {
        const group = splitGroupOf(objects, parts[0].id);
        const moved =
          explode && explode.groupId === groupId && explode.factor > 0 && group && splitArrangementOf(group, bed.widthMm) === 'assembly'
            ? explodedSplitPositions(group, explode.factor)
            : null;
        for (const o of parts) {
          const b = boundsOf(o);
          const to: Vec3 | undefined = moved?.get(o.id);
          const dx = to ? to[0] - o.position[0] : 0;
          const dy = to ? to[1] - o.position[1] : 0;
          const dz = to ? to[2] - o.position[2] : 0;
          out.push({
            id: `obj:${o.id}`,
            text: o.metadata!.split!.code,
            anchor: [(b.minX + b.maxX) / 2 + dx, b.maxY + dy, (b.minZ + b.maxZ) / 2 + dz],
            radiusMm: Math.hypot(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ) / 2,
            kind: 'piece',
          });
        }
      }
    }

    // Placas de impresión del grupo seleccionado (la 1 es la cama real).
    const group = splitGroupOf(objects, selectedId);
    if (group && splitArrangementOf(group, bed.widthMm) === 'print') {
      const plates = splitPlateCount(group);
      for (let plate = 0; plate < plates; plate++) {
        out.push({
          id: `plate:${plate}`,
          text: t(language, 'split.plate', { n: plate + 1 }),
          anchor: [plateOffsetX(plate, bed.widthMm), 0.1, bed.depthMm / 2 + 12],
          radiusMm: 0,
          kind: 'plate',
        });
      }
    }
    return out;
  }, [show, language, objects, explode, preview, selectedId, bed.widthMm, bed.depthMm]);

  return <SplitLabelLayer items={items} />;
};
