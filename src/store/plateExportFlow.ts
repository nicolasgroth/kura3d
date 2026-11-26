/**
 * @file src/store/plateExportFlow.ts
 * @description Exportar con placas (lote P6), compartido por el diálogo y el Command Bus: cada pieza respecto de
 * la cama de su placa; con piezas de dos o más placas, un ZIP con un archivo por placa (nombre de la placa
 * saneado) o, en 3MF, un solo archivo con todas las placas para Bambu Studio / OrcaSlicer. Lo que no tiene placa
 * se excluye y se cuenta. Sin placas, todo queda igual que antes (mismos objetos, mismos archivos).
 *
 * 3MF con placas reales frente a grupos: con dos o más placas reales, ellas definen las placas del laminador y
 * los grupos raíz ya no (los grupos siguen viajando en los metadatos de escena). Con una placa o ninguna, los
 * grupos raíz siguen siendo placas del laminador como siempre. El 3MF lleva la cama del proyecto (`slicerBedOf`) para
 * colocar cada placa donde la espera el laminador; `otherBedNotice` avisa de las placas con cama propia de otro tamaño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { zipSync } from 'fflate';
import type { ExportTaskArgs, ExportTaskResult } from '../core/operations/engineTasks';
import { isPrintable } from '../core/scene/objectRole';
import { exportPlateOf, planPlateExport, platesWithOtherBed, shiftForExport, type PlateExportBucket } from '../core/scene/plateExport';
import type { Translate } from './modelImportNotices';
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
  /** Ids de esas placas, en el orden del archivo (null = escena sin placas). */
  plateIds: Array<string | null>;
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
      plateIds: plan.buckets.map((b) => b.plateId),
      excluded: plan.excluded,
    };
  }
  // Escena completa: lo imprimible sin placa (con varias placas) queda fuera, como en el alcance.
  const kept = plates.length >= 2 ? fullScene.filter((o) => !isPrintable(o) || exportPlateOf(fullScene, plates, o)) : [...fullScene];
  const shifted = shiftForExport(kept, plates);
  // P7: las placas reales viajan en los metadatos de escena para volver como placas al abrir el 3MF.
  const layout = layoutOf(plan.buckets, shifted.offsets, plates) ?? (plates.length ? { plates: [] } : undefined);
  if (layout && plates.length) {
    const index = new Map(plates.map((p, i) => [p.id, i]));
    const plateOf: Record<string, number> = {};
    for (const o of kept) if (o.plateRef !== undefined && index.has(o.plateRef)) plateOf[o.id] = index.get(o.plateRef)!;
    layout.scenePlates = { plates: plates.map((p) => ({ name: p.name, origin: [p.origin[0], p.origin[1]], ...(p.bed ? { bed: p.bed } : {}) })), plateOf };
  }
  return {
    targets: shifted.objects,
    plateLayout: layout,
    plateCount: plan.buckets.length,
    plateIds: plan.buckets.map((b) => b.plateId),
    excluded: plan.excluded,
  };
}

/**
 * Aviso del 3MF con placas: el laminador supone una sola cama (la del proyecto) para todas, así que las placas con
 * cama propia de otro tamaño van centradas en una celda de la cama del proyecto. null si no hay ninguna.
 */
export function otherBedNotice(
  plan: Pick<SingleFilePlan, 'plateIds'> | null, plates: readonly ScenePlate[], bed: { widthMm: number; depthMm: number }, tr: Translate,
): string | null {
  const other = plan ? platesWithOtherBed(plates, plan.plateIds, bed) : [];
  if (other.length === 0) return null;
  const names = other.map((p) => `«${p.name}»`).join(', ');
  return tr('export.plates.otherBed', { names, count: other.length, w: Math.round(bed.widthMm), d: Math.round(bed.depthMm) });
}

/** Cama del proyecto para la rejilla de placas del 3MF (la medida propia manda sobre la del perfil; 256 si falta). */
export function slicerBedOf(source: {
  printerProfile: { bedWidthMm?: number; bedDepthMm?: number };
  customBedDimensions?: { width: number; depth?: number } | null;
}): { widthMm: number; depthMm: number } {
  const c = source.customBedDimensions;
  const widthMm = c?.width ?? source.printerProfile.bedWidthMm ?? 256;
  return { widthMm, depthMm: (c ? c.depth : source.printerProfile.bedDepthMm) ?? widthMm };
}
