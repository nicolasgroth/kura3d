/**
 * @file src/core/scene/plateShortLabel.ts
 * @description Rótulo corto de una placa para la insignia de la lista de escena: «P» + el número que cierra su nombre
 * («Placa 2» → «P2») o, si el nombre no lleva número, «P» + su posición. Nunca se corta a una letra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** `P2` para «Placa 2», «Plate 2», «Platte 2»…; sin número en el nombre, `P` + posición (desde 1). */
export function plateShortLabel(name: string, index: number): string {
  const trailing = /(\d+)\s*$/.exec(name.trim());
  return `P${trailing ? Number(trailing[1]) : index + 1}`;
}
