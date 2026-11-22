/**
 * @file src/store/splitCommandSchemas.ts
 * @description Esquema del comando `split_for_bed` ("dividir para imprimir"): objetivo, cama (por
 * defecto la activa), margen, ejes, tope de piezas, conector, marcas de pareja y `dryRun` (solo plan).
 * Rangos de `OPERATION_RANGES.split` y `OPERATION_RANGES.cut` (fuente única con el servidor MCP).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AssemblySummary } from '../engine/split';
import type {
  BedSplitExecuteOptions, BedSplitPlan, BedSplitPlanOptions, SplitAxis, SplitBed, SplitConnectorOptions, SplitJoint,
} from '../engine';
import { OPERATION_DEFAULTS, OPERATION_RANGES as OR } from '../engine/operationLimits';
import type { SceneObject } from '../types/kura';
import { resolveTarget, type SceneView } from './commandTargets';
import { pick, readBoolean, readEnum, readRange, type RawParams } from './commandValidation';
import { internalAxisOfUser } from '../core/scene/displayAxes';

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
  plateCount: number;
  /** Resumen de la validación de armado (solo si se ejecutó). */
  assembly?: AssemblySummary;
}

/** Cama activa (perfil de impresora o medidas personalizadas) como volumen de impresión. */
export interface BedSource {
  printerProfile: { bedWidthMm: number; bedDepthMm: number; maxHeightMm: number };
  customBedDimensions: { width: number; depth: number; height: number } | null;
}

export function activeBed(scene: BedSource): SplitBed {
  const c = scene.customBedDimensions;
  if (c) return { widthMm: c.width, depthMm: c.depth, heightMm: c.height };
  const p = scene.printerProfile;
  return { widthMm: p.bedWidthMm, depthMm: p.bedDepthMm, heightMm: p.maxHeightMm };
}

function readAxes(p: RawParams): SplitAxis[] | undefined {
  const found = pick(p, 'axes');
  if (!found) return undefined;
  const list = Array.isArray(found[1]) ? found[1] : [found[1]];
  // Ejes del usuario (Z = altura) → internos.
  return list.map((v) => internalAxisOfUser(readEnum({ axes: v }, AXES, 'axes')!).axis);
}

export function parseSplitForBed(scene: SceneView & BedSource, p: RawParams): SplitForBedRequest {
  const target = resolveTarget(scene, p, { unlocked: true });
  const bed = activeBed(scene);
  const type = readEnum(p, ['none', 'dowel', 'peg', 'dovetail', 'lap'] as const, 'connectorType') ?? 'dowel';
  const connector: SplitConnectorOptions | null =
    type === 'none'
      ? null
      : {
          type,
          size: readRange(p, OR.cut.connectorSize, 'connectorSize') ?? 4,
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
    },
    dryRun: readBoolean(p, 'dryRun') ?? false,
  };
}
