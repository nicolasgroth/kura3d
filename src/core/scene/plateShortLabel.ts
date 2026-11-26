/**
 * @file src/core/scene/plateShortLabel.ts
 * @description Rótulo corto de una placa para la insignia de la lista de escena: «P» + su posición (desde 1) en la tira de
 * placas, la misma que ve la persona, aunque el nombre diga otro número («Placa 3» en segunda posición → «P2»).
 * El nombre completo va aparte (nombre accesible y tooltip). Nunca se corta a una letra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** `P2` para la segunda placa de la tira (índice 1). */
export function plateShortLabel(index: number): string {
  return `P${index + 1}`;
}
