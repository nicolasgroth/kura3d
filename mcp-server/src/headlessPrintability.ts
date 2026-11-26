/**
 * @file mcp-server/src/headlessPrintability.ts
 * @description Informe de imprimibilidad del modo sin interfaz con la misma forma que el Command Bus:
 * `analyzePrintability` del motor, avisos en inglés más `issues` tipados, medidas de mundo en ejes del
 * usuario (Z = altura) y `approximate: true` con una nota: peso y filamento son una referencia muy
 * aproximada (el valor real depende del slicer) y no entran en el puntaje.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { toUserSize } from '../../src/core/scene/displayAxes';
import * as engine from '../../src/engine/index';
import { OPERATION_DEFAULTS } from '../../src/engine/operationLimits';
import { t } from '../../src/i18n/index';
import type { HeadlessSceneObject } from './headlessSupport.js';
import type { MaterialPresetId, PrintabilityReport, PrinterProfile } from './types.js';

export interface PrintabilityInput {
  materialPreset?: MaterialPresetId;
  infillPercent?: number;
  overhangAngleDeg?: number;
}

/** Informe de imprimibilidad de `obj` frente a `profile` (solo lectura). */
export function headlessPrintabilityReport(
  obj: HeadlessSceneObject,
  profile: PrinterProfile,
  options: PrintabilityInput = {},
): PrintabilityReport {
  const d = OPERATION_DEFAULTS.printability;
  const materialPreset = options.materialPreset ?? obj.materialPreset ?? 'pla_matte';
  const infillPercent = options.infillPercent ?? d.infillPercent;
  const report = engine.analyzePrintability(obj, profile, materialPreset, infillPercent, options.overhangAngleDeg ?? d.overhangAngleDeg);
  const world = engine.applyTransformToMesh(obj.mesh, obj.position, obj.rotation, obj.scale);
  const { overhangFaceIndices: _omitted, ...rest } = report;
  return {
    ...rest,
    // `warnings` en inglés para leer; `issues` trae código y parámetros para tratarlos por programa.
    warnings: report.issues.map((w) => engine.localizePrintWarning('en', w)),
    issues: report.issues.map((w) => ({ code: w.code, params: { ...w.params } })),
    dimensionsMm: toUserSize(engine.computeMeshStats(world).dimensionsMm),
    materialPreset,
    infillPercent,
    printerProfileId: profile.id,
    approximate: true,
    estimateNote: t('en', 'inspector.pro.estimateNote'),
  };
}
