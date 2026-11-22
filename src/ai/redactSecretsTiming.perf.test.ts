/**
 * @file src/ai/redactSecretsTiming.perf.test.ts
 * @description Topes absolutos de tiempo de `redactSecrets` con entradas de varios MB y claves
 * hostiles (repetitivas). Solo corre con `npm run test:perf`: depende de la carga de la máquina.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { redactSecrets } from './providerSecurity';

describe('redactSecrets: tiempo con entradas grandes', () => {
  it('clave de caracteres repetidos sobre 100k repeticiones: < 1 s', () => {
    const t0 = performance.now();
    redactSecrets('aaaa'.repeat(25_000) + ' fin', 'a'.repeat(40));
    redactSecrets('ab'.repeat(50_000), 'ab'.repeat(30) + 'c');
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('entradas de 5 MB con claves hostiles: < 4 s', () => {
    const t0 = performance.now();
    redactSecrets('a '.repeat(2_500_000) + 'Bearer ' + 'x'.repeat(1_000_000), 'a b c d e f g h');
    redactSecrets('s'.repeat(5_000_000), 'ssssssssssssssssssssss');
    redactSecrets('k'.repeat(5_000_000), 'sk-' + 'k'.repeat(105));
    expect(performance.now() - t0).toBeLessThan(4000);
  });
});
