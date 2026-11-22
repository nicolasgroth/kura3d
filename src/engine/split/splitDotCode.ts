/**
 * @file src/engine/split/splitDotCode.ts
 * @description Marca mínima de pareja de "dividir para imprimir" para caras donde no cabe texto (brazos
 * finos, varillas): una columna de puntos grabados por fuera, junto al borde de la unión, en ambas
 * piezas.
 *
 * Codificación (cómo se lee): se parte desde el borde de la unión y se avanza alejándose de él. Cada
 * dígito decimal de la etiqueta es un grupo: el dígito d (1–9) son d puntos seguidos y el 0 es una raya
 * corta. Entre grupos queda un hueco mayor (`DOT_CODE.groupGapMm`). Ejemplos: "1" = •; "12" = • ••;
 * "30" = ••• —. Los dos lados de la unión llevan el mismo código, cada uno leyendo desde el borde, así
 * que la pareja se reconoce sin importar cómo se gire la pieza.
 * Medidas imprimibles con boquilla de 0,4 mm: punto de 1 mm de diámetro, paso de 1,6 mm.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { CrossSection, ManifoldToplevel } from 'manifold-3d';

/** Medidas de la marca de puntos (mm). */
export const DOT_CODE = {
  dotMm: 1,
  pitchMm: 1.6,
  groupGapMm: 2.6,
  dashWidthMm: 0.8,
  dashLengthMm: 2.2,
} as const;

/** Grupos de la etiqueta: un número por dígito (0 = raya). Solo etiquetas numéricas. */
export function dotCodeGroups(label: string): number[] {
  if (!/^\d+$/.test(label)) throw new Error(`Etiqueta no numérica para la marca de puntos: ${label}`);
  return [...label].map(Number);
}

/** Largo de cada grupo a lo largo de la columna (mm). */
const groupLength = (d: number) => (d === 0 ? DOT_CODE.dashLengthMm : DOT_CODE.dotMm + (d - 1) * DOT_CODE.pitchMm);

/** Largo total de la columna (mm). */
export function dotCodeLength(label: string): number {
  const g = dotCodeGroups(label);
  return g.reduce((s, d) => s + groupLength(d), 0) + DOT_CODE.groupGapMm * (g.length - 1);
}

/**
 * Sección de la marca centrada en el origen: columna a lo largo de +v (x = 0). El primer grupo queda en
 * v mínimo (`fromMinV`) o en v máximo; el llamador elige el extremo que da al borde de la unión.
 */
export function dotCodeShape(wasm: ManifoldToplevel, label: string, fromMinV: boolean): CrossSection {
  const groups = dotCodeGroups(label);
  const total = dotCodeLength(label);
  const parts: CrossSection[] = [];
  let v = -total / 2;
  const r = DOT_CODE.dotMm / 2;
  for (const d of groups) {
    const len = groupLength(d);
    if (d === 0) {
      parts.push(wasm.CrossSection.square([DOT_CODE.dashWidthMm, len], false).translate([-DOT_CODE.dashWidthMm / 2, v]));
    } else {
      for (let k = 0; k < d; k++) parts.push(wasm.CrossSection.circle(r, 16).translate([0, v + r + k * DOT_CODE.pitchMm]));
    }
    v += len + DOT_CODE.groupGapMm;
  }
  const union = wasm.CrossSection.union(parts);
  for (const p of parts) p.delete();
  if (fromMinV) return union;
  const mirrored = union.mirror([0, 1]);
  union.delete();
  return mirrored;
}
