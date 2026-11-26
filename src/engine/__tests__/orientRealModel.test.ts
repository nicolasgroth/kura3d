/**
 * @file src/engine/__tests__/orientRealModel.test.ts
 * @description «Orientar para imprimir» sobre un modelo real de la carpeta local de evaluación (no
 * se copia al repositorio): si el archivo no existe la prueba se omite. Verifica que las medidas
 * sean finitas y coherentes, que la recomendada no empeore el soporte y que aplicarla apoye la pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { applyTransformToMesh } from '../primitives';
import { readSTL } from '../io/stl';
import { analyzeOrientations, planOrientTransform } from '../orient';

interface NodeFs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
const fs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const MODEL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const present = fs.existsSync(MODEL);

describe('Orientar: modelo real (ocarina)', () => {
  it.skipIf(!present)('propone orientaciones medibles y la recomendada no empeora el soporte', () => {
    const bytes = fs.readFileSync(MODEL);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mesh = readSTL(buffer, 'ocarina.stl').parts[0].mesh;
    const obj = { mesh, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const t0 = performance.now();
    const a = analyzeOrientations(obj, { bed: { widthMm: 256, depthMm: 256, heightMm: 256, marginMm: 5 } });
    const ms = performance.now() - t0;
    console.info(`ocarina: ${a.triangleCount} triángulos, ${a.candidates.length} candidatos, ${ms.toFixed(0)} ms, celda ${a.supportCellMm.toFixed(2)} mm`);
    for (const c of a.candidates.slice(0, 3)) {
      console.info(`  ${c.id}: voladizo ${c.measures.overhangAreaMm2.toFixed(0)} mm², soporte ${c.measures.supportVolumeMm3.toFixed(0)} mm³, contacto ${c.measures.contactAreaMm2.toFixed(0)} mm², alto ${c.measures.heightMm.toFixed(1)} mm`);
    }
    expect(a.triangleCount).toBeGreaterThan(1000);
    expect(a.candidates.length).toBeGreaterThanOrEqual(2);
    for (const c of a.candidates) {
      for (const v of [c.measures.overhangAreaMm2, c.measures.supportVolumeMm3, c.measures.heightMm, c.cost]) expect(Number.isFinite(v)).toBe(true);
      expect(c.measures.overhangAreaMm2).toBeGreaterThanOrEqual(0);
      expect(c.measures.supportVolumeMm3).toBeGreaterThanOrEqual(0);
      if (c.source === 'hull') expect(c.measures.stable).toBe(true);
    }
    const best = a.candidates[0];
    const cur = a.candidates.find((c) => c.id === a.currentId)!;
    expect(best.cost).toBeLessThanOrEqual(cur.cost);
    if (!a.currentIsBest) expect(best.measures.supportVolumeMm3).toBeLessThanOrEqual(cur.measures.supportVolumeMm3 * 1.05 + 1);

    const t = planOrientTransform(obj, best.quaternion);
    const world = applyTransformToMesh(mesh, t.position, t.rotation, t.scale);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < world.positions.length; i += 3) { minY = Math.min(minY, world.positions[i]); maxY = Math.max(maxY, world.positions[i]); }
    expect(minY).toBeCloseTo(0, 3);
    expect(maxY - minY).toBeCloseTo(best.measures.heightMm, 2);
  });
});
