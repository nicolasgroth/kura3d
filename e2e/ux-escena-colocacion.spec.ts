/**
 * @file e2e/ux-escena-colocacion.spec.ts
 * @description Lo nuevo no se coloca encima de lo existente: primitivas desde la barra de formas, rosca,
 * STL importado, piezas más grandes que el hueco o que la cama, duplicados, mitades de corte y piezas
 * extraídas quedan en un hueco libre sin solapar OTROS objetos. Ejecuta con `npm run test:e2e`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, cajas, importarStl, solapes, stlCubes } from './ux-escena-helpers';

const cuenta = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.length);
const forma = async (page: Page, name: string, total: number) => {
  await page.getByRole('button', { name, exact: true }).first().click();
  await expect.poll(() => cuenta(page)).toBe(total);
};

test('crear cubo, cilindro, esfera, rosca e importar un STL: ninguna caja se interseca', async ({ page }) => {
  await abrir(page);
  await forma(page, 'Cubo', 1);
  await forma(page, 'Cilindro', 2);
  await forma(page, 'Esfera', 3);
  await page.evaluate(() => (window as any).__s.getState().createThreadObject({ kind: 'bolt', diameterMm: 10, pitchMm: 1.5, lengthMm: 20, includeHead: true }));
  await expect.poll(() => cuenta(page)).toBe(4);
  await importarStl(page, 'centrado.stl', stlCubes([[0, 20, 0]], 40));
  await expect.poll(() => cuenta(page)).toBe(5);
  expect(solapes(await cajas(page))).toEqual([]);
});

test('STL más grande que el hueco y cubo mayor que la cama: sin solapes y con aviso', async ({ page }) => {
  await abrir(page);
  await forma(page, 'Cilindro', 1);
  await importarStl(page, 'grande.stl', stlCubes([[0, 100, 0]], 200));
  await expect.poll(() => cuenta(page)).toBe(2);
  await page.evaluate(() => (window as any).__s.getState().createPrimitive('box', { width: 440, height: 440, depth: 440 }, { placement: 'free' }));
  await expect.poll(() => cuenta(page)).toBe(3);
  expect(solapes(await cajas(page))).toEqual([]);
  await expect(page.getByText(/espacio libre en la cama/i).first()).toBeVisible();
});

test('agrandar un cubo hasta tocar el cilindro lo lleva a un hueco libre', async ({ page }) => {
  await abrir(page);
  await forma(page, 'Cilindro', 1);
  await forma(page, 'Cubo', 2);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const cube = s.objects[1];
    await s.updatePrimitiveParams(cube.id, { kind: 'primitive', params: { width: 440, height: 440, depth: 440 } });
  });
  await expect.poll(async () => (await cajas(page)).some((b) => b.max[0] - b.min[0] > 400)).toBe(true);
  expect(solapes(await cajas(page))).toEqual([]);
});

test('duplicar y cortar por plano no dejan piezas sobre otros objetos', async ({ page }) => {
  await abrir(page);
  await forma(page, 'Cubo', 1);
  await forma(page, 'Cilindro', 2);
  await forma(page, 'Esfera', 3);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.duplicateObjects([s.objects[0].id]);
  });
  await expect.poll(() => cuenta(page)).toBe(4);
  expect(solapes(await cajas(page))).toEqual([]);
  // Corte: el cubo se agranda junto al cilindro y se corta; ninguna mitad cae sobre los demás.
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.planeCutObject(s.objects[0].id, { axis: 'x', offset: 0, connectorType: 'none', connectorSize: 4, connectorDepth: 4, tolerance: 0.25, connectorCount: 1, keepMode: 'both' });
  });
  await expect.poll(() => cuenta(page)).toBe(5);
  expect(solapes(await cajas(page))).toEqual([]);
});
