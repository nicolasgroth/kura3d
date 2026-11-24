/**
 * @file src/core/recipes/__tests__/runCaja.test.ts
 * @description Caja con tapa (`kura.caja-tapa`) ejecutada de punta a punta sin interfaz: mallas cerradas, medidas
 * exteriores exactas, volumen igual al de las fórmulas (con el área real de los cilindros poligonales), cuatro
 * torretas con su agujero, agujeros de la tapa alineados con los postes, y tapa a presión que calza con 0,2 mm de
 * holgura (`minGap` de Manifold). También la procedencia (`metadata.recipe`) y el `fits_bed`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { computeMeshStats } from '../../../engine';
import { primitiveMesh } from '../../operations/creationOperations';
import { runRecipe } from '../run/executeRecipe';
import { EXAMPLES, clone } from './fixtures';
import { expectOk, manifoldModule, testContext, userSize, worldManifold } from './runSupport';

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await manifoldModule();
});

/** Área de la sección del cilindro poligonal que genera el motor (no la del círculo ideal). */
async function cylinderArea(radius: number): Promise<number> {
  const mesh = await primitiveMesh('cylinder', { radius, height: 10 });
  return computeMeshStats(mesh).volumeMm3 / 10;
}

describe('ejecutor: caja con tapa atornillada (valores por defecto)', () => {
  it('genera caja y tapa cerradas, con medidas exteriores y volumen de las fórmulas', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.caja), options: { bed: { w: 220, d: 220, h: 250 } } }));
    const [box, lid] = result.change.added;
    expect(result.change.added).toHaveLength(2);
    expect(result.change.removedIds).toEqual([]);
    expect(result.change.patches).toEqual([]);
    expect(box.name).toBe('Caja');
    expect(lid.name).toBe('Tapa');
    // La caja no tiene agujeros pasantes (pilotos ciegos); la tapa, cuatro (género 4).
    for (const [obj, genus] of [[box, 0], [lid, 4]] as const) {
      expect(obj.role).toBe('solid');
      expect(computeMeshStats(obj.mesh).isManifold).toBe(true);
      const m = worldManifold(wasm, obj);
      expect(m.status()).toBe('NoError');
      expect(m.genus()).toBe(genus);
    }
    // w=80, dp=60, h=40, pared 2: exterior 84 × 64 × 42; tapa 84 × 64 × 2.
    userSize(box).forEach((v, k) => expect(v).toBeCloseTo([84, 64, 42][k], 4));
    userSize(lid).forEach((v, k) => expect(v).toBeCloseTo([84, 64, 2][k], 4));

    // Volumen: cáscara + 4 postes (r = M3 + 1 = 4, alto 40) − 4 pilotos (r = 1,26, 38 mm dentro del poste).
    const post = await cylinderArea(4);
    const pilot = await cylinderArea(3 * 0.42);
    const hole = await cylinderArea(3 / 2 + 0.2);
    const expectedBox = 84 * 64 * 42 - 80 * 60 * 40 + 4 * post * 40 - 4 * pilot * 38;
    const expectedLid = 84 * 64 * 2 - 4 * hole * 2;
    expect(Math.abs(worldManifold(wasm, box).volume() - expectedBox) / expectedBox).toBeLessThan(0.005);
    expect(Math.abs(worldManifold(wasm, lid).volume() - expectedLid) / expectedLid).toBeLessThan(0.002);

    // Cuatro torretas, cuatro pilotos y cuatro agujeros en la tapa (patrón `corners`).
    expect(result.stats.produced).toMatchObject({ posts: 4, pilots: 4, holes: 4, slots: 0, lip: 0, box: 1, lidout: 1 });
    expect(result.checks).toEqual([]);
  });

  it('los agujeros de la tapa quedan sobre los pilotos de las torretas', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.caja) }));
    const lid = worldManifold(wasm, result.change.added[1]).translate([-94, 42, 0]);
    const box = worldManifold(wasm, result.change.added[0]);
    expect(lid.intersect(box).volume()).toBeCloseTo(0, 3);
    for (const [x, y] of [[-36, -26], [36, -26], [36, 26], [-36, 26]]) {
      // Varilla vertical de r = 1 en el eje de cada torreta (Y interno = Z del usuario; Z interno = −Y del usuario).
      const rod = wasm.Manifold.cylinder(100, 1, 1, 24).rotate([-90, 0, 0]).translate([x, -20, -y]);
      expect(rod.intersect(lid).volume()).toBeCloseTo(0, 3);
      expect(rod.intersect(box).volume()).toBeGreaterThan(0);
      expect(rod.intersect(box).volume()).toBeLessThan(Math.PI * 1 * 1 * 4);
    }
  });

  it('guarda la procedencia mínima para regenerar', async () => {
    const answers = { w: 70 };
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.caja), answers }));
    const meta = result.change.added.map((o) => o.metadata?.recipe);
    expect(meta[0]).toMatchObject({ id: 'kura.caja-tapa', version: '1.1.0', answers: { w: 70 }, output: 'box' });
    expect(meta[1]?.output).toBe('lidout');
    expect(meta[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(meta[0]?.hash).toBe(meta[1]?.hash);
  });
});

describe('ejecutor: caja con tapa a presión', () => {
  it('la pestaña de la tapa entra en la caja con 0,2 mm de holgura por lado', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.caja), answers: { fix: 'press' } }));
    expect(result.stats.produced).toMatchObject({ posts: 0, pilots: 0, holes: 0, lip: 1 });
    const [boxObj, lidObj] = result.change.added;
    userSize(lidObj).forEach((v, k) => expect(v).toBeCloseTo([84, 64, 5][k], 4));
    const box = worldManifold(wasm, boxObj);
    // Tapa volteada sobre la caja, 1 mm por encima del borde: la pestaña (3 mm) entra 2 mm.
    const lid = worldManifold(wasm, lidObj).rotate([180, 0, 0]).translate([-94, 45, 0]);
    expect(lid.intersect(box).volume()).toBeCloseTo(0, 3);
    expect(lid.minGap(box, 2)).toBeCloseTo(0.2, 3);
  });

  it('avisa (sin dividir) cuando una salida no cabe en la cama', async () => {
    const result = expectOk(await runRecipe(testContext(), {
      recipe: clone(EXAMPLES.caja), answers: { w: 300 }, options: { bed: { w: 220, d: 220, h: 250 } },
    }));
    expect(result.checks.map((c) => [c.ref, c.onFail])).toEqual([['box', 'offer_split'], ['lidout', 'offer_split']]);
    expect(result.checks[0].size[0]).toBeCloseTo(304, 4);
  });
});
