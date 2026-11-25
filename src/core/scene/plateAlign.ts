/**
 * @file src/core/scene/plateAlign.ts
 * @description Alinear y distribuir con placas (función pura): agrupa las piezas por su placa y alinea o acomoda
 * cada grupo dentro de la cama de SU placa (su medida y su origen). Nunca junta piezas de varias placas en una
 * sola cama ni deja una pieza en la cama de otra placa.
 *
 * Reglas:
 * - Una pieza con `plateRef` va con su placa.
 * - Un negativo sin placa (los huecos no se asignan) va con la placa sobre la que está, o con la activa si no está
 *   sobre ninguna; si perfora una pieza, viaja con ella como siempre.
 * - Un sólido «sin placa» habiendo placas se deja donde está: no cuenta para ninguna placa (como en fuera de
 *   volumen y exportar por placa), así que tampoco se acomoda en una.
 * - Sin placas, la cama del perfil en el origen (idéntico a antes).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { alignObjects } from '../operations/alignOperations';
import { change, type SceneChange } from '../operations/operationTypes';
import type { AlignMode, PrinterProfile, SceneObject } from '../../types/kura';
import { activePlateBed, projectBed, type PlateBedSource } from './activePlateBed';
import { footprintOf } from './freeSpot';
import { isNegative } from './objectRole';
import { plateAtPoint } from './plateMove';
import { plateFrameFor, shiftChangeXZ, type PlateFrame } from './plateFrame';
import { findPlate } from './plates';

export interface PlateAlignResult {
  change: SceneChange;
  moved: number;
  fitsBed: boolean;
  /** Cama del primer grupo que no cabe (para el aviso), o null si todo cabe. */
  overflow: PlateFrame | null;
}

/** Grupos de piezas por placa, en el orden de las placas (sin placas: un grupo con todo). */
export function groupTargetsByPlate(source: PlateBedSource, targets: readonly SceneObject[]): Array<{ frame: PlateFrame; targets: SceneObject[] }> {
  const plates = source.plates ?? [];
  if (plates.length === 0) return targets.length ? [{ frame: activePlateBed(source), targets: [...targets] }] : [];
  const base = projectBed(source);
  const active = activePlateBed(source).plateId;
  const byPlate = new Map<string, SceneObject[]>();
  for (const o of targets) {
    let id = findPlate(plates, o.plateRef)?.id ?? null;
    if (!id && isNegative(o)) {
      const fp = footprintOf(o.mesh, o.position, o.rotation, o.scale);
      id = (fp ? plateAtPoint(plates, base, (fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2)?.id : null) ?? active;
    }
    if (!id) continue;
    const list = byPlate.get(id);
    if (list) list.push(o);
    else byPlate.set(id, [o]);
  }
  return plates.filter((p) => byPlate.has(p.id)).map((p) => ({ frame: plateFrameFor(source, [{ plateRef: p.id }]), targets: byPlate.get(p.id)! }));
}

/**
 * Alinea (`mode`) cada grupo de placa por separado. `arrange_grid` acomoda en la cama de la placa y suma su origen;
 * los modos por eje alinean entre las piezas de la misma placa. Un único `SceneChange` (un paso de deshacer).
 */
export function alignPerPlate(
  scene: readonly SceneObject[], targets: readonly SceneObject[], mode: AlignMode, profile: PrinterProfile, source: PlateBedSource,
): PlateAlignResult {
  if (!source.plates?.length) {
    // Sin placas: la cama del perfil en el origen, exactamente como siempre.
    const aligned = alignObjects(scene, targets, mode, profile);
    return { ...aligned, overflow: aligned.fitsBed ? null : { bed: { widthMm: profile.bedWidthMm, depthMm: profile.bedDepthMm, heightMm: profile.maxHeightMm }, origin: [0, 0], plateId: null } };
  }
  const patches: SceneChange['patches'] = [];
  let moved = 0;
  let overflow: PlateFrame | null = null;
  for (const group of groupTargetsByPlate(source, targets)) {
    const { bed } = group.frame;
    const own: PrinterProfile = { ...profile, bedWidthMm: bed.widthMm, bedDepthMm: bed.depthMm, maxHeightMm: bed.heightMm };
    const aligned = alignObjects(scene, group.targets, mode, own);
    const shifted = mode === 'arrange_grid' ? shiftChangeXZ(aligned.change, group.frame.origin) : aligned.change;
    patches.push(...shifted.patches);
    moved += aligned.moved;
    if (!aligned.fitsBed && !overflow) overflow = group.frame;
  }
  return { change: change({ patches }), moved, fitsBed: overflow === null, overflow };
}
