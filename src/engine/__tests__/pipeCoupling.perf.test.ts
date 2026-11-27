/**
 * @file src/engine/__tests__/pipeCoupling.perf.test.ts
 * @description Rendimiento del acople de tubería: generar macho + hembra y verificar (4 posiciones en la roscada, como
 * el asistente) quedan bajo umbrales en ms, en el tamaño por defecto y en uno grande (Ø 120 mm). La vista previa del
 * asistente se pausa sobre 1,5 s: la verificación del tamaño por defecto debe quedar muy por debajo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { createPipeCoupling, pipeCouplingFit } from '../pipeCoupling';

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const value = await fn();
  return [value, performance.now() - t0];
}

describe('acople de tubería: rendimiento', () => {
  it('tamaño por defecto: generar < 500 ms y verificar < 800 ms (roscado y a presión)', async () => {
    await initManifoldEngine();
    // Calentamiento (JIT y primer uso del motor).
    await createPipeCoupling({ boreDiameterMm: 8 });
    await pipeCouplingFit({ boreDiameterMm: 8 }, { samples: 2 });
    for (const joint of ['thread', 'press'] as const) {
      const [, gen] = await timed(() => createPipeCoupling({ joint }));
      const [fit, check] = await timed(() => pipeCouplingFit({ joint }, { samples: 4 }));
      expect(fit.status).toBe('ok');
      expect(gen).toBeLessThan(500);
      expect(check).toBeLessThan(800);
    }
  });

  it('grande (Ø 120, paso 5, 3 vueltas): generar < 2000 ms y verificar (6 posiciones) < 3000 ms', async () => {
    const big = { boreDiameterMm: 120, wallMm: 3, pitchMm: 5, turns: 3, tailLengthMm: 30 };
    const [, gen] = await timed(() => createPipeCoupling(big));
    const [fit, check] = await timed(() => pipeCouplingFit(big));
    expect(fit.status).toBe('ok');
    expect(gen).toBeLessThan(2000);
    expect(check).toBeLessThan(3000);
  });
});
