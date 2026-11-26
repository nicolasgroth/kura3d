/**
 * @file src/core/scene/splitPieceName.ts
 * @description Nombre visible de una pieza de Dividir en el árbol: «A1a · nombre», con el mismo rótulo que el
 * visor. El código viene del proyecto (puede venir de un `.kura` ajeno): se valida con un formato acotado y se
 * quita del final del nombre como sufijo literal, sin construir expresiones regulares con datos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/**
 * Rótulo de pieza válido: letras mayúsculas, dígitos y letras minúsculas opcionales (A1, B2b, AA12c), más el
 * sufijo «·n» de las celdas que quedan en varios cuerpos (A1·2): sin él esas piezas se veían sin rótulo.
 */
const PIECE_CODE = /^[A-Z]{1,3}\d{1,4}[a-z]{0,3}(?:·\d{1,3})?$/;

export function isPieceCode(code: unknown): code is string {
  return typeof code === 'string' && code.length <= 14 && PIECE_CODE.test(code);
}

/** «código · nombre sin el código final»; si el código no es válido, el nombre tal cual. */
export function splitPieceDisplayName(name: string, code: unknown): string {
  if (!isPieceCode(code)) return name;
  let base = name.endsWith(code) ? name.slice(0, -code.length).trimEnd() : name;
  // Las piezas se nombran «Nombre · A1»: el separador que queda al quitar el código tampoco se muestra.
  if (base.length > 1 && base.endsWith('·')) base = base.slice(0, -1).trimEnd();
  return `${code} · ${base || name}`;
}
