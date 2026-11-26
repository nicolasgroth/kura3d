/**
 * @file src/store/importPhase.ts
 * @description Fases de la importación en `busyProgress.phase`: etapas (`import:read`, `import:parse`,
 * `import:place`) y avance por piezas (`import:parts:7/19`) cuando el motor lo informe. La barra de
 * progreso las traduce (`components/viewport/importProgress.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export type ImportStage = 'read' | 'parse' | 'place';
export const importStagePhase = (stage: ImportStage) => `import:${stage}`;
export const importPartsPhase = (done: number, total: number) => `import:parts:${done}/${total}`;

/** Avance por piezas (`done/total`) de una fase de importación, o null si es una etapa sin cifras. */
export function parseImportParts(phase: string | null | undefined): { done: number; total: number } | null {
  const m = phase ? /^import:parts:(\d+)\/(\d+)$/.exec(phase) : null;
  if (!m) return null;
  const done = Number(m[1]);
  const total = Number(m[2]);
  return total > 0 && done <= total ? { done, total } : null;
}

