/**
 * @file src/core/scene/arrangeApply.ts
 * @description Aplicar un plan de «Repartir en placas» a la escena (función pura, compartida por el store de la app y
 * el MCP sin interfaz): crea las placas del plan (la implícita se vuelve explícita y recibe los sólidos sin placa),
 * asigna `plateRef` y mueve cada pieza. En armado traslada la pose de impresión (`restPose`), no la figura. También
 * traduce las claves del plan (`implicit`, `new:N`) a ids reales en el informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { SceneObject } from '../../types/kura';
import type { SceneLayout, ScenePlate } from '../../types/plates';
import { IMPLICIT_PLATE_KEY, newPlatesUsed, type ArrangePlan, type ArrangeReport } from './plateArrangeTypes';
import { nextPlateName, reconcilePlates, type PlateScene } from './plates';

export interface ArrangeApplyIds {
  makeId: () => string;
  nameFor: (n: number) => string;
}

/** Escena con el plan aplicado y el mapa clave del plan → id de placa (null = la implícita, que no tiene id). */
export function applyArrangePlan(
  scene: PlateScene & { layout: SceneLayout }, plan: ArrangePlan, ids: ArrangeApplyIds,
): { scene: PlateScene; keyToId: Map<string, string | null> } {
  const keyToId = new Map<string, string | null>(scene.plates.map((p) => [p.id, p.id]));
  let plates: ScenePlate[] = scene.plates;
  let objects: SceneObject[] = scene.objects;
  keyToId.set(IMPLICIT_PLATE_KEY, null);
  for (const c of plan.createdPlates) {
    const id = ids.makeId();
    const name = c.key === IMPLICIT_PLATE_KEY ? ids.nameFor(1) : nextPlateName(plates, ids.nameFor);
    plates = [...plates, { id, name, origin: [c.origin[0], c.origin[1]] }];
    keyToId.set(c.key, id);
    // La implícita se vuelve explícita y recibe los sólidos sin placa (como al crear la segunda placa a mano).
    if (c.key === IMPLICIT_PLATE_KEY) objects = objects.map((o) => (o.role === 'solid' && o.plateRef === undefined ? { ...o, plateRef: id } : o));
  }
  const byId = new Map(plan.placements.map((p) => [p.id, p]));
  objects = objects.map((o) => {
    const p = byId.get(o.id);
    if (!p) return o;
    const plateId = keyToId.get(p.plate) ?? null;
    const next: SceneObject = { ...o, ...(p.assignPlate && plateId ? { plateRef: plateId } : {}) };
    if (scene.layout === 'assembly') next.restPose = { position: [...p.position], rotation: [...p.rotation] };
    else {
      next.position = [...p.position];
      next.rotation = [...p.rotation];
    }
    return next;
  });
  return { scene: reconcilePlates({ objects, plates }, ids.nameFor), keyToId };
}

/** Informe con ids reales de placa en vez de las claves del plan. */
export function reportWithPlateIds(report: ArrangeReport, keyToId: ReadonlyMap<string, string | null>): ArrangeReport {
  const mapKey = (k: string) => keyToId.get(k) ?? k;
  return {
    ...report,
    // Con ids reales las claves «new:» desaparecen: el recuento de nuevas se conserva para el aviso.
    platesUsedNew: newPlatesUsed(report),
    platesUsed: report.platesUsed.map(mapKey),
    splitGroups: report.splitGroups.map((g) => ({ ...g, plates: g.plates.map(mapKey) })),
  };
}

/** Primera placa real usada por el plan (la que queda activa), si hay. */
export function firstUsedPlate(report: ArrangeReport, keyToId: ReadonlyMap<string, string | null>): string | undefined {
  return report.platesUsed.map((k) => keyToId.get(k)).find((id): id is string => typeof id === 'string');
}
