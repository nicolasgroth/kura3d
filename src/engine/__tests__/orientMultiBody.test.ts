/**
 * @file src/engine/__tests__/orientMultiBody.test.ts
 * @description «Orientar para imprimir» con piezas de varios cuerpos separados (QA 25-nov): el casco convexo
 * propone caras que cruzan de un cuerpo a otro y que solo tocan la cama con aristas. Esas orientaciones no
 * tienen base real (contacto 0 mm²): no pueden salir recomendadas ni marcarse estables, y al aplicar la elegida
 * la malla real queda con min Y = 0, cerrada y con el mismo volumen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { applyTransformToMesh, computeMeshStats } from '..';
import { analyzeOrientations, planOrientTransform, type OrientAnalysis } from '../orient';
import type { MeshData, Vec3 } from '../../types/kura';
import { input, qaCross, stepCubes } from './orientShapes';

/** Las aristas tocan la cama con 0 mm²; una base real de estas piezas mide cientos. */
const MIN_BASE = 10;
const withBase = (c: OrientAnalysis['candidates'][number]) => c.measures.contactAreaMm2 >= MIN_BASE;

function exactMinY(mesh: MeshData, t: { position: Vec3; rotation: Vec3; scale: Vec3 }) {
  const world = applyTransformToMesh(mesh as never, t.position, t.rotation, t.scale);
  let minY = Infinity;
  for (let i = 1; i < world.positions.length; i += 3) minY = Math.min(minY, world.positions[i]);
  return { minY, world };
}

describe.each([
  ['cruz de QA (dos cajas que no se tocan)', qaCross, 8000],
  ['dos cubos escalonados', stepCubes, 2000],
])('orientar pieza de 2 cuerpos: %s', (_name, make, volume) => {
  const mesh = make();
  const a = analyzeOrientations(input(mesh));
  const best = a.candidates[0];

  it('la recomendada tiene base real (contacto > 0) y es estable', () => {
    expect(withBase(best)).toBe(true);
    expect(best.measures.stable).toBe(true);
    expect(best.reasons.some((r) => r.key === 'noBase')).toBe(false);
  });

  it('ninguna orientación sin base real queda antes que una con base, ni se marca estable', () => {
    const firstWithout = a.candidates.findIndex((c) => !withBase(c));
    if (firstWithout >= 0) expect(a.candidates.slice(firstWithout).every((c) => !withBase(c))).toBe(true);
    for (const c of a.candidates.filter((x) => !withBase(x))) {
      expect(c.measures.stable).toBe(false);
      expect(c.reasons).toContainEqual({ key: 'noBase' });
      expect(c.equivalentToBest).toBe(false);
      // Del casco solo se proponen apoyos reales.
      expect(c.source).not.toBe('hull');
    }
  });

  it('aplicar cualquier opción deja la malla real con min Y = 0, cerrada y con el mismo volumen', () => {
    for (const c of a.candidates) {
      const t = planOrientTransform(input(mesh), c.quaternion, { keepXY: false });
      const { minY, world } = exactMinY(mesh, t);
      expect(minY).toBeCloseTo(0, 6);
      const s = computeMeshStats(world);
      expect(s.volumeMm3).toBeCloseTo(volume, 3);
    }
  });

  it('reanalizar tras aplicar la recomendada: la actual es la mejor y sigue con base', () => {
    const t = planOrientTransform(input(mesh), best.quaternion, { keepXY: false });
    const again = analyzeOrientations({ mesh, ...t });
    const cur = again.candidates.find((c) => c.id === again.currentId)!;
    expect(again.currentIsBest).toBe(true);
    expect(withBase(cur)).toBe(true);
  });
});
