/**
 * @file src/core/scene/__tests__/plateArrange.perf.test.ts
 * @description Tiempo de «Repartir en placas» (compacto, mantener orientación) con 300 piezas de tamaños distintos
 * y mallas de ~2 mil vértices: debe quedar bajo 1 s y sin piezas fuera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import type { SceneObject } from '../../../types/kura';
import { arrangeOnPlates } from '../plateArrange';

/** Nube de `n` vértices dentro de una caja w × h × d (la huella solo mira los vértices). */
function cloud(w: number, h: number, d: number, n: number) {
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (i * 0.618034) % 1, b = (i * 0.414214) % 1, c = (i * 0.732051) % 1;
    positions[i * 3] = (a - 0.5) * w;
    positions[i * 3 + 1] = b * h;
    positions[i * 3 + 2] = (c - 0.5) * d;
  }
  positions.set([-w / 2, 0, -d / 2, w / 2, h, d / 2], 0);
  return { positions, indices: new Uint32Array([0, 1, 2]) };
}

describe('Repartir en placas (perf)', () => {
  it('300 piezas en menos de 1 s', () => {
    const objects = Array.from({ length: 300 }, (_, i) => ({
      id: `o${i}`, name: `o${i}`, role: 'solid', visible: true, locked: false, color: '#fff', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      mesh: cloud(8 + ((i * 37) % 60), 10, 8 + ((i * 53) % 50), 2000),
    })) as unknown as SceneObject[];
    const t0 = performance.now();
    const plan = arrangeOnPlates({ objects, plates: [], groups: [], projectBed: { widthMm: 256, depthMm: 256, heightMm: 256 }, options: {} });
    const ms = performance.now() - t0;
    console.info(`[perf] repartir 300 piezas: ${ms.toFixed(0)} ms, ${plan.report.platesUsed.length} placas`);
    expect(plan.report.placed).toHaveLength(300);
    expect(ms).toBeLessThan(1000);
  });
});
