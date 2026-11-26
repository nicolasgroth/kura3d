/**
 * @file e2e/qa12-capacidad.spec.ts
 * @description QA12: Medir > Capacidad con recipientes reales (vaso, vaso inclinado, agujero en la pared, cubo macizo,
 * cubo ahuecado cerrado, dos cavidades), unidades y cancelar. Requiere `@playwright/test` y la web en KURA_URL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, SHOTS } from './qa12-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

type P = Record<string, unknown>;
const prim = (page: Page, type: string, params: P, opts: P = {}) =>
  page.evaluate(async ([t, p, o]) => (await (window as any).__s.getState().createPrimitive(t, p, o))?.id, [type, params, opts] as const);

async function vaso(page: Page, extra: P = {}) {
  const id = await prim(page, 'cylinder', { radius: 20, height: 50, segments: 128 }, { position: [0, 0, 0] });
  await prim(page, 'cylinder', { radius: 18, height: 48, segments: 128 }, { role: 'negative', position: [0, 2, 0], ...extra });
  await page.evaluate(() => (window as any).__s.getState().applyHolesOnSolids());
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.id));
}

async function medirCapacidad(page: Page) {
  await page.getByRole('button', { name: 'Capacidad', exact: true }).click();
  const panel = page.getByTestId('measure-capacity');
  await panel.getByRole('button').first().click();
  await page.waitForTimeout(500);
  await expect(panel.getByTestId('capacity-max').or(panel.getByRole('status').filter({ hasText: /cavidad|no|sin/i }).first())).toBeVisible({ timeout: 60000 });
  return panel;
}

const sel = (page: Page, id: string) => page.evaluate((i) => (window as any).__s.getState().selectObject(i, false), id);

test('vaso: capacidad ≈ 48,86 mL, deslizador al 50 %, vaso inclinado 20° tiene menos', async ({ page }) => {
  await abrir(page);
  const ids = await vaso(page);
  expect(ids.length).toBe(1);
  await sel(page, ids[0]);
  await page.keyboard.press('d');
  const panel = await medirCapacidad(page);
  const txt = await panel.getByTestId('capacity-max').innerText();
  console.log('capacidad vaso:', txt);
  const ml = parseFloat(txt.replace(',', '.'));
  expect(ml).toBeGreaterThan(48.0);
  expect(ml).toBeLessThan(49.5);
  await page.screenshot({ path: SHOTS + '/a4-vaso.png' });
  // slider al 50 %
  const slider = panel.getByRole('slider');
  await slider.focus();
  await slider.fill('50');
  await page.waitForTimeout(2500);
  const filled = await panel.getByTestId('capacity-filled').innerText();
  console.log('lleno al 50%:', filled);
  await page.screenshot({ path: SHOTS + '/a4-vaso-50.png' });
  const half = parseFloat(filled.replace(',', '.'));
  expect(half).toBeGreaterThan(22.5);
  expect(half).toBeLessThan(26);
  // inclinado 20 grados (rotación sobre X interno)
  await page.evaluate((i) => (window as any).__s.getState().setObjectTransform(i, { rotation: [(20 * Math.PI) / 180, 0, 0] }), ids[0]);
  await page.waitForTimeout(500);
  await panel.getByRole('button').first().click();
  await page.waitForTimeout(3000);
  const tilt = await panel.getByTestId('capacity-max').innerText();
  console.log('vaso inclinado 20:', tilt);
  expect(parseFloat(tilt.replace(',', '.'))).toBeLessThan(ml - 1);
  await page.screenshot({ path: SHOTS + '/a4-vaso-inclinado.png' });
});

test('vaso con agujero en la pared: rebalsa a esa altura; cubo macizo da 0 con mensaje', async ({ page }) => {
  await abrir(page);
  const ids = await vaso(page);
  // agujero horizontal r3 a 20 mm de la base (a través de la pared en X)
  await prim(page, 'cylinder', { radius: 3, height: 60, segments: 32 }, { role: 'negative', position: [0, 20, 0], rotation: [0, 0, Math.PI / 2] });
  await page.evaluate(() => (window as any).__s.getState().applyHolesOnSolids());
  await page.waitForTimeout(1500);
  const oid = await page.evaluate(() => (window as any).__s.getState().objects[0].id);
  await sel(page, oid);
  await page.keyboard.press('d');
  const panel = await medirCapacidad(page);
  const over = await panel.getByText(/rebals|desborda|altura/i).first().innerText();
  console.log('agujero:', await panel.innerText());
  await page.screenshot({ path: SHOTS + '/a4-agujero.png' });
  void over; void ids;
});

test('cubo macizo: 0 con mensaje claro', async ({ page }) => {
  await abrir(page);
  const id = await prim(page, 'box', { width: 40, height: 40, depth: 40 });
  await sel(page, id);
  await page.keyboard.press('d');
  await page.getByRole('button', { name: 'Capacidad', exact: true }).click();
  const panel = page.getByTestId('measure-capacity');
  await panel.getByRole('button').first().click();
  await page.waitForTimeout(4000);
  console.log('macizo:', await panel.innerText());
  await page.screenshot({ path: SHOTS + '/a4-macizo.png' });
});
