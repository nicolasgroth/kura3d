/**
 * @file src/components/viewport/importProgress.ts
 * @description Fases de la importación en la barra de progreso: etapas (`import:read` → Leyendo
 * archivo, `import:parse` → Interpretando, `import:place` → Colocando en la escena) y avance por
 * piezas (`import:parts:7/19` → "7 de 19 piezas", barra determinada) cuando el motor lo informe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import { formatNumber } from '../../utils/plural';

import { parseImportParts } from '../../store/importPhase';

export { parseImportParts };

/** Texto visible de una fase de importación, o null si la fase no es de importación. */
export function importPhaseLabel(language: LanguageCode, phase: string | null | undefined): string | null {
  const parts = parseImportParts(phase);
  if (parts) return t(language, 'realesUi.import.parts', { done: formatNumber(language, parts.done), total: formatNumber(language, parts.total) });
  if (phase === 'import:read') return t(language, 'realesUi.import.reading');
  if (phase === 'import:parse') return t(language, 'realesUi.import.parsing');
  if (phase === 'import:place') return t(language, 'realesUi.import.placing');
  return null;
}
