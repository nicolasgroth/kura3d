/**
 * @file src/store/printReportSelectors.ts
 * @description Vigencia del informe de imprimibilidad: solo vale para el objeto exacto analizado
 * (cualquier edición, transformación o deshacer crea un objeto nuevo y lo invalida) y la capa de
 * voladizos solo se dibuja mientras esa pieza está seleccionada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { KuraStoreState as KuraState } from './storeTypes';
import type { PrintabilityReport } from '../types/kura';

type ReportState = Pick<KuraState, 'activePrintReport' | 'printReportSource' | 'objects'>;

/** Informe vigente para `objectId`, o null si no hay o quedó desactualizado. */
export function currentPrintReport(state: ReportState, objectId: string): PrintabilityReport | null {
  const report = state.activePrintReport;
  if (!report || report.objectId !== objectId || !state.printReportSource) return null;
  const obj = state.objects.find((o) => o.id === objectId);
  return obj === state.printReportSource ? report : null;
}

/** Caras en voladizo a resaltar en el visor para `objectId` (vacío si no corresponde). */
export function overhangFacesFor(
  state: ReportState & Pick<KuraState, 'showOverhangs' | 'selectedIds'>,
  objectId: string,
): number[] | null {
  if (!state.showOverhangs || !state.selectedIds.includes(objectId)) return null;
  return currentPrintReport(state, objectId)?.overhangFaceIndices ?? null;
}
