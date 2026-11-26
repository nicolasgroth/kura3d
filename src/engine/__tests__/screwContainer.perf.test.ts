/**
 * @file src/engine/__tests__/screwContainer.perf.test.ts
 * @description Rendimiento del recipiente con tapa roscada: generar cuerpo + tapa y verificar el enroscado (6
 * posiciones) quedan bajo umbrales en ms, en el tamaño por defecto y en uno grande (Ø 150 mm, paso 6, 3 vueltas).
 * La vista previa del asistente se pausa sobre 1,5 s: la verificación del tamaño por defecto debe quedar bajo eso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { initManifoldEngine } from '../manifoldKernel';
import { createScrewContainer, screwContainerFit } from '../screwContainer';

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const value = await fn();
  return [value, performance.now() - t0];
}

describe('recipiente con tapa roscada: rendimiento', () => {
  it('tamaño por defecto: generar < 800 ms y verificar (4 posiciones, como el asistente) < 1500 ms', async () => {
    await initManifoldEngine();
    // Calentamiento (JIT y primer uso del motor): se mide el régimen normal, como en la vista previa ya abierta.
    await createScrewContainer({ innerDiameterMm: 20, innerHeightMm: 20 });
    await screwContainerFit({ innerDiameterMm: 20, innerHeightMm: 20 }, { samples: 2 });
    const [, gen] = await timed(() => createScrewContainer({}));
    const [fit, check] = await timed(() => screwContainerFit({}, { samples: 4 }));
    expect(fit.status).toBe('ok');
    expect(gen).toBeLessThan(800);
    expect(check).toBeLessThan(1500);
  });

  it('grande (Ø 150, paso 6, 3 vueltas, moleteado): generar < 2500 ms y verificar < 4000 ms', async () => {
    const big = { innerDiameterMm: 150, innerHeightMm: 120, pitchMm: 6, turns: 3, grip: 'knurl' as const };
    const [, gen] = await timed(() => createScrewContainer(big));
    const [fit, check] = await timed(() => screwContainerFit(big));
    expect(fit.status).toBe('ok');
    expect(gen).toBeLessThan(2500);
    expect(check).toBeLessThan(4000);
  });
});
