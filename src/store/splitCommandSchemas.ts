/**
 * @file src/store/splitCommandSchemas.ts
 * @description Esquema del comando `split_for_bed` ("dividir para imprimir"): objetivo, cama (por
 * defecto la activa), margen, ejes, tope de piezas, conector, marcas de pareja y `dryRun` (solo plan);
 * y de `validate_assembly` (revalidar el armado de un grupo dividido, ver `core/commands/validateAssemblySchema`).
 * Rangos de `OPERATION_RANGES.split` y `OPERATION_RANGES.cut` (fuente única con el servidor MCP).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { AssemblySummary } from '../engine/split';
import type {
  BedSplitExecuteOptions, BedSplitPlan, BedSplitPlanOptions, SplitAxis, SplitBed, SplitConnectorOptions, SplitJoint,
} from '../engine';
import { OPERATION_DEFAULTS, OPERATION_RANGES as OR } from '../engine/operationLimits';
import type { SceneObject } from '../types/kura';
import { resolveTarget, type SceneView } from './commandTargets';
import { resolveAssemblyTargets, ValidateAssemblyTargetError } from '../core/commands/validateAssemblySchema';
import { CommandError } from './commandErrors';
import { pick, readBoolean, readEnum, readId, readIds, readRange, type RawParams } from './commandValidation';
import { internalAxisOfUser } from '../core/scene/displayAxes';
import { readMagnetConnector } from './splitMagnetParams';
import { activePlateBed, type PlateBedSource } from '../core/scene/activePlateBed';
import { plateFrameFor } from '../core/scene/plateFrame';

const AXES = ['x', 'y', 'z'] as const;

/** Petición ya validada del comando. */
export interface SplitForBedRequest {
  target: SceneObject;
  bed: SplitBed;
  plan: BedSplitPlanOptions;
  execute: Omit<BedSplitExecuteOptions, 'onProgress'>;
  dryRun: boolean;
}

/** Resultado de `splitObjectForBed`: el plan siempre; piezas y uniones solo si se ejecutó. */
export interface SplitForBedOutcome {
  plan: BedSplitPlan;
  parts: SceneObject[];
  joints: SplitJoint[];
  /** Lotes de tarugos sueltos generados como objetos aparte (`loose-dowel`). */
  looseDowels?: Array<{ id: string; name: string; diameterMm: number; lengthMm: number; count: number }>;
  plateCount: number;
  /** Resumen de la validación de armado (solo si se ejecutó). */
  assembly?: AssemblySummary;
}

/** Cama activa (perfil de impresora o medidas personalizadas, y placa activa si hay placas). */
export type BedSource = PlateBedSource;

/**
 * Volumen de impresión de la placa activa (sin placas: la cama del proyecto, como siempre). Solo medidas: el
 * origen de la placa lo da `activePlateBed` (`core/scene/activePlateBed.ts`), el punto único de la cama.
 */
export function activeBed(scene: BedSource): SplitBed {
  const { widthMm, depthMm, heightMm } = activePlateBed(scene).bed;
  return { widthMm, depthMm, heightMm };
}

function readAxes(p: RawParams): SplitAxis[] | undefined {
  const found = pick(p, 'axes');
  if (!found) return undefined;
  const list = Array.isArray(found[1]) ? found[1] : [found[1]];
  // Ejes del usuario (Z = altura) → internos.
  return list.map((v) => internalAxisOfUser(readEnum({ axes: v }, AXES, 'axes')!).axis);
}

/** `validate_assembly`: `groupId` o `ids` (piezas del mismo grupo dividido). */
export function parseValidateAssembly(scene: SceneView, p: RawParams): SceneObject[] {
  const groupId = readId(p, 'groupId');
  const ids = readIds(p, 'ids', 'objectIds');
  try {
    return resolveAssemblyTargets(scene.objects, { groupId, ids });
  } catch (err) {
    if (!(err instanceof ValidateAssemblyTargetError)) throw err;
    if (err.reason === 'not-found') throw new CommandError('not-found', 'bus.error.assemblyNotFound', { id: err.detail });
    if (err.reason === 'no-target') throw new CommandError('invalid-params', 'bus.error.assemblyNoTarget');
    throw new CommandError('precondition', 'bus.error.assemblyNotSplit', { reason: err.reason });
  }
}

