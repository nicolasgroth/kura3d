/**
 * @file src/components/viewport/plateBedStatus.ts
 * @description Estado de la cama por placa (sin React): cada pieza se evalúa contra la cama de SU placa, sumando el
 * origen de esa placa. Las piezas sin placa no cuentan. `sceneBedStatus` es el estado único del pie del visor y de
 * las camas: con menos de dos placas es exactamente `bedStatusOf` (la interfaz de siempre); con varias, el peor de
 * todas las placas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { plateBed } from '../../core/scene/plates';
import type { PrinterProfile, SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { bedStatusOf, type BedStatus } from '../split/splitAssembledStatus';
import { checkObjectsOutOfBounds } from './viewportHelpers';

/** Estado de una placa: `empty` si no tiene piezas. */
export type PlateStatus = BedStatus | 'empty';

export interface PlateStatusEntry {
  plateId: string;
  status: PlateStatus;
  /** Piezas asignadas a la placa. */
  count: number;
}

/** Perfil con la cama de la placa (la propia o la del perfil activo). */
export function plateProfile(profile: PrinterProfile, plate: ScenePlate): PrinterProfile {
  const bed = plateBed(plate, { widthMm: profile.bedWidthMm, depthMm: profile.bedDepthMm, heightMm: profile.maxHeightMm });
  return { ...profile, bedWidthMm: bed.widthMm, bedDepthMm: bed.depthMm, maxHeightMm: bed.heightMm };
}

/** Piezas de la placa vistas desde su propio origen (centradas en la cama), para medirlas como siempre. */
function localTo(plate: ScenePlate, objects: readonly SceneObject[]): SceneObject[] {
  const [ox, oz] = plate.origin;
  return objects.filter((o) => o.plateRef === plate.id).map((o) => (ox === 0 && oz === 0 ? o : { ...o, position: [o.position[0] - ox, o.position[1], o.position[2] - oz] as SceneObject['position'] }));
}

/** Estado de cada placa, en el orden de `plates`. */
export function platesBedStatus(objects: readonly SceneObject[], profile: PrinterProfile, plates: readonly ScenePlate[]): PlateStatusEntry[] {
  return plates.map((plate) => {
    const own = localTo(plate, objects);
    const count = own.length;
    if (count === 0) return { plateId: plate.id, status: 'empty', count };
    return { plateId: plate.id, status: bedStatusOf(own, plateProfile(profile, plate)), count };
  });
}

/** Ids de las piezas imprimibles de `plates` que exceden la cama de su placa. */
export function outOfBoundsIds(objects: readonly SceneObject[], profile: PrinterProfile, plates: readonly ScenePlate[], isPrintable: (o: SceneObject) => boolean): string[] {
  const out: string[] = [];
  for (const plate of plates) {
    const local = plateProfile(profile, plate);
    for (const o of localTo(plate, objects)) if (isPrintable(o) && o.visible && checkObjectsOutOfBounds([o], local)) out.push(o.id);
  }
  return out;
}

/** Estado único de la escena: como siempre con 0 o 1 placas; con varias, el peor de las placas (las sin placa no cuentan). */
export function sceneBedStatus(objects: SceneObject[], profile: PrinterProfile, plates: readonly ScenePlate[] = []): BedStatus {
  if (plates.length < 2) return bedStatusOf(objects, profile);
  const all = platesBedStatus(objects, profile, plates).map((e) => e.status);
  if (all.includes('outOfBounds')) return 'outOfBounds';
  return all.includes('assembled') ? 'assembled' : 'ok';
}
