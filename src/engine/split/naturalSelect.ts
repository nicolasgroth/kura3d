/**
 * @file src/engine/split/naturalSelect.ts
 * @description Elección de los planos de un eje para «Por las partes de la figura»: con el número
 * mínimo de planos que exige la cama (`planes`), el largo máximo de cada tramo (`roomMm`) y los
 * candidatos en estrechamientos con su peso, busca por programación dinámica la combinación que usa
 * la mayor cantidad de estrechamientos (y, a igual cantidad, los de mayor peso) completando con
 * cortes rectos repartidos parejo donde un tramo entre estrechamientos sigue siendo más largo que la
 * cama. Función pura y 1D: O(candidatos² · planos).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Candidato de un eje con su peso (> 0; mayor = mejor sitio para cortar). */
export interface WeightedCut {
  position: number;
  weight: number;
}

export interface AxisCutChoice {
  /** Posiciones de los planos, ordenadas. */
  positions: number[];
  /** Origen de cada plano, en el mismo orden. */
  kinds: Array<'natural' | 'straight'>;
}

export interface AxisCutInput {
  min: number;
  max: number;
  /** Planos que hacen falta (los mismos que la rejilla: el mínimo). */
  planes: number;
  /** Largo máximo de un tramo (mm). */
  roomMm: number;
  /** Largo mínimo de un tramo (mm): el alojamiento del conector con su pared. */
  minSpanMm: number;
  candidates: WeightedCut[];
}

/** Cortes rectos necesarios en un hueco de largo `d` (−1 si es demasiado corto). */
function straightsFor(d: number, room: number, minSpan: number): number {
  if (d < minSpan - 1e-9) return -1;
  const m = Math.max(0, Math.ceil(d / room - 1e-9) - 1);
  // Los tramos parejos del hueco también deben respetar el mínimo
  return d / (m + 1) < minSpan - 1e-9 ? -1 : m;
}

/**
 * Mejor combinación de `planes` planos; `null` si no hay ninguna válida (p. ej. `roomMm` no alcanza).
 * Sin candidatos útiles devuelve solo cortes rectos parejos.
 */
export function chooseAxisCuts(input: AxisCutInput): AxisCutChoice | null {
  const { min, max, planes, roomMm, minSpanMm } = input;
  if (planes <= 0) return { positions: [], kinds: [] };
  if (!(roomMm > 0) || !(max > min)) return null;
  const cands = input.candidates
    .filter((c) => c.weight > 0 && c.position > min + minSpanMm && c.position < max - minSpanMm)
    .sort((p, q) => p.position - q.position);
  // Nodos: 0 = min, 1..C = candidatos, C+1 = max
  const pos = [min, ...cands.map((c) => c.position), max];
  const w = [0, ...cands.map((c) => c.weight), 0];
  const N = pos.length;
  // Valor = 10·estrechamientos + suma de pesos (pesos ≤ ~2: la cantidad manda)
  const NEG = -Infinity;
  const best: number[][] = Array.from({ length: N }, () => new Array<number>(planes + 1).fill(NEG));
  const from: number[][] = Array.from({ length: N }, () => new Array<number>(planes + 1).fill(-1));
  best[0][0] = 0;
  for (let j = 1; j < N; j++) {
    const natural = j < N - 1 ? 1 : 0;
    for (let i = 0; i < j; i++) {
      const m = straightsFor(pos[j] - pos[i], roomMm, minSpanMm);
      if (m < 0) continue;
      for (let k = 0; k <= planes; k++) {
        if (best[i][k] === NEG) continue;
        const k2 = k + m + natural;
        if (k2 > planes) continue;
        const val = best[i][k] + (natural ? 10 + w[j] : 0);
        if (val > best[j][k2]) {
          best[j][k2] = val;
          from[j][k2] = i;
        }
      }
    }
  }
  if (best[N - 1][planes] === NEG) return null;
  // Reconstrucción
  const nodes: number[] = [];
  let j = N - 1;
  let k = planes;
  while (j > 0) {
    const i = from[j][k];
    const m = straightsFor(pos[j] - pos[i], roomMm, minSpanMm);
    nodes.push(j);
    k -= m + (j < N - 1 ? 1 : 0);
    j = i;
  }
  nodes.push(0);
  nodes.reverse();
  const positions: number[] = [];
  const kinds: Array<'natural' | 'straight'> = [];
  for (let n = 1; n < nodes.length; n++) {
    const a = pos[nodes[n - 1]];
    const b = pos[nodes[n]];
    const m = straightsFor(b - a, roomMm, minSpanMm);
    for (let s = 1; s <= m; s++) {
      positions.push(a + ((b - a) * s) / (m + 1));
      kinds.push('straight');
    }
    if (nodes[n] < N - 1) {
      positions.push(b);
      kinds.push('natural');
    }
  }
  return { positions, kinds };
}
