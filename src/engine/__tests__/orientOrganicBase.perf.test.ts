/**
 * @file src/engine/__tests__/orientOrganicBase.perf.test.ts
 * @description Medición de «Orientar para imprimir» en una figura orgánica real (ocarina de la carpeta local
 * de evaluación, que no se versiona; si falta, se omite): la pose actual no tiene base, el análisis no debe
 * decir «ya es la mejor» y debe proponer, si existe, una orientación con base real. Imprime los números.
 * Solo corre con `npm run test:perf`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { readSTL } from '../io/stl';
import { analyzeOrientations } from '../orient';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const MODEL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const present = fs.existsSync(MODEL);

describe('Orientar: figura orgánica sin base (ocarina)', () => {
  it.skipIf(!present)('no dice «ya es la mejor» sin base y busca parches con contacto real', () => {
    const bytes = fs.readFileSync(MODEL);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mesh = readSTL(buffer, 'ocarina.stl').parts[0].mesh;
    const obj = { mesh, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const t0 = performance.now();
    const a = analyzeOrientations(obj, { bed: { widthMm: 256, depthMm: 256, heightMm: 256, marginMm: 5 } });
    const ms = performance.now() - t0;
    const cur = a.candidates.find((c) => c.id === a.currentId)!;
    console.info(`ocarina: ${a.triangleCount} tri, ${a.candidates.length} candidatos, ${ms.toFixed(0)} ms, currentIsBest=${a.currentIsBest}, baseStatus=${a.baseStatus}`);
    console.info(`  actual: contacto ${cur.measures.contactAreaMm2.toFixed(1)} mm², estable ${cur.measures.stable}, soporte ${cur.measures.supportVolumeMm3.toFixed(0)} mm³`);
    for (const c of a.candidates.slice(0, 5)) {
      console.info(`  ${c.id}: contacto ${c.measures.contactAreaMm2.toFixed(1)} mm², estable ${c.measures.stable}, soporte ${c.measures.supportVolumeMm3.toFixed(0)} mm³, vuelco ${c.measures.tipAngleDeg.toFixed(1)}°`);
    }
    if (cur.measures.contactAreaMm2 < 1) expect(a.currentIsBest).toBe(false);
    // Con base estable en alguna, va primera; si no, el análisis lo avisa.
    if (a.candidates.some((c) => c.measures.stable)) expect(a.candidates[0].measures.stable).toBe(true);
    else expect(a.baseStatus).toBe('noStableBase');
  });
});
