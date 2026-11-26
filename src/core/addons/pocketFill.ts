/**
 * @file src/core/addons/pocketFill.ts
 * @description Cuánto de la pieza ocuparía un alojamiento de imán: volumen del negativo que cae dentro de la pieza
 * (muestreo en una grilla dentro del cilindro o caja, por paridad de rayos) dividido por el volumen de la pieza. Si
 * el negativo entero es chico frente a la pieza no se muestrea (la cota ya basta). Sirve para impedir un imán más
 * grande que la pieza, que al restar la haría desaparecer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData, Vec3 } from '../../types/kura';
import { pocketSectionArea, type PocketPlacement } from './magnetPocket';
import { addScaled, insideMesh } from './meshRays';

/** Por debajo de esta cota (volumen del negativo / volumen de la pieza) no hace falta muestrear. */
export const FILL_SAMPLE_FROM = 0.3;
/** Muestras por lado en la sección y a lo largo del eje. */
const SECTION_SAMPLES = 10;
const AXIS_SAMPLES = 6;

/** Volumen encerrado por una malla cerrada (mm³, valor absoluto; teorema de la divergencia). */
export function closedMeshVolume(mesh: MeshData): number {
  const p = mesh.positions, idx = mesh.indices;
  let v = 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
      + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return Math.abs(v) / 6;
}

/** Fracción (0–1, puede pasar de 1 si el hueco es mayor que la pieza) del volumen de la pieza que ocupa el hueco. */
export function pocketFillRatio(world: MeshData, plan: PocketPlacement, hostVolumeMm3: number = closedMeshVolume(world)): number {
  if (!(hostVolumeMm3 > 0)) return 1;
  const { dims, frame } = plan;
  const negativeVolume = pocketSectionArea(dims) * dims.lengthMm;
  const bound = negativeVolume / hostVolumeMm3;
  if (bound < FILL_SAMPLE_FROM) return bound;
  const half = dims.widthMm / 2;
  const halfW = dims.crossMm / 2;
  let total = 0;
  let inside = 0;
  for (let i = 0; i < SECTION_SAMPLES; i++) {
    const x = ((i + 0.5) / SECTION_SAMPLES * 2 - 1) * half;
    for (let j = 0; j < SECTION_SAMPLES; j++) {
      const z = ((j + 0.5) / SECTION_SAMPLES * 2 - 1) * halfW;
      if (dims.shape === 'round' && Math.hypot(x, z) > half) continue;
      const column = addScaled(addScaled(plan.position, frame.u, x), frame.w, z);
      for (let k = 0; k < AXIS_SAMPLES; k++) {
        const q: Vec3 = addScaled(column, frame.axis, ((k + 0.5) / AXIS_SAMPLES) * dims.lengthMm);
        total += 1;
        if (insideMesh(world, q)) inside += 1;
      }
    }
  }
  return total > 0 ? (inside / total) * bound : 0;
}
