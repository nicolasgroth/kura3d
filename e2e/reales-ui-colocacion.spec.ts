/**
 * @file e2e/reales-ui-colocacion.spec.ts
 * @description Colocación y cámara con modelos importados (STL sintéticos): tras importar un modelo
 * grande descentrado y un conjunto que excede la cama, la cámara encuadra SIEMPRE todo lo importado
 * (`fit` con sus ids, también con la escena no vacía), y un cubo creado después cae en un hueco libre
 * al costado (X), no delante del modelo, sin solapar nada.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-colocacion`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, cajas, importarStl, solapes, stlCubes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/reales-ui';
const cuenta = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.length);
const pedidoCamara = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  return { preset: s.cameraRequest?.preset, ids: [...(s.cameraRequest?.ids ?? [])].sort(), objects: s.objects.map((o: any) => o.id) };
});

test('importar grande descentrado y un conjunto mayor que la cama encuadra lo importado; el cubo cae al costado', async ({ page }) => {
  test.setTimeout(180_000);
  await abrir(page);
  // Modelo grande y descentrado (internamente X derecha, Y arriba, Z frente).
  await importarStl(page, 'descentrado.stl', stlCubes([[400, 60, 250]], 120));
  await expect.poll(() => cuenta(page), { timeout: 30000 }).toBe(1);
  const first = await pedidoCamara(page);
  expect(first.preset).toBe('fit');
  expect(first.ids).toEqual(first.objects);

  // Conjunto que excede la cama (4 cuerpos a lo ancho de 700 mm), con la escena ya ocupada.
  await importarStl(page, 'conjunto.stl', stlCubes([[-350, 20, 0], [-120, 20, 0], [120, 20, 0], [350, 20, 0]], 40));
  await expect.poll(() => cuenta(page), { timeout: 30000 }).toBeGreaterThan(1);
  const second = await pedidoCamara(page);
  expect(second.preset).toBe('fit');
  const nuevos = second.objects.filter((id: string) => !first.objects.includes(id)).sort();
  expect(second.ids).toEqual(nuevos);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/colocacion-conjunto.png` });

  const antes = await cuenta(page);
  await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
  await expect.poll(() => cuenta(page)).toBe(antes + 1);
  expect(solapes(await cajas(page))).toEqual([]);
});

test('con un modelo importado en el centro, el cubo nuevo va al costado y no delante', async ({ page }) => {
  await abrir(page);
  // Más ancho (X) que profundo (Z): antes el hueco más cercano era el frente, que tapa al modelo.
  await importarStl(page, 'ancho.stl', stlCubes([[-30, 60, 0], [30, 60, 0]], 60));
  await expect.poll(() => cuenta(page), { timeout: 30000 }).toBe(1);
  await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
  await expect.poll(() => cuenta(page)).toBe(2);
  const [modelo, cubo] = await cajas(page);
  expect(solapes([modelo, cubo])).toEqual([]);
  // Al costado en X (derecha o izquierda), no en el frente (+Z) ni detrás.
  const alCostado = cubo.min[0] >= modelo.max[0] - 0.01 || cubo.max[0] <= modelo.min[0] + 0.01;
  expect(alCostado).toBe(true);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/colocacion-cubo-costado.png` });
});
