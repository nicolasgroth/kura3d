/**
 * @file src/utils/aboutPurpose.ts
 * @description Frase de «El sentido» de «Acerca de»: hay varias (`about.purpose.1`, `about.purpose.2`, …) y el
 * diálogo muestra una al azar cada vez que se abre. Sumar una frase es solo agregar la siguiente clave numerada
 * en `acercaDe.ts`: aquí se descubren por orden hasta que falta una. El generador aleatorio se inyecta para probarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { ACERCA_ES } from '../i18n/locales/acercaDe';

/** Claves de las frases disponibles, en orden (`about.purpose.1`, `about.purpose.2`, …). */
export function purposeKeys(): string[] {
  const keys: string[] = [];
  for (let n = 1; `about.purpose.${n}` in ACERCA_ES; n += 1) keys.push(`about.purpose.${n}`);
  return keys;
}

/** Elige una clave de frase con `random()` (por defecto `Math.random`; devuelve [0, 1)). */
export function pickPurposeKey(random: () => number = Math.random): string {
  const keys = purposeKeys();
  const i = Math.min(keys.length - 1, Math.max(0, Math.floor(random() * keys.length)));
  return keys[i];
}
