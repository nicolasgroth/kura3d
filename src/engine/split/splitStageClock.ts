/**
 * @file src/engine/split/splitStageClock.ts
 * @description Tiempos por etapa de "dividir para imprimir" (corte, uniones, armado, mallas…), para
 * perfilar sin herramientas externas. La ejecución los devuelve en `BedSplitResult.stageMs`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Cronómetro de etapas: `lap(nombre)` suma el tiempo desde la marca anterior a esa etapa. */
export class StageClock {
  private last = performance.now();
  readonly ms: Record<string, number> = {};

  lap(stage: string): void {
    const now = performance.now();
    this.ms[stage] = (this.ms[stage] ?? 0) + (now - this.last);
    this.last = now;
  }
}
