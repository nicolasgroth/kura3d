/**
 * @file src/store/singleKeyShortcuts.ts
 * @description Atajos globales de una tecla (letra o numero) que cambian la escena o abren un panel o dialogo. El
 * manejador global les anula la accion por defecto del navegador: si el atajo abre un panel con el primer campo
 * enfocado, el caracter de la tecla no debe llegar (keypress/input) a ese campo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const SINGLE_KEY_SHORTCUTS: ReadonlySet<string> = new Set([
  '1', '2', '3', '7', 'v', 'f', 'h', 'b', 'a', 'x', 'p', 'd', 'c', 'l', 'm',
]);
