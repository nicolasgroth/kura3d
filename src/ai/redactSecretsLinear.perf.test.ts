/**
 * @file src/ai/redactSecretsLinear.perf.test.ts
 * @description Medición con reloj de que `redactSecrets` (clave conocida y patrones de proveedores)
 * crece de forma lineal con entradas adversarias. Solo en `npm run test:perf`: el reloj tiene ruido
 * en CI; en `npm test` queda la versión por conteo (redactSecretsEvasion.test.ts).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { redactSecrets } from './providerSecurity';

/** Mínimo de varias repeticiones: descarta pausas del recolector y de la máquina. */
function minTime(n: number, reps = 5): number {
  const text = 's'.repeat(n);
  let best = Infinity;
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    redactSecrets(text, 'ssssssssssssssssssssss');
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

describe('redactSecrets: tiempo lineal', () => {
  it('duplicar la entrada no cuadruplica el tiempo', () => {
    minTime(500_000, 2); // calentamiento del JIT
    const small = minTime(1_000_000);
    const big = minTime(2_000_000);
    // Lineal ≈ 2×; cuadrático ≈ 4×. Margen holgado y piso de 10 ms contra el ruido.
    expect(big).toBeLessThan(Math.max(10, small) * 3.2);
  }, 120_000);
});
