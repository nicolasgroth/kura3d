/**
 * @file src/components/assistants/fileKind.ts
 * @description Tipo real de un archivo elegido en un campo de Asistentes (SVG, PNG o JPG) por su contenido, no por su
 * extensión, y el tope de lectura por defecto cuando la receta no trae `maxBytes`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { FileAnswer } from '../../core/recipes/resolve/types';

/** Tope de lectura de un archivo cuando la receta no declara `maxBytes`: 5 MiB (un logo o una foto razonables). */
export const DEFAULT_FILE_MAX_BYTES = 5 * 1024 * 1024;

/** Tipo del contenido (firma PNG, firma JPEG o etiqueta `<svg`), o `null` si no es ninguno de los admitidos. */
export function sniffFileKind(bytes: Uint8Array): FileAnswer['kind'] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4096)).toLowerCase();
  if (head.includes('<svg')) return 'svg';
  return null;
}
