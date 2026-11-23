/**
 * @file src/engine/io/threeMfPlates.ts
 * @description Placas de Bambu Studio / OrcaSlicer en un 3MF: lectura de `<plate>` de
 * `Metadata/model_settings.config` (id, nombre e instancias de objetos) y traducción a grupos de
 * ítems de `<build>` para la colocación y la agrupación en escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { ImportedPart, ImportedPlate } from './importTypes';
import { parseXmlAttrs } from './threeMfPackage';
import { forEachElement, forEachLeaf } from './xmlScan';

/** Placa del laminador: nombre (si lo tiene) e instancias de objetos raíz que lleva. */
export interface SlicerPlate {
  name?: string;
  instances: Array<{ objectId: string; instanceId: number }>;
}

/** Placas declaradas en `model_settings.config`, en orden de `plater_id`. */
export function readSlicerPlates(xml: string): SlicerPlate[] {
  const plates: Array<SlicerPlate & { id: number }> = [];
  forEachElement(xml, 'plate', ({ body: rawBody }) => {
    const body = rawBody ?? '';
    let id = plates.length + 1;
    let name: string | undefined;
    // Metadatos propios de la placa: los que no están dentro de un <model_instance>.
    let own = '';
    let cursor = 0;
    const instances: SlicerPlate['instances'] = [];
    forEachElement(body, 'model_instance', ({ body: instBody, start, end }) => {
      own += body.slice(cursor, start);
      cursor = end;
      let objectId: string | undefined;
      let instanceId = 0;
      forEachLeaf(instBody ?? '', 'metadata', (raw) => {
        const attrs = parseXmlAttrs(raw);
        if (attrs.key === 'object_id' && attrs.value) objectId = attrs.value;
        if (attrs.key === 'instance_id') instanceId = parseInt(attrs.value ?? '', 10) || 0;
      }, { skipOversized: true });
      if (objectId) instances.push({ objectId, instanceId });
    });
    forEachLeaf(own + body.slice(cursor), 'metadata', (raw) => {
      const attrs = parseXmlAttrs(raw);
      if (attrs.key === 'plater_id') id = parseInt(attrs.value ?? '', 10) || id;
      if (attrs.key === 'plater_name' && attrs.value?.trim()) name = attrs.value.trim().slice(0, 80);
    }, { skipOversized: true });
    plates.push({ id, name, instances });
  });
  plates.sort((a, b) => a.id - b.id);
  return plates.map(({ name, instances }) => ({ name, instances }));
}

/**
 * Placas del laminador expresadas como grupos de ítems de `<build>` (la n-ésima aparición de un
 * objeto es su `instance_id` n). Solo se devuelven si hay dos o más placas con piezas; cada ítem va en
 * una sola placa.
 */
export function platesOf(
  slicerPlates: SlicerPlate[],
  items: ReadonlyArray<{ objectId: string }>,
  parts: ImportedPart[],
): ImportedPlate[] | undefined {
  if (slicerPlates.length < 2) return undefined;
  const itemOf = new Map<string, number>();
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    const n = seen.get(item.objectId) ?? 0;
    seen.set(item.objectId, n + 1);
    itemOf.set(`${item.objectId}#${n}`, index);
  });
  const withParts = new Set(parts.map((p) => p.group));
  // Cada ítem pertenece a UNA placa (la primera que lo declara): placas repetidas o que apuntan a la
  // misma instancia no duplican piezas. Las placas que quedan vacías se descartan, así que nunca hay
  // más placas que ítems.
  const owner = new Map<number, number>();
  const plates: ImportedPlate[] = [];
  for (const plate of slicerPlates) {
    if (plates.length >= items.length) break;
    const groups: number[] = [];
    for (const inst of plate.instances) {
      const g = itemOf.get(`${inst.objectId}#${inst.instanceId}`);
      if (g === undefined || !withParts.has(g) || owner.has(g)) continue;
      owner.set(g, plates.length);
      groups.push(g);
    }
    if (groups.length > 0) plates.push({ name: plate.name, groups: groups.sort((a, b) => a - b) });
  }
  return plates.length >= 2 ? plates : undefined;
}
