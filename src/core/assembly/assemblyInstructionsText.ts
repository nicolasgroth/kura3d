/**
 * @file src/core/assembly/assemblyInstructionsText.ts
 * @description Texto de las instrucciones de armado por i18n: frase de cada paso (base o unión por cara con su
 * conector, imanes o pegamento, y dirección de entrada en ejes del usuario), avisos del paso y líneas de la lista de
 * materiales, con plural en línea y números en el formato del idioma. Lo usan el panel, las exportaciones y el bus/MCP
 * (inglés). Sin React.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t, type TranslationKey } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import type { LanguageCode } from '../../types/kura';
import { faceOfUserDirection } from '../scene/displayAxes';
import type { InstructionJoin, InstructionMagnet, InstructionMaterials, InstructionStep, InstructionWarning } from './assemblyInstructionsTypes';

const num = (lang: LanguageCode, n: number) => formatLocaleNumber(lang, n, { maxFrac: 1 });

/** Medida de un imán: «Ø6 × 3» (redondo), «6 × 6 × 3» (cuadrado), «10 × 5 × 2» (rectangular). */
export function magnetSizeText(lang: LanguageCode, m: InstructionMagnet): string {
  if (m.shape === 'round') return `Ø${num(lang, m.sizeMm)} × ${num(lang, m.heightMm)}`;
  const width = m.shape === 'rect' ? m.widthMm ?? m.sizeMm : m.sizeMm;
  return `${num(lang, m.sizeMm)} × ${num(lang, width)} × ${num(lang, m.heightMm)}`;
}

function howText(lang: LanguageCode, j: InstructionJoin): string {
  const d = j.diameterMm !== undefined ? num(lang, j.diameterMm) : '';
  switch (j.method) {
    case 'dowel': return t(lang, 'asmInstr.how.dowel', { count: j.count, d });
    case 'loose-dowel': return t(lang, 'asmInstr.how.looseDowel', { count: j.count, d });
    case 'peg': return t(lang, 'asmInstr.how.peg', { count: j.count, d });
    case 'dovetail': return t(lang, 'asmInstr.how.dovetail', { count: Math.max(1, j.count) });
    case 'lap': return t(lang, 'asmInstr.how.lap');
    case 'magnet': return t(lang, 'asmInstr.how.magnet', { count: j.count, size: j.magnet ? magnetSizeText(lang, j.magnet) : '' });
    case 'glue': return t(lang, 'asmInstr.how.glue');
  }
}

/** Frase de una unión del paso: «Une B1 con A1 por su cara izquierda: 2 espigas de 6 mm.» */
export function joinText(lang: LanguageCode, step: InstructionStep, j: InstructionJoin): string {
  const faceName = t(lang, `asmInstr.face.${faceOfUserDirection(j.face)}` as TranslationKey);
  const face = j.tilted ? t(lang, 'asmInstr.face.tilted', { face: faceName }) : faceName;
  return t(lang, 'asmInstr.join', { piece: step.code, partner: j.partnerCode, face, how: howText(lang, j) });
}

/** Dirección de entrada en palabras (`null` en la base). */
export function directionText(lang: LanguageCode, step: InstructionStep): string | null {
  if (!step.direction) return null;
  const dir = t(lang, `asmInstr.dir.${step.direction.axis}` as TranslationKey);
  return t(lang, step.joins.some((j) => j.tilted && j.method !== 'glue') ? 'asmInstr.dirTilted' : 'asmInstr.dir', { dir });
}

export function warningText(lang: LanguageCode, w: InstructionWarning): string {
  return t(lang, `asmInstr.warn.${w.code}` as TranslationKey, { label: w.joint ?? '' });
}

/** Frases del paso: las principales (base o uniones y dirección) y los avisos aparte. */
export function stepLines(lang: LanguageCode, step: InstructionStep): { main: string[]; warnings: string[] } {
  const main: string[] = [];
  if (step.base) {
    main.push(t(lang, step.index === 1 ? 'asmInstr.step.base' : 'asmInstr.step.loose', { piece: step.code }));
  } else {
    for (const j of step.joins) main.push(joinText(lang, step, j));
    const dir = directionText(lang, step);
    if (dir) main.push(dir);
  }
  // El bloque suelto ya lo dice su frase principal: el aviso no se repite.
  const warnings = step.warnings.filter((w) => !(step.base && w.code === 'not-connected')).map((w) => warningText(lang, w));
  return { main, warnings };
}

/** El paso completo en un párrafo (frases principales y avisos). */
export function stepSentence(lang: LanguageCode, step: InstructionStep): string {
  const { main, warnings } = stepLines(lang, step);
  return [...main, ...warnings].join(' ');
}

/** Líneas de la lista de materiales (solo lo que hay). */
export function materialLines(lang: LanguageCode, m: InstructionMaterials): string[] {
  const lines = [t(lang, 'asmInstr.mat.parts', { count: m.printedParts, codes: m.codes.join(', ') })];
  for (const d of m.looseDowels) lines.push(t(lang, 'asmInstr.mat.dowels', { count: d.count, d: num(lang, d.diameterMm), len: num(lang, d.lengthMm) }));
  for (const g of m.magnets) lines.push(t(lang, 'asmInstr.mat.magnets', { count: g.count, size: magnetSizeText(lang, g) }));
  if (m.connectorJoints > 0) lines.push(t(lang, 'asmInstr.mat.connectors', { count: m.connectorJoints }));
  if (m.glueJoints > 0) lines.push(t(lang, 'asmInstr.mat.glue', { count: m.glueJoints }));
  return lines;
}
