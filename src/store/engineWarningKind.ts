/**
 * @file src/store/engineWarningKind.ts
 * @description Tipo de mensaje (`warning` o `info`) con que el centro de mensajes muestra cada aviso del motor. Los
 * que piden al usuario revisar o actuar (reparar la malla, comprobar una pieza antes de imprimir) son advertencias:
 * esperan a que se cierren y cuentan en el icono de advertencias. El resto es información que caduca sola.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { EngineWarning } from '../engine/engineErrors';

/** Códigos cuyo texto pide revisar, reparar o comprobar algo antes de imprimir. */
const ACTIONABLE_WARNING_CODES: ReadonlySet<string> = new Set([
  'IMPORT_NORMALS_INCONSISTENT',
  'MESH_WELDED_IMPLICITLY',
  'REPAIR_HOLES_LEFT',
  'REPAIR_LARGE_HOLES_FILLED',
  'HOLLOW_SELF_INTERSECTING',
  'SPLIT_COLOR_NON_MANIFOLD',
  'SPLIT_COLOR_MESH_DEFECTS',
  'SPLIT_PART_NOT_CLOSED',
]);

export function engineWarningKind(warning: Pick<EngineWarning, 'code'>): 'warning' | 'info' {
  return ACTIONABLE_WARNING_CODES.has(warning.code) ? 'warning' : 'info';
}
