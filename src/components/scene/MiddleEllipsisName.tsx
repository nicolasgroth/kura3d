/**
 * @file src/components/scene/MiddleEllipsisName.tsx
 * @description Nombre de una fila del árbol de escena abreviado por el medio con una función pura (`middleTruncate`):
 * se conservan el inicio y el final (lo que distingue «1_Tapa_Lateral_03» de «1_Tapa_Lateral_04»: extensión, contador,
 * código de pieza). El nombre completo va en el tooltip y en un texto oculto que es el nombre accesible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import '../../styles/middleEllipsis.css';

/** Código de pieza de una división al final del nombre («Tapa · A1»): se ve siempre completo. */
const PIECE_CODE_SUFFIX = /\s·\s[A-Za-z]{1,3}\d{1,3}[a-z]{0,3}(?:·\d{1,3})?$/;

/** Caracteres visibles de un nombre antes de abreviarlo en el medio (cabe en el árbol a 1024 px). */
export const NAME_MAX_CHARS = 28;

/** Extensión de archivo y contador «(n)» con que termina un nombre importado («…negro.stl (5)»). */
const FILE_SUFFIX = /(?:\.[A-Za-z0-9]{2,4})?(?:\s\(\d+\))?$/;
/** Caracteres del nombre propio que se conservan antes de la extensión y el contador: lo que distingue filas parecidas. */
const TAIL_STEM_CHARS = 4;

/**
 * Abrevia un nombre largo por el medio: conserva el inicio y el final (extensión, contador «(n)» o código de pieza
 * más unos caracteres previos) y pone «…» entre ambos. Devuelve `[inicio, final]` (el «…» va al final del inicio);
 * un nombre que cabe en `max` caracteres vuelve entero con final vacío. Función pura: no depende del ancho en pantalla.
 */
export function middleTruncate(name: string, max = NAME_MAX_CHARS): [string, string] {
  const chars = Array.from(name);
  if (chars.length <= max) return [name, ''];
  const code = PIECE_CODE_SUFFIX.exec(name);
  const fixed = code && code.index > 0 ? Array.from(code[0]).length : Array.from(FILE_SUFFIX.exec(name)?.[0] ?? '').length;
  // Final: el sufijo fijo y unos caracteres previos, sin pasar de la mitad del presupuesto.
  const tailLen = Math.min(fixed + TAIL_STEM_CHARS, Math.floor((max - 1) / 2));
  const headLen = max - 1 - tailLen;
  return [`${chars.slice(0, headLen).join('')}…`, chars.slice(chars.length - tailLen).join('')];
}

export const MiddleEllipsisName: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const [head, tail] = middleTruncate(name);
  const cut = tail !== '';
  return (
    <span className={`kura-scene-name kura-mid-ellipsis${className ? ` ${className}` : ''}`} title={name}>
      <span className="kura-mid-head" aria-hidden={cut ? true : undefined}>{head}</span>
      {cut && <span className="kura-mid-tail" aria-hidden="true">{tail}</span>}
      {/* El nombre completo es el nombre accesible; lo visible va abreviado. */}
      {cut && <span className="sr-only">{name}</span>}
    </span>
  );
};
