/**
 * @file src/components/__tests__/planeCutDialogAxes.test.ts
 * @description Ruta real del diálogo de corte por plano (opciones del diálogo → acción del store → motor
 * real): la mitad "positiva (+)" / "negativa (−)" es la del lado +/− del eje que ve el usuario (Z = altura,
 * Y = fondo) en los tres ejes y ambos sentidos, y el desplazamiento con signo en Y corta donde dice el campo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { toUserBox } from '../../core/scene/displayAxes';
import { planeFromUser } from '../../core/scene/userAxesContract';
import { applyTransformToMesh } from '../../engine';
import { resetStore, store } from '../../store/__tests__/storeTestUtils';
import type { PlaneCutOptions, SceneObject } from '../../types/kura';
import { planeCutOptionsFromDialog } from '../planeCutOptions';

function userMinMax(o: SceneObject) {
  const p = applyTransformToMesh(o.mesh, o.position, o.rotation, o.scale).positions;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i + k]); max[k] = Math.max(max[k], p[i + k]); }
  const b = toUserBox({ min, max });
  return { min: b.min.map((n) => Math.round(n * 100) / 100), max: b.max.map((n) => Math.round(n * 100) / 100) };
}

const IDX = { x: 0, y: 1, z: 2 } as const;

/** Lo que hace el diálogo: el selector guarda el eje interno y el campo muestra el desplazamiento del usuario. */
async function cutLikeDialog(userAxis: 'x' | 'y' | 'z', userOffset: number, keepMode: 'positive' | 'negative') {
  await resetStore();
  const box = await store().createPrimitive('box', { width: 10, height: 30, depth: 20 });
  const { axis, offset } = planeFromUser(userAxis, userOffset);
  const opts: PlaneCutOptions = { axis, offset, connectorType: 'none', connectorSize: 4, connectorDepth: 6, tolerance: 0.25, connectorCount: 2, keepMode };
  const parts = await store().planeCutObject(box!.id, planeCutOptionsFromDialog(opts));
  expect(parts.length).toBe(1);
  return userMinMax(store().objects.find((o) => o.id === parts[0].id)!);
}

describe('corte por plano desde el diálogo: mitad en ejes del usuario (motor real)', () => {
  beforeEach(() => resetStore());

  // Caja de 10 (X) × 20 (Y) × 30 (Z): X∈[-5,5], Y∈[-10,10], Z∈[0,30] (el desplazamiento es respecto del centro de la pieza). Plano en el centro de cada eje.
  const centers = { x: 0, y: 0, z: 0 } as const;
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const keep of ['positive', 'negative'] as const) {
      it(`eje ${axis.toUpperCase()}, mitad ${keep}: queda del lado correcto`, async () => {
        const c = centers[axis];
        const mid = axis === 'z' ? 15 : 0; // posición mundo del centro
        const r = await cutLikeDialog(axis, c, keep);
        const i = IDX[axis];
        if (keep === 'positive') {
          expect(r.min[i], JSON.stringify(r)).toBeGreaterThanOrEqual(mid - 0.01);
          expect(r.max[i]).toBeGreaterThan(mid + 1);
        } else {
          expect(r.max[i], JSON.stringify(r)).toBeLessThanOrEqual(mid + 0.01);
          expect(r.min[i]).toBeLessThan(mid - 1);
        }
      }, 60_000);
    }
  }

  it('Y con desplazamiento con signo: +5 y mitad positiva deja Y∈[5,10]', async () => {
    const r = await cutLikeDialog('y', 5, 'positive');
    expect(r.min[1]).toBeCloseTo(5, 1);
    expect(r.max[1]).toBeCloseTo(10, 1);
  }, 60_000);

  it('Y con desplazamiento con signo: -5 y mitad negativa deja Y∈[-10,-5]', async () => {
    const r = await cutLikeDialog('y', -5, 'negative');
    expect(r.min[1]).toBeCloseTo(-10, 1);
    expect(r.max[1]).toBeCloseTo(-5, 1);
  }, 60_000);

  it('Y sin desplazamiento, mitad positiva: Y∈[0,10] (el caso reportado)', async () => {
    const r = await cutLikeDialog('y', 0, 'positive');
    expect(r.min[1]).toBeCloseTo(0, 1);
    expect(r.max[1]).toBeCloseTo(10, 1);
  }, 60_000);
});
