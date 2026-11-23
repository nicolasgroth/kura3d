/**
 * @file src/engine/__tests__/measureAnchors.test.ts
 * @description Anclas de medición: un punto guardado en coordenadas locales sigue al objeto al moverlo,
 * girarlo o escalarlo; las normales se transforman con la normal-matrix; la región de área se recalcula
 * (escala de 2 → área ×4); y un ancla deja de ser válida si el objeto desaparece o su malla cambia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { localToWorld, localTriangles, makeAnchor, normalToWorld, validObjectFor, worldRegion, worldToLocal } from '../measure';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject, Vec3 } from '../../types/kura';

const near = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  for (let i = 0; i < b.length; i++) expect(a[i]).toBeCloseTo(b[i], 4);
};

describe('measureAnchors', () => {
  const obj = (patch: Partial<SceneObject> = {}): SceneObject => ({ ...fakeBox('a', 'A', 20), ...patch });

  it('ida y vuelta mundo ↔ local con posición, rotación y escala', () => {
    const o = obj({ position: [10, 5, -3], rotation: [0.3, 1.1, -0.4], scale: [2, 1, 3] });
    const w: Vec3 = [4, 9, 2];
    near(localToWorld(o, worldToLocal(o, w)), w);
  });

  it('el punto sigue al objeto cuando se mueve, gira o escala', () => {
    const o = obj({ position: [0, 0, 0] });
    const anchor = makeAnchor(o, [10, 20, 0]);
    near(localToWorld({ ...o, position: [30, 0, 0] }, anchor.local), [40, 20, 0]);
    near(localToWorld({ ...o, scale: [2, 2, 2] }, anchor.local), [20, 40, 0]);
    // Giro de 90° sobre Y: (x, y, z) pasa a (z, y, −x).
    near(localToWorld({ ...o, rotation: [0, Math.PI / 2, 0] }, anchor.local), [0, 20, -10]);
  });

  it('la normal gira con el objeto', () => {
    const o = obj();
    const a = makeAnchor(o, [0, 20, 0], [0, 1, 0]);
    near(normalToWorld({ ...o, rotation: [0, 0, Math.PI / 2] }, a.normalLocal!), [-1, 0, 0]);
  });

  it('es válida solo mientras el objeto existe con la misma malla', () => {
    const o = obj();
    const a = makeAnchor(o, [0, 0, 0]);
    expect(validObjectFor(a, [o])).toBe(o);
    expect(validObjectFor(a, [{ ...o, position: [5, 0, 0] }])?.id).toBe('a');
    expect(validObjectFor(a, [])).toBeNull();
    expect(validObjectFor(a, [{ ...o, mesh: { ...o.mesh } }])).toBeNull();
  });

  it('la región de área se recalcula con la escala', () => {
    const o = obj();
    // Un triángulo rectángulo local de catetos 10 y 10: área 50.
    const tris = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
    const part = { objectId: o.id, mesh: o.mesh, tris };
    expect(worldRegion([{ part, obj: o }]).areaMm2).toBeCloseTo(50, 4);
    expect(worldRegion([{ part, obj: { ...o, scale: [2, 2, 2] } }]).areaMm2).toBeCloseTo(200, 4);
    expect(worldRegion([{ part, obj: { ...o, position: [7, 7, 7] } }]).areaMm2).toBeCloseTo(50, 4);
    expect(localTriangles(o.mesh, new Uint32Array([0])).length).toBe(9);
  });
});
