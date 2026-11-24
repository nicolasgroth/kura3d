/**
 * @file src/components/scene/MiddleEllipsisName.tsx
 * @description Nombre de una fila del árbol de escena truncado en el medio: el principio se recorta con «…» y el
 * final (lo que suele diferenciar «1_Tapa_Lateral_03» de «1_Tapa_Lateral_04») queda siempre visible. El nombre
 * completo va en el tooltip y el texto sigue siendo uno solo para los lectores de pantalla (dos tramos contiguos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import '../../styles/middleEllipsis.css';

/** Caracteres del final que no se recortan. */
export const NAME_TAIL_CHARS = 12;

/** Nombre que termina en un contador «(n)». */
const COUNTER_SUFFIX = /\(\d+\)$/;
/** Caracteres del final que se conservan en un nombre con contador. */
const COUNTER_TAIL_CHARS = 8;

/** Parte el nombre en tramo recortable y final fijo; los nombres cortos no se parten. */
export function splitNameTail(name: string, tail = NAME_TAIL_CHARS): [string, string] {
  const chars = Array.from(name);
  // Los repetidos se numeran «Nombre (3)»: el número entre paréntesis y la medida que lo precede siempre se ven.
  if (COUNTER_SUFFIX.test(name) && chars.length > COUNTER_TAIL_CHARS) {
    return [chars.slice(0, chars.length - COUNTER_TAIL_CHARS).join(''), chars.slice(chars.length - COUNTER_TAIL_CHARS).join('')];
  }
  if (chars.length <= tail * 2) return [name, ''];
  return [chars.slice(0, chars.length - tail).join(''), chars.slice(chars.length - tail).join('')];
}

export const MiddleEllipsisName: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const [head, tail] = splitNameTail(name);
  return (
    <span className={`kura-scene-name kura-mid-ellipsis${className ? ` ${className}` : ''}`} title={name}>
      <span className="kura-mid-head">{head}</span>
      {tail && <span className="kura-mid-tail">{tail}</span>}
    </span>
  );
};
