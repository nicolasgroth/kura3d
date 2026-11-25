/**
 * @file src/core/scene/splitFrame.ts
 * @description Dónde caen las placas virtuales de «Dividir para imprimir» cuando la escena tiene placas reales
 * (funciones puras). Regla:
 * - La placa virtual 0 de una pieza es su placa real (`plateRef`): su origen y su cama. Sin placa (o sin placas en
 *   la escena), el origen del mundo y la cama del proyecto, como siempre.
 * - Las placas virtuales 1, 2, … siguen la cuadrícula de siempre (`plateOffset`: `SPLIT_PLATE_COLUMNS` columnas hacia
 *   +X, filas hacia −Z, paso = cama + `SPLIT_PLATE_GAP_MM`) pero anclada al origen de esa placa, y se saltan las celdas
 *   que no quedan separadas al menos `SPLIT_PLATE_GAP_MM` de otra placa real. Sin otras placas el resultado es bit a
 *   bit el de siempre.
 * - Las placas virtuales no se vuelven placas reales (eso es otro lote): las partes conservan el `plateRef` de su placa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { projectBed as projectBedOf, type PlateBedSource } from './activePlateBed';
import { bedsSeparated, findPlate, plateBed, PLATE_GAP_MM, type ProjectBed } from './plates';
import { MAX_SPLIT_PLATES, plateOffset, type SplitFrame, type SplitFrames, type SplitGroup } from './splitGroups';

/** Lo que define los marcos: placas de la escena y cama del proyecto (la de las placas sin cama propia). */
export interface SplitPlateSource {
  plates: readonly ScenePlate[];
  projectBed: ProjectBed;
}

/**
 * Tope fijo de celdas recorridas por marco, independiente de la entrada (cada placa real bloquea pocas celdas; es un
 * seguro ante datos externos). Si no alcanza, o el índice pasa de `MAX_SPLIT_PLATES`, se usa la celda sin saltos.
 */
export const MAX_SPLIT_FRAME_SCAN = 4096;

/** Marco de las piezas de la placa `plate` (null = sin placa: origen del mundo y cama del proyecto). */
export function splitFrameFor(plate: ScenePlate | null, source: SplitPlateSource): SplitFrame {
  const bed = plateBed(plate, source.projectBed);
  const [ox, oz] = plate ? plate.origin : [0, 0];
  const others = source.plates.filter((p) => p !== plate).map((p) => ({ x: p.origin[0], z: p.origin[1], bed: plateBed(p, source.projectBed) }));
  const cell = (k: number): [number, number] => {
    const [dx, dz] = plateOffset(k, bed.widthMm, bed.depthMm);
    return ox === 0 && oz === 0 ? [dx, dz] : [ox + dx, oz + dz];
  };
  if (others.length === 0) return { widthMm: bed.widthMm, depthMm: bed.depthMm, center: cell };
  const centers: Array<[number, number]> = [cell(0)];
  let k = 0;
  const free = ([x, z]: [number, number]) => others.every((o) => bedsSeparated(x, z, bed, o.x, o.z, o.bed, PLATE_GAP_MM));
  const center = (plate: number): [number, number] => {
    if (!Number.isInteger(plate) || plate < 0 || plate >= MAX_SPLIT_PLATES) return cell(plate);
    while (centers.length <= plate && k < MAX_SPLIT_FRAME_SCAN) {
      const c = cell(++k);
      if (free(c)) centers.push(c);
    }
    const found = centers[plate];
    return found ? [found[0], found[1]] : cell(plate);
  };
  return { widthMm: bed.widthMm, depthMm: bed.depthMm, center };
}

/** Marco de cada pieza según su `plateRef` (memorizado por placa). */
export function splitFramesOf(source: SplitPlateSource): SplitFrames {
  const cache = new Map<string, SplitFrame>();
  return (part: Pick<SceneObject, 'plateRef'>) => {
    const plate = findPlate(source.plates, part.plateRef);
    const key = plate?.id ?? '';
    let frame = cache.get(key);
    if (!frame) {
      frame = splitFrameFor(plate, source);
      cache.set(key, frame);
    }
    return frame;
  };
}

/** Placa real del grupo: la de la mayoría de sus piezas (empate: la que aparece primero); null = sin placa. */
export function splitGroupPlate(group: SplitGroup, plates: readonly ScenePlate[]): ScenePlate | null {
  const counts = new Map<string, number>();
  for (const o of group.parts) {
    const p = findPlate(plates, o.plateRef);
    if (p) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > counts.get(best)!) best = id;
  return findPlate(plates, best);
}

/** Marco del grupo (guías, rótulos): el de su placa real. */
export function splitGroupFrame(group: SplitGroup, source: SplitPlateSource): SplitFrame {
  return splitFrameFor(splitGroupPlate(group, source.plates), source);
}

/** Fuente de marcos a partir del estado del store (perfil, medidas personalizadas y placas). */
export function splitPlateSourceOf(state: Pick<PlateBedSource, 'printerProfile' | 'customBedDimensions' | 'plates'>): SplitPlateSource {
  return { plates: state.plates ?? [], projectBed: projectBedOf(state) };
}
