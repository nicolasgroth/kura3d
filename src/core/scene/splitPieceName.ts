/**
 * @file src/core/scene/splitPieceName.ts
 * @description Nombre visible de una pieza de Dividir en el árbol: «A1a · nombre», con el mismo rótulo que el
 * visor. El código viene del proyecto (puede venir de un `.kura` ajeno): se valida con un formato acotado y se
 * quita del final del nombre como sufijo literal, sin construir expresiones regulares con datos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Rótulo de pieza válido: letras mayúsculas, dígitos y letras minúsculas opcionales (A1, B2b, AA12c). */
const PIECE_CODE = /^[A-Z]{1,3}\d{1,4}[a-z]{0,3}$/;

export function isPieceCode(code: unknown): code is string {
  return typeof code === 'string' && code.length <= 10 && PIECE_CODE.test(code);
}

/** «código · nombre sin el código final»; si el código no es válido, el nombre tal cual. */
export function splitPieceDisplayName(name: string, code: unknown): string {
  if (!isPieceCode(code)) return name;
  const base = name.endsWith(code) ? name.slice(0, -code.length).trimEnd() : name;
  return `${code} · ${base || name}`;
}
