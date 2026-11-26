/**
 * @file src/engine/__tests__/threeMfMeshScan.perf.test.ts
 * @description Medición (proyecto `perf`, `npm run test:perf`): el escáner de vértices 3MF es lineal con
 * miles de atributos sin comilla de cierre (con N y 2N etiquetas el tiempo crece menos de 3×).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { scanVertices } from '../io/threeMfMeshScan';

describe('scanVertices (tiempo)', () => {
  it('miles de atributos sin comilla de cierre: tiempo lineal', () => {
    const doc = (n: number) => `<vertex x='1 y="2" z="3"/>\n`.repeat(n);
    const time = (xml: string) => {
      let best = Infinity;
      for (let r = 0; r < 3; r++) {
        const t0 = performance.now();
        scanVertices(xml, () => {});
        best = Math.min(best, performance.now() - t0);
      }
      return best;
    };
    const small = doc(40_000); // ~1 MB
    const large = doc(80_000);
    time(small); // calentamiento
    const ratio = time(large) / Math.max(time(small), 0.5);
    expect(ratio).toBeLessThan(3);
  });
});
