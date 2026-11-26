/**
 * @file src/engine/split/splitJointPreview.ts
 * @description Firmeza prevista de cada unión para el resumen de "dividir para imprimir": reduce el resultado
 * de la ejecución (`BedSplitResult`) a los datos que la interfaz muestra antes de dividir. No calcula nada nuevo:
 * copia `SplitJoint.strength` y las uniones débiles del informe de armado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { BedSplitResult, SplitPreviewJoint } from './splitTypes';

/** Datos por unión (en el orden de `res.joints`) para `BedSplitPlan.jointPreview`. */
export function previewJoints(res: Pick<BedSplitResult, 'joints' | 'assembly'>): SplitPreviewJoint[] {
  const weak = new Map((res.assembly?.weak ?? []).map((w) => [w.joint, w]));
  return res.joints.map((j) => {
    const w = weak.get(j.label);
    return {
      label: j.label,
      a: j.a.code,
      b: j.b.code,
      axis: j.axis,
      position: j.position,
      kind: j.kind,
      connectorType: j.connector?.type ?? null,
      strength: j.strength ?? {
        level: 'glue', reasons: ['no-connector'], count: 0, sizeMm: 0, depthMm: 0, areaRatio: 0,
        islands: j.islands.length, islandsCovered: 0, shrunk: [], discarded: [],
      },
      widthMm: j.islands.reduce((m, i) => Math.max(m, i.minWidthMm), 0),
      weak: w && j.kind === 'connector' ? { measuredMm: w.measuredMm, recommendedMm: w.recommendedMm } : null,
    };
  });
}
