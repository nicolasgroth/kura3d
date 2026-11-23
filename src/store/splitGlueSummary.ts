/**
 * @file src/store/splitGlueSummary.ts
 * @description Avisos de Dividir para imprimir: las uniones que pasan a "para pegar" (por pared
 * delgada, sin espacio para el conector o por choque de armado) se juntan en un solo resumen en vez
 * de un aviso por unión más el resumen del motor. El detalle sigue en la sección de uniones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { EngineWarning } from '../engine';
import type { SplitJointRow } from '../core/scene/splitJointStatus';

/** Id de la sección de uniones del inspector (destino de "Ver uniones"). */
export const SPLIT_JOINTS_ID = 'kura-split-joints';

const PER_JOINT = new Set(['SPLIT_JOINT_GLUE_ONLY', 'SPLIT_JOINT_NO_CONNECTOR', 'ASSEMBLY_JOINT_GLUED_FOR_CLASH']);

/**
 * Separa los avisos por unión "para pegar" del resto. `count` = uniones para pegar (el resumen del
 * motor si lo trae; si no, las distintas uniones avisadas) y `total` = uniones del resultado.
 */
export function collapseGlueWarnings(warnings: readonly EngineWarning[] | undefined, joints: number) {
  const rest: EngineWarning[] = [];
  const labels = new Set<string>();
  let summary: { count: number; total: number } | null = null;
  for (const w of warnings ?? []) {
    if (w.code === 'SPLIT_GLUE_SUMMARY') {
      summary = { count: Number(w.params?.count) || 0, total: Number(w.params?.total) || joints };
    } else if (PER_JOINT.has(w.code)) {
      labels.add(String(w.params?.label ?? labels.size));
    } else rest.push(w);
  }
  const count = Math.max(summary?.count ?? 0, labels.size);
  return { rest, count, total: Math.max(summary?.total ?? joints, count) };
}

/** Uniones para pegar y total. Una sola cifra para el aviso, la cabecera del inspector y la lista de avisos repetidos. */
export interface GlueCount { count: number; total: number }

/** Cuenta, sobre las filas del inspector, las uniones que se pegan (por cualquier causa). */
export function glueCountOf(rows: readonly Pick<SplitJointRow, 'status'>[]): GlueCount {
  return { count: rows.filter((r) => r.status === 'glue').length, total: rows.length };
}
