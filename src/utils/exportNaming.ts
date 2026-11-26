/**
 * @file src/utils/exportNaming.ts
 * @description Nombre base de los archivos exportados: el elegido por el usuario, el del proyecto
 * o el del único objeto exportado, saneado para sistemas de archivos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Sanea un nombre de archivo (sin extensión): quita separadores y caracteres reservados. */
export function sanitizeFileBase(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\.(kura|stl|3mf|obj|glb|ply|mtl)$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+/g, '_')
    .replace(/\s+/g, '_')
    // Separadores tipográficos de nombres compuestos ("Cilindro 1 · A1") no van en un archivo.
    .replace(/[\u00b7\u2022\u2013\u2014\u2026]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120);
}

/**
 * Elige el nombre base de exportación: el indicado, si no el del proyecto, si no el del único
 * objeto, y si no `fallback`.
 */
export function exportFileBase(
  requested: string | undefined,
  projectName: string | null,
  targets: Array<{ name: string }>,
  fallback: string,
): string {
  for (const candidate of [requested, projectName, targets.length === 1 ? targets[0].name : undefined, fallback]) {
    const clean = candidate ? sanitizeFileBase(candidate) : '';
    if (clean) return clean;
  }
  return 'kura3d';
}

/** Objeto exportable: su nombre y, si es pieza de una división, el grupo al que pertenece. */
export interface NamedTarget {
  name: string;
  metadata?: { split?: { groupId: string } };
}

/**
 * Nombre del objeto original si todas las piezas vienen de la misma división ("Cubo 1 · A1a" → "Cubo 1");
 * null si no.
 */
function splitOriginalName(selected: NamedTarget[]): string | null {
  const group = selected[0].metadata?.split?.groupId;
  if (!group || !selected.every((o) => o.metadata?.split?.groupId === group)) return null;
  return selected[0].name.split(' · ')[0].trim() || null;
}

/**
 * Nombre por defecto del diálogo de exportación según el alcance: con la escena completa
 * manda el proyecto (o el nombre por defecto), nunca el del objeto seleccionado. Con la
 * selección: el nombre de la pieza si es una sola; si son varias, el proyecto (o la primera
 * pieza) con el sufijo de selección; si todas son piezas de una misma división, el objeto original con el
 * sufijo de piezas ("Cubo_1_piezas"). Si la selección es un grupo entero, el nombre del grupo. Nunca el
 * nombre genérico de "escena".
 */
export function defaultExportBase(
  scope: 'selection' | 'scene',
  projectName: string | null,
  selected: Array<NamedTarget>,
  exportable: Array<NamedTarget>,
  fallback: string,
  selectionSuffix = 'selection',
  piecesSuffix = 'pieces',
  groupName?: string,
): string {
  if (scope === 'selection' && groupName) {
    const named = sanitizeFileBase(groupName);
    if (named) return named;
  }
  const pieces = scope === 'selection' && selected.length > 1 ? splitOriginalName(selected) : null;
  if (pieces) {
    const named = sanitizeFileBase(`${pieces}_${sanitizeFileBase(piecesSuffix)}`);
    if (named) return named;
  }
  if (scope === 'selection' && selected.length > 1) {
    const stem = sanitizeFileBase(projectName ?? '') || sanitizeFileBase(selected[0].name);
    const suffix = sanitizeFileBase(selectionSuffix);
    if (stem) return sanitizeFileBase(`${stem}_${suffix}`);
  }
  if (scope === 'selection' && selected.length === 1) {
    return exportFileBase(selected[0].name, projectName, selected, fallback);
  }
  return exportFileBase(undefined, projectName, exportable, fallback);
}
