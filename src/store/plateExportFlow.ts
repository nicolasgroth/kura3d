/**
 * @file src/store/plateExportFlow.ts
 * @description Exportar con placas (lote P6), compartido por el diálogo y el Command Bus: cada pieza respecto de
 * la cama de su placa; con piezas de dos o más placas, un ZIP con un archivo por placa (nombre de la placa
 * saneado) o, en 3MF, un solo archivo con todas las placas para Bambu Studio / OrcaSlicer. Lo que no tiene placa
 * se excluye y se cuenta. Sin placas, todo queda igual que antes (mismos objetos, mismos archivos).
 *
 * 3MF con placas reales frente a grupos: con dos o más placas reales, ellas definen las placas del laminador y
 * los grupos raíz ya no (los grupos siguen viajando en los metadatos de escena). Con una placa o ninguna, los
 * grupos raíz siguen siendo placas del laminador como siempre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { zipSync } from 'fflate';
import type { ExportTaskArgs, ExportTaskResult } from '../core/operations/engineTasks';
import { isPrintable } from '../core/scene/objectRole';
import { exportPlateOf, planPlateExport, shiftForExport, type PlateExportBucket } from '../core/scene/plateExport';
import type { ThreeMfPlateLayout } from '../engine/io/threeMfExport';
import type { SceneObject } from '../types/kura';
import type { ScenePlate } from '../types/plates';
import { sanitizeFileBase } from '../utils/exportNaming';

/** Con piezas de varias placas en 3MF: un archivo con todas las placas o un 3MF por placa en un ZIP. */
export type PlateExportMode = 'combined' | 'perPlate';

/** Nombres que Windows reserva (con o sin extensión): dentro del ZIP se les antepone «_». */
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;

/** Nombre base seguro de la entrada del ZIP de una placa: sin rutas ni caracteres reservados. */
export function plateEntryBase(name: string, index: number): string {
  const clean = sanitizeFileBase(name).replace(/\.+/g, '_').slice(0, 80);
  const base = clean || `plate_${index + 1}`;
  return RESERVED.test(base) ? `_${base}` : base;
}

/** Piezas del alcance que son de la placa `plateId` (las demás quedan fuera). */
export function onlyPlate(targets: readonly SceneObject[], plates: readonly ScenePlate[], plateId: string): SceneObject[] {
  return targets.filter((o) => exportPlateOf(targets, plates, o)?.id === plateId);
}

/** Exporta cada placa por separado y las empaqueta en un ZIP (`<placa>.<ext>`, auxiliares con el mismo nombre). */
export async function zipPerPlate(
  buckets: readonly PlateExportBucket[],
  args: Omit<ExportTaskArgs, 'targets' | 'baseName'>,
  exportFiles: (a: ExportTaskArgs) => Promise<ExportTaskResult>,
): Promise<{ data: Uint8Array; names: string[] }> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  const names: string[] = [];
  for (const [i, bucket] of buckets.entries()) {
    let stem = plateEntryBase(bucket.name, i);
    for (let n = 2; used.has(stem.toLowerCase()); n++) stem = `${plateEntryBase(bucket.name, i)}_${n}`;
    used.add(stem.toLowerCase());
    const { files } = await exportFiles({ ...args, targets: bucket.objects, baseName: stem });
    for (const f of files) entries[`${stem}${f.suffix}`] = f.data;
    names.push(`${stem}.${args.format}`);
  }
  return { data: zipSync(entries, { level: 6 }), names };
}

/** Lo que va en un único archivo con placas: objetos ya colocados y, en 3MF, las placas del laminador. */
export interface SingleFilePlan {
  targets: SceneObject[];
  plateLayout?: ThreeMfPlateLayout;
  /** Placas con piezas en el archivo. */
  plateCount: number;
  /** Piezas imprimibles excluidas por no tener placa. */
  excluded: number;
}

const layoutOf = (buckets: readonly PlateExportBucket[], offsets: Record<string, [number, number]>, plates: readonly ScenePlate[]): ThreeMfPlateLayout | undefined => {
  const hasOffsets = Object.keys(offsets).length > 0;
  if (plates.length < 2 && !hasOffsets) return undefined;
  return {
    plates: plates.length >= 2 ? buckets.map((b) => ({ name: b.name, objectIds: b.objects.map((o) => o.id) })) : [],
    ...(hasOffsets ? { offsets } : {}),
  };
};

/**
 * Plan de un archivo único. `fullScene` (3MF de escena completa): todos los objetos no referencia, también
 * ocultos y negativos, que se trasladan con su placa para que la escena se restaure en su lugar de mundo.
 */
export function singleFilePlan(
  targets: readonly SceneObject[], plates: readonly ScenePlate[], fullScene?: readonly SceneObject[],
): SingleFilePlan {
  const plan = planPlateExport(targets, plates);
  if (!fullScene) {
    return {
      targets: plan.buckets.flatMap((b) => b.objects),
      plateLayout: layoutOf(plan.buckets, {}, plates),
      plateCount: plan.buckets.length,
      excluded: plan.excluded,
    };
  }
  // Escena completa: lo imprimible sin placa (con varias placas) queda fuera, como en el alcance.
  const kept = plates.length >= 2 ? fullScene.filter((o) => !isPrintable(o) || exportPlateOf(fullScene, plates, o)) : [...fullScene];
  const shifted = shiftForExport(kept, plates);
  return {
    targets: shifted.objects,
    plateLayout: layoutOf(plan.buckets, shifted.offsets, plates),
    plateCount: plan.buckets.length,
    excluded: plan.excluded,
  };
}
