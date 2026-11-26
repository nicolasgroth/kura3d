/**
 * @file src/engine/__tests__/colorSplitBrush.perf.test.ts
 * @description Tiempo de "separar por colores" en el caso de la QA: cilindro Ø28×36 con un trazo de
 * pincel refinado (~14 mil triángulos). Antes tardaba ~90 s por la unión de miles de prismas; el camino
 * directo (engrosado sin booleanas) debe quedar bajo 5 s.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { expect, it, vi } from 'vitest';
import { splitMeshByColorSolid } from '../colorSplitSolid';
import { initManifoldEngine } from '../manifoldKernel';
import { brushObj, paintedCylinder } from './brushPaintFixtures';

vi.setConfig({ testTimeout: 60_000 });

it('cilindro pintado con pincel refinado: separar por colores en menos de 5 s', async () => {
  await initManifoldEngine();
  const o = brushObj(await paintedCylinder());
  const t0 = performance.now();
  const { parts } = await splitMeshByColorSolid(o, { depthMm: 1 });
  const ms = performance.now() - t0;
  expect(parts.length).toBe(2);
  expect(ms).toBeLessThan(5000);
});
