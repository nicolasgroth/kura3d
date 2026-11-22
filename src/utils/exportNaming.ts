/**
 * @file src/utils/exportNaming.ts
 * @description Nombre base de los archivos exportados: el elegido por el usuario, el del proyecto
 * o el del único objeto exportado, saneado para sistemas de archivos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Sanea un nombre de archivo (sin extensión): quita separadores y caracteres reservados. */
export function sanitizeFileBase(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\.(kura|stl|3mf|obj|glb|ply|mtl)$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
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

/**
 * Nombre por defecto del diálogo de exportación según el alcance: con la escena completa
 * manda el proyecto (o el nombre por defecto), nunca el del objeto seleccionado. Con la
 * selección: el nombre de la pieza si es una sola; si son varias, el proyecto (o la primera
 * pieza) con el sufijo de selección. Nunca el nombre genérico de "escena".
 */
export function defaultExportBase(
  scope: 'selection' | 'scene',
  projectName: string | null,
  selected: Array<{ name: string }>,
  exportable: Array<{ name: string }>,
  fallback: string,
  selectionSuffix = 'selection',
): string {
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
