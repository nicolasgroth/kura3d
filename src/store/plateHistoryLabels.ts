/**
 * @file src/store/plateHistoryLabels.ts
 * @description Nombre de los pasos de placas en el historial de deshacer (crear, borrar y renombrar placas, mover
 * piezas a otra placa), deducido comparando la escena antes y después. Sin esto, esos pasos aparecían como «Otro
 * cambio». Devuelve null si el paso no tocó las placas (lo nombra `describeChange`). Sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import type { LanguageCode, SceneObject } from '../types/kura';
import type { ScenePlate } from '../types/plates';
import { samePlateBed } from '../core/scene/plateBedChange';

/**
 * Etiqueta del paso si cambió la lista de placas o la placa de alguna pieza: crear, borrar, renombrar o mover.
 * `before` / `after` son las placas y las piezas de cada lado del paso.
 */
export function describePlateChange(
  language: LanguageCode,
  before: { plates: readonly ScenePlate[]; objects: readonly SceneObject[] },
  after: { plates: readonly ScenePlate[]; objects: readonly SceneObject[] },
): string | null {
  const beforeById = new Map(before.plates.map((p) => [p.id, p]));
  const afterById = new Map(after.plates.map((p) => [p.id, p]));
  const created = after.plates.filter((p) => !beforeById.has(p.id));
  const removed = before.plates.filter((p) => !afterById.has(p.id));
  // Crear la segunda placa vuelve explícita la primera (también «nueva»): el nombre es el de la última.
  if (created.length > 0 && removed.length === 0) return t(language, 'plates.history.create', { name: created[created.length - 1].name });
  if (removed.length > 0 && created.length === 0) return t(language, 'plates.history.delete', { name: removed[0].name });
  const renamed = after.plates.find((p) => beforeById.has(p.id) && beforeById.get(p.id)!.name !== p.name);
  if (renamed) return t(language, 'plates.history.rename', { name: renamed.name });
  // Cama de una placa (P7): el paso puede además recolocar placas vecinas, pero lo que pidió el usuario es la cama.
  const rebedded = after.plates.find((p) => beforeById.has(p.id) && !samePlateBed(beforeById.get(p.id)!.bed, p.bed));
  if (rebedded) {
    return rebedded.bed
      ? t(language, 'plates.history.bed', { name: rebedded.name, bed: rebedded.bed.name })
      : t(language, 'plates.history.bedProject', { name: rebedded.name });
  }
  const beforeRefs = new Map(before.objects.map((o) => [o.id, o.plateRef]));
  const moved = after.objects.filter((o) => beforeRefs.has(o.id) && beforeRefs.get(o.id) !== o.plateRef && o.plateRef !== undefined);
  if (moved.length === 0) return null;
  const dest = afterById.get(moved[0].plateRef!)?.name ?? '';
  return moved.length === 1
    ? t(language, 'plates.history.move.one', { piece: moved[0].name, name: dest })
    : t(language, 'plates.history.move.many', { count: moved.length, name: dest });
}
