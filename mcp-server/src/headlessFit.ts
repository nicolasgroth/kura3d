/**
 * @file mcp-server/src/headlessFit.ts
 * @description "Ajustar a la impresora" (`fit_to_bed`) en el motor sin interfaz: misma operación pura
 * que la app (`runFitToBed`) y la misma forma de respuesta en ejes del usuario que el bus.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { fitBedOf, runFitToBed, type SceneChange } from '../../src/core/operations/index';
import type { FitBed } from '../../src/engine/fitToBed';
import { fitAnalysisToUser } from '../../src/store/fitCommandSchemas';
import type { PrinterProfile, SceneObject } from '../../src/types/kura';

export interface HeadlessFitInput {
  bed?: Partial<FitBed>;
  dryRun: boolean;
  alternative?: 'scale' | 'rotate' | 'rotateScale';
}

export function headlessFitToBed(
  targets: SceneObject[],
  profile: PrinterProfile,
  input: HeadlessFitInput,
  apply: (change: SceneChange) => void,
) {
  const defined = Object.fromEntries(Object.entries(input.bed ?? {}).filter(([, v]) => v !== undefined));
  const bed: FitBed = { ...fitBedOf(profile), ...defined };
  const doApply = !input.dryRun && input.alternative !== undefined;
  const { analysis, change, applied } = runFitToBed({ objects: targets, bed, ...(doApply ? { apply: input.alternative } : {}) });
  if (change) apply(change);
  return doApply && applied
    ? { dryRun: false, applied: input.alternative, factor: applied.factor, ...fitAnalysisToUser(analysis) }
    : { dryRun: true, ...fitAnalysisToUser(analysis) };
}