/** Tamaño de referencia (radio, mm) con el que se planifica cuando el tamaño es automático. */
export const FALLBACK_CONNECTOR_SIZE_MM = 4;

/**
 * `connectorSize` de "dividir para imprimir": `'auto'` (o, si se omite, el valor de fábrica de
 * `OPERATION_DEFAULTS.split.connectorSize`) = cada unión usa su radio recomendado; un número se respeta tal cual.
 */
function readConnectorSizeAuto(p: RawParams): boolean {
  const given = pick(p, 'connectorSize');
  if (given) return given[1] === 'auto';
  return OPERATION_DEFAULTS.split.connectorSize === 'auto';
}

export function parseSplitForBed(scene: SceneView & BedSource, p: RawParams): SplitForBedRequest {
  const target = resolveTarget(scene, p, { unlocked: true });
  // Cama propuesta: la de la placa de la pieza (P7: cada placa puede ser otra impresora), no la de la placa activa.
  const bed = plateFrameFor(scene, [target]).bed;
  const type = readEnum(p, ['none', 'dowel', 'peg', 'dovetail', 'lap', 'loose-dowel', 'magnet'] as const, 'connectorType') ?? 'dowel';
  const sizeAuto = readConnectorSizeAuto(p);
  const connector: SplitConnectorOptions | null =
    type === 'none'
      ? null
      : type === 'magnet'
      ? readMagnetConnector(p)
      : {
          type,
          size: sizeAuto ? FALLBACK_CONNECTOR_SIZE_MM : (readRange(p, OR.cut.connectorSize, 'connectorSize') ?? FALLBACK_CONNECTOR_SIZE_MM),
          ...(sizeAuto ? { sizeAuto: true } : {}),
          depth: readRange(p, OR.cut.connectorDepth, 'connectorDepth') ?? 6,
          tolerance: readRange(p, OR.cut.tolerance, 'tolerance') ?? 0.25,
          count: Math.max(1, readRange(p, OR.cut.connectorCount, 'connectorCount') ?? 2),
          minWallForConnectorMm: readRange(p, OR.split.minWallForConnectorMm, 'minWallForConnectorMm') ?? OPERATION_DEFAULTS.split.minWallForConnectorMm,
          lapHeightMm: readRange(p, OR.split.lapHeightMm, 'lapHeightMm') ?? OPERATION_DEFAULTS.split.lapHeightMm,
        };
  const d = OPERATION_DEFAULTS.split;
  return {
    target,
    bed: {
      widthMm: readRange(p, OR.split.bedMm, 'bedWidthMm') ?? bed.widthMm,
      depthMm: readRange(p, OR.split.bedMm, 'bedDepthMm') ?? bed.depthMm,
      heightMm: readRange(p, OR.split.bedMm, 'bedHeightMm') ?? bed.heightMm,
    },
    plan: {
      marginMm: readRange(p, OR.split.marginMm, 'marginMm') ?? d.marginMm,
      axes: readAxes(p),
      maxPieces: pick(p, 'maxPieces')?.[1] === 'auto' ? 'auto' : (readRange(p, OR.split.maxPieces, 'maxPieces') ?? d.maxPieces),
      allowRotation: readBoolean(p, 'allowRotation') ?? true,
      allowDiagonal: readBoolean(p, 'allowDiagonal') ?? false,
      shiftWindow: readRange(p, OR.split.shiftWindow, 'shiftWindow') ?? d.shiftWindow,
      connector,
    },
    execute: {
      connector,
      labels: readEnum(p, ['none', 'engraved'] as const, 'labels') ?? 'none',
      labelDepthMm: readRange(p, OR.split.labelDepthMm, 'labelDepthMm') ?? d.labelDepthMm,
      labelMinHeightMm: readRange(p, OR.split.labelMinHeightMm, 'labelMinHeightMm') ?? d.labelMinHeightMm,
      labelPlacement: readEnum(p, ['auto', 'joint', 'outside'] as const, 'labelPlacement') ?? 'auto',
      minFragmentMm3: readRange(p, OR.split.minFragmentMm3, 'minFragmentMm3') ?? d.minFragmentMm3,
      reinforceWeakJoints: readBoolean(p, 'reinforceWeakJoints') ?? d.reinforceWeakJoints,
    },
    dryRun: readBoolean(p, 'dryRun') ?? false,
  };
}
