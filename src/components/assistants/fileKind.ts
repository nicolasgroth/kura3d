/**
 * @file src/components/assistants/fileKind.ts
 * @description Reconoce el tipo de un archivo elegido en un asistente por su contenido (firma PNG, firma JPEG o SVG
 * cuyo elemento raíz es `<svg`), sin fiarse de la extensión, y fija el tope de lectura por defecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { FileAnswer } from '../../core/recipes/resolve/types';

/** Tope de lectura de un archivo cuando la receta no declara `maxBytes`: 5 MiB (un logo o una foto razonables). */
export const DEFAULT_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** Salta espacios, comentarios, instrucciones de proceso (`<?xml ?>`) y DOCTYPE; devuelve lo que sigue, o '' si no cierra. */
function afterProlog(text: string): string {
  let rest = text.replace(/^﻿/, '');
  for (;;) {
    rest = rest.trimStart();
    if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->');
      if (end < 0) return '';
      rest = rest.slice(end + 3);
    } else if (rest.startsWith('<?')) {
      const end = rest.indexOf('?>');
      if (end < 0) return '';
      rest = rest.slice(end + 2);
    } else if (/^<!doctype/i.test(rest)) {
      // El DOCTYPE puede traer un subconjunto interno entre corchetes con `>` dentro.
      const open = rest.indexOf('[');
      const close = rest.indexOf('>');
      if (open >= 0 && (close < 0 || open < close)) {
        const endSubset = rest.indexOf(']', open);
        if (endSubset < 0) return '';
        const end = rest.indexOf('>', endSubset);
        if (end < 0) return '';
        rest = rest.slice(end + 1);
      } else {
        if (close < 0) return '';
        rest = rest.slice(close + 1);
      }
    } else {
      return rest;
    }
  }
}

/** Tipo del contenido (firma PNG, firma JPEG o SVG con `<svg` como elemento raíz), o `null` si no es ninguno. */
export function sniffFileKind(bytes: Uint8Array): FileAnswer['kind'] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 8192));
  return /^<svg[\s>/]/i.test(afterProlog(head)) ? 'svg' : null;
}
