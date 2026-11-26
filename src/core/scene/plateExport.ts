/**
 * @file src/core/scene/plateExport.ts
 * @description Exportar por placa (lote P6, funciones puras): cada pieza sale respecto de la cama de SU placa
 * (se resta el origen de la placa; la pose ya llega en impresión) y las piezas se reparten en un cubo por placa.
 *
 * Reglas:
 * - Sin placas o con una sola, un único cubo con todo: sin placas (o una en el origen) los objetos son los mismos
 *   (mismas referencias), así que los archivos no cambian; con una sola placa fuera del origen se resta su origen.
 * - Con dos o más placas, un cubo por placa con piezas, en el orden de las placas. Lo que no tiene placa (o apunta
 *   a una que no existe) se excluye y se cuenta para avisar.
 * - Un agregado (imán, torreta) sin placa propia va con la placa de su pieza.
 * - `platesWithOtherBed`: placas con cama propia de otro tamaño, que el 3MF del laminador (una sola cama) centra en una
 *   celda de la cama del proyecto, para avisarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { SceneObject } from '../../types/kura';
import type { ScenePlate } from '../../types/plates';
import { findPlate } from './plates';

export interface PlateExportBucket {
  /** Placa del cubo (null = sin placas: la escena tal cual). */
  plateId: string | null;
  /** Nombre de la placa (vacío sin placas). */
  name: string;
  /** Piezas del cubo, ya respecto de la cama de la placa. */
  objects: SceneObject[];
}

export interface PlateExportPlan {
  buckets: PlateExportBucket[];
  /** Piezas excluidas por no tener placa (solo con dos o más placas). */
  excluded: number;
}

/** Placa efectiva de un objeto: la suya, o la de su pieza si es un agregado sin placa. */
export function exportPlateOf(objects: readonly SceneObject[], plates: readonly ScenePlate[], o: SceneObject): ScenePlate | null {
  const own = findPlate(plates, o.plateRef);
  if (own) return own;
  const hostId = o.metadata?.addon?.hostId;
  const host = hostId ? objects.find((h) => h.id === hostId) : undefined;
  return host ? findPlate(plates, host.plateRef) : null;
}

const clean = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);

/** Copia del objeto trasladada −origen en X/Z (el mismo objeto si el origen es [0, 0]). */
export function relativeToOrigin(o: SceneObject, origin: readonly [number, number]): SceneObject {
  if (origin[0] === 0 && origin[1] === 0) return o;
  return { ...o, position: [clean(o.position[0] - origin[0]), o.position[1], clean(o.position[2] - origin[1])] };
}

/**
 * Objetos respecto de la cama de su placa y el desplazamiento aplicado a cada uno (solo los no nulos, por id):
 * con una sola placa todo se mide desde su origen; con varias, cada uno desde el de su placa (sin placa, igual).
 */
export function shiftForExport(
  objects: readonly SceneObject[], plates: readonly ScenePlate[],
): { objects: SceneObject[]; offsets: Record<string, [number, number]> } {
  const offsets: Record<string, [number, number]> = {};
  const out = objects.map((o) => {
    const plate = plates.length === 1 ? plates[0] : exportPlateOf(objects, plates, o);
    if (!plate) return o;
    const moved = relativeToOrigin(o, plate.origin);
    if (moved !== o) offsets[o.id] = [plate.origin[0], plate.origin[1]];
    return moved;
  });
  return { objects: out, offsets };
}

/**
 * Placas del archivo con cama propia de otro ancho o fondo que la del proyecto (en el orden de `plateIds`). El 3MF
 * de los laminadores supone una sola cama: esas placas van centradas en una celda del tamaño de la del proyecto.
 */
export function platesWithOtherBed(
  plates: readonly ScenePlate[], plateIds: ReadonlyArray<string | null>, bed: { widthMm: number; depthMm: number },
): ScenePlate[] {
  const differs = (p: ScenePlate) => !!p.bed && (Math.abs(p.bed.widthMm - bed.widthMm) > 1e-6 || Math.abs(p.bed.depthMm - bed.depthMm) > 1e-6);
  return plateIds.map((id) => findPlate(plates, id)).filter((p): p is ScenePlate => !!p && differs(p));
}

/** Reparte `targets` (en pose de impresión) en un cubo por placa, cada pieza respecto de su cama. */
export function planPlateExport(targets: readonly SceneObject[], plates: readonly ScenePlate[]): PlateExportPlan {
  if (plates.length < 2) {
    const origin = plates[0]?.origin ?? [0, 0];
    return { buckets: [{ plateId: plates[0]?.id ?? null, name: plates[0]?.name ?? '', objects: targets.map((o) => relativeToOrigin(o, origin)) }], excluded: 0 };
  }
  const byPlate = new Map<string, SceneObject[]>();
  let excluded = 0;
  for (const o of targets) {
    const plate = exportPlateOf(targets, plates, o);
    if (!plate) {
      excluded++;
      continue;
    }
    const list = byPlate.get(plate.id) ?? [];
    list.push(relativeToOrigin(o, plate.origin));
    byPlate.set(plate.id, list);
  }
  const buckets = plates.filter((p) => byPlate.has(p.id)).map((p) => ({ plateId: p.id, name: p.name, objects: byPlate.get(p.id)! }));
  return { buckets, excluded };
}
