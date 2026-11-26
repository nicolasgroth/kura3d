/**
 * @file src/core/recipes/__tests__/runEjemplos.test.ts
 * @description Llavero (texto 3D + argolla, en relieve y grabado, y con logo SVG) y placa de enchufe (variantes
 * de Chile y EE. UU.) ejecutados sin interfaz: mallas cerradas, medidas que siguen las fórmulas de la receta y
 * agujeros pasantes contados por el género de la malla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { ManifoldToplevel } from 'manifold-3d';
import { computeMeshStats } from '../../../engine';
import { runRecipe } from '../run/executeRecipe';
import { EXAMPLES, clone } from './fixtures';
import { expectOk, manifoldModule, testContext, userSize, worldManifold } from './runSupport';

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await manifoldModule();
});

const SQUARE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10"/></svg>';

describe('ejecutor: llavero', () => {
  it('en relieve: una pieza cerrada con argolla pasante y el texto sobre la base', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.llavero) }));
    expect(result.change.added).toHaveLength(1);
    const [key] = result.change.added;
    expect(key.name).toBe('Kura');
    expect(computeMeshStats(key.mesh).isManifold).toBe(true);
    const m = worldManifold(wasm, key);
    expect(m.status()).toBe('NoError');
    expect(m.genus()).toBe(1); // la argolla
    const [x, y, z] = userSize(key);
    // Alto = base (3) + texto (1 + 0,01). El ancho sigue la fórmula de la placa: arte + letra + argolla + 3.
    expect(z).toBeCloseTo(4.01, 3);
    expect(y).toBeGreaterThan(10);
    expect(x).toBeGreaterThan(y);
    expect(result.stats.produced).toMatchObject({ label: 1, icon: 0, art: 1, art2: 1, plate: 1, eye: 1, out: 1 });
  });

  it('grabado: el texto se resta y la pieza conserva el grosor de la base', async () => {
    const relief = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.llavero) }));
    const engraved = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.llavero), answers: { mode: 'engrave' } }));
    const [obj] = engraved.change.added;
    expect(userSize(obj)[2]).toBeCloseTo(3, 4);
    const plateVolume = (o: typeof obj) => worldManifold(wasm, o).volume();
    // Grabar quita material; el relieve lo agrega.
    expect(plateVolume(obj)).toBeLessThan(plateVolume(relief.change.added[0]));
    expect(worldManifold(wasm, obj).status()).toBe('NoError');
  });

  it('con logo SVG elegido por el usuario y sin texto: el logo pasa por el lector SVG del motor', async () => {
    const result = expectOk(await runRecipe(testContext(), {
      recipe: clone(EXAMPLES.llavero),
      answers: { text: '', logo: { kind: 'svg', bytes: SQUARE_SVG.length } },
      files: { logo: SQUARE_SVG },
    }));
    expect(result.stats.produced).toMatchObject({ label: 0, icon: 1, art: 1 });
    const [obj] = result.change.added;
    expect(worldManifold(wasm, obj).status()).toBe('NoError');
    // El cuadrado del logo mide 1,4 × tamaño de letra (14 mm) y se levanta 1 mm sobre la base de 3 mm.
    expect(userSize(obj)[2]).toBeCloseTo(4, 3);
    expect(obj.metadata?.recipe?.omitted).toEqual(['logo']);
  });
});

describe('ejecutor: placa de enchufe', () => {
  it('variante de Chile: un módulo, ventana y dos agujeros pasantes, medidas de la fórmula', async () => {
    const result = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.placa), options: { variant: 'cl' } }));
    const [plate] = result.change.added;
    // pw = módulos·mw + 2·margen = 45 + 36 = 81; alto 80; grosor 3.
    userSize(plate).forEach((v, k) => expect(v).toBeCloseTo([81, 80, 3][k], 4));
    const m = worldManifold(wasm, plate);
    expect(m.status()).toBe('NoError');
    expect(m.genus()).toBe(3); // ventana + 2 tornillos
    expect(plate.metadata?.recipe).toMatchObject({ id: 'kura.placa-enchufe', variant: 'cl', output: 'out' });
    expect(result.messages.some((msg) => msg.level === 'info')).toBe(true);
  });

  it('variante de EE. UU. (tornillos arriba y abajo) y tres módulos con la de Chile', async () => {
    const us = expectOk(await runRecipe(testContext(), { recipe: clone(EXAMPLES.placa), options: { variant: 'us' } }));
    userSize(us.change.added[0]).forEach((v, k) => expect(v).toBeCloseTo([70 + 36, 114, 3][k], 4));
    expect(worldManifold(wasm, us.change.added[0]).genus()).toBe(3);
    const three = expectOk(await runRecipe(testContext(), {
      recipe: clone(EXAMPLES.placa), options: { variant: 'cl' }, answers: { modules: 3, spacing: 160 },
    }));
    expect(three.stats.produced).toMatchObject({ win: 3, holes: 2, sinks: 2 });
    expect(worldManifold(wasm, three.change.added[0]).genus()).toBe(5);
  });
});
