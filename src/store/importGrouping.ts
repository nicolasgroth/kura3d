/**
 * @file src/store/importGrouping.ts
 * @description Agrupación en escena de lo importado: cada placa del laminador (Bambu/Orca) queda en un
 * grupo con su nombre («Placa N» si no lo tiene) y cada conjunto montado en un grupo con el nombre del
 * archivo. Devuelve también los avisos (cuántas placas, si juntas exceden la cama, montaje conservado).
 * Usa el modelo de grupos de `src/core/scene/groups.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as engine from '../engine';
import { MAX_GROUPS, MAX_GROUP_NAME } from '../core/scene/groups';
import { makeId } from '../core/scene/sceneObjects';
import type { BedSize } from '../core/scene/freeSpot';
import type { SceneGroup, SceneObject } from '../types/kura';
import type { Translate } from './modelImportNotices';

export interface ImportGrouping {
  /** Objetos creados con su `groupRef` (mismo orden que la entrada). */
  objects: SceneObject[];
  groups: SceneGroup[];
  notices: string[];
}

/** Ancho y fondo (mm) de la huella XZ de unas piezas colocadas. */
function footprintSize(placed: engine.PlacedPart[]): [number, number] {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of placed) {
    const pos = p.mesh.positions;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] + p.position[0];
      const z = pos[i + 2] + p.position[2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }
  return [maxX - minX, maxZ - minZ];
}

/**
 * Agrupa los objetos creados (`created[i]` viene de `placed[i]`) según los conjuntos de cada modelo.
 * No pasa de `MAX_GROUPS` contando los grupos que ya tiene la escena.
 */
export function groupImported(
  models: engine.ImportedModel[],
  placed: engine.PlacedPart[],
  created: SceneObject[],
  existingGroups: number,
  bed: BedSize | null,
  tr: Translate,
): ImportGrouping {
  const objects = [...created];
  const groups: SceneGroup[] = [];
  const notices: string[] = [];
  const indexOf = new Map<engine.ImportedPart, number>();
  placed.forEach((p, i) => indexOf.set(p.part, i));

  for (const model of models) {
    const clusters = engine.findImportClusters(model);
    const base = model.fileName.replace(/\.[^.]+$/, '');
    let assemblies = 0;
    for (const cluster of clusters) {
      const members = cluster.parts.map((i) => indexOf.get(model.parts[i])).filter((i): i is number => i !== undefined);
      if (members.length === 0 || (cluster.kind === 'assembly' && members.length < 2)) continue;
      if (existingGroups + groups.length >= MAX_GROUPS) break;
      const name = cluster.kind === 'plate'
        ? cluster.name ?? tr('importReal.plateName', { n: cluster.plateNumber })
        : assemblies > 0 ? `${base} ${assemblies + 1}` : base;
      const group: SceneGroup = { id: makeId('grp'), name: name.slice(0, MAX_GROUP_NAME), visible: true, locked: false, collapsed: false };
      groups.push(group);
      for (const i of members) objects[i] = { ...objects[i], groupRef: group.id };
      if (cluster.kind === 'assembly') assemblies++;
    }

    const plateCount = clusters.filter((c) => c.kind === 'plate').length;
    if (plateCount >= 2) {
      const mine = placed.filter((p) => model.parts.includes(p.part));
      const [w, d] = footprintSize(mine);
      notices.push(bed && (w > bed.width || d > bed.depth)
        ? tr('importReal.platesExceedBed', { name: model.fileName, count: plateCount, w: Math.round(w), d: Math.round(d), bw: Math.round(bed.width), bd: Math.round(bed.depth) })
        : tr('importReal.plates', { name: model.fileName, count: plateCount }));
    } else if (assemblies > 0) {
      notices.push(tr('importReal.assembled', { name: model.fileName }));
    }
  }
  return { objects, groups, notices };
}
