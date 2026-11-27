/**
 * @file src/core/assembly/assemblyInstructionsExport.ts
 * @description Exportación de las instrucciones de armado: Markdown y HTML autocontenido imprimible (estilos en
 * línea, sin scripts, enlaces, imágenes ni recursos externos). Los nombres de pieza y del modelo son datos del
 * usuario: en HTML se escapan como entidades y en Markdown además se neutralizan las marcas de formato. Sin capturas
 * del visor en esta versión. Funciones puras.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { BRAND } from '../../brand';
import { t } from '../../i18n';
import type { LanguageCode } from '../../types/kura';
import type { AssemblyInstructions } from './assemblyInstructionsTypes';
import { materialLines, stepLines } from './assemblyInstructionsText';

export interface InstructionsDocument {
  /** Nombre del modelo (dato del usuario). */
  model: string;
  instructions: AssemblyInstructions;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Texto seguro dentro de HTML (contenido y atributos). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Texto seguro en Markdown: sin HTML en bruto y sin marcas de formato, enlaces ni saltos de línea. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[&<>]/g, (c) => HTML_ESCAPES[c])
    .replace(/([\\`*_[\]|~])/g, '\\$1');
}

/** Nombre de archivo ASCII: `<modelo>_armado.<ext>`. */
export function instructionsFileName(model: string, ext: 'md' | 'html'): string {
  const base = model.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 80);
  return `${base || 'kura3d'}_armado.${ext}`;
}

const titleOf = (lang: LanguageCode, model: string, esc: (s: string) => string) => t(lang, 'asmInstr.doc.title', { name: esc(model || BRAND.name) });

/** Las frases ya traen los códigos (validados) y el nombre solo aparece en el título: se escapa todo igual. */
export function instructionsMarkdown(lang: LanguageCode, doc: InstructionsDocument): string {
  const { steps, materials } = doc.instructions;
  const out: string[] = [`# ${titleOf(lang, doc.model, escapeMarkdown)}`, ''];
  out.push(`## ${t(lang, 'asmInstr.materials')}`, '');
  for (const line of materialLines(lang, materials)) out.push(`- ${escapeMarkdown(line)}`);
  out.push('', `## ${t(lang, 'asmInstr.doc.steps')}`, '');
  for (const step of steps) {
    const { main, warnings } = stepLines(lang, step);
    out.push(`${step.index}. ${escapeMarkdown(main.join(' '))}`);
    for (const w of warnings) out.push(`   - ⚠ ${escapeMarkdown(w)}`);
  }
  out.push('', `_${escapeMarkdown(t(lang, 'asmInstr.noCaptures'))}_`, '', `_${escapeMarkdown(t(lang, 'asmInstr.doc.generated', { app: BRAND.name }))}_`, '');
  return out.join('\n');
}

const STYLE = [
  'body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff;max-width:46rem;margin:2rem auto;padding:0 1rem}',
  'h1{font-size:1.5rem;margin:0 0 1rem}h2{font-size:1.15rem;margin:1.5rem 0 .5rem;border-bottom:1px solid #ccc}',
  'ol.steps{padding-left:1.6rem}li.step{margin:.6rem 0;break-inside:avoid}li.step p{margin:0}',
  '.code{font-weight:700}.warn{margin:.2rem 0 0;padding-left:1.1rem;color:#7a4a00}',
  '.note{color:#555;font-size:.9rem;margin-top:1.5rem}',
  '@media print{body{margin:0;max-width:none}h2{break-after:avoid}}',
].join('');

/** Página HTML autocontenida e imprimible. */
export function instructionsHtml(lang: LanguageCode, doc: InstructionsDocument): string {
  const { steps, materials } = doc.instructions;
  const title = titleOf(lang, doc.model, escapeHtml);
  const mats = materialLines(lang, materials).map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  const items = steps.map((step) => {
    const { main, warnings } = stepLines(lang, step);
    const warn = warnings.length > 0 ? `<ul class="warn">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '';
    return `<li class="step"><p><span class="code">${escapeHtml(step.code)}</span> — ${escapeHtml(main.join(' '))}</p>${warn}</li>`;
  }).join('\n');
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<style>${STYLE}</style>`,
    '</head>',
    '<body>',
    `<h1>${title}</h1>`,
    `<h2>${escapeHtml(t(lang, 'asmInstr.materials'))}</h2>`,
    `<ul>${mats}</ul>`,
    `<h2>${escapeHtml(t(lang, 'asmInstr.doc.steps'))}</h2>`,
    `<ol class="steps">\n${items}\n</ol>`,
    `<p class="note">${escapeHtml(t(lang, 'asmInstr.noCaptures'))}</p>`,
    `<p class="note">${escapeHtml(t(lang, 'asmInstr.doc.generated', { app: BRAND.name }))}</p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
