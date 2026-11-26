/**
 * @file e2e/usab-n26b.spec.ts
 * @description Correcciones de usabilidad del 26-nov: Medir sin puntos sale con un solo Esc (también con el tooltip del
 * botón abierto) y devuelve el foco al riel; renombrar una placa con un nombre ya usado se rechaza con aviso.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const foco = (page: Page) => page.evaluate(() => { const e = document.activeElement as HTMLElement; return `${e?.tagName}|${e?.getAttribute('aria-label') ?? ''}|${(e?.innerText ?? '').slice(0, 40)}`; });
test.use({ viewport: { width: 1440, height: 900 } });
test('Medir sin puntos: un Esc sale', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
  await page.locator('#kura-tool-rail').getByRole('button', { name: /Medir/ }).first().click();
  await expect.poll(() => S(page, (s) => s.activeTool)).toBe('measure');
  console.log('USAB26B medir foco al abrir', await foco(page));
  await page.keyboard.press('Escape');
  console.log('USAB26B medir tras 1 Esc', await S(page, (s) => s.activeTool), await foco(page));
  expect(await S(page, (s) => s.activeTool)).toBe('select');
  expect((await foco(page)).startsWith('BODY')).toBe(false);
});
test('Medir con el puntero sobre el botón (tooltip abierto): un Esc sale', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
  const b = page.locator('#kura-tool-rail').getByRole('button', { name: /Medir/ }).first();
  await b.hover(); await page.waitForTimeout(900); await b.click(); await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  console.log('USAB26B medir hover tras 1 Esc', await S(page, (s) => s.activeTool));
  expect(await S(page, (s) => s.activeTool)).toBe('select');
});
test('renombrar placa con nombre repetido se rechaza', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
  await S(page, (s) => s.createPlate()); await S(page, (s) => s.createPlate());
  const nombres0 = await S(page, (s) => s.plates.map((p: any) => p.name));
  await page.keyboard.press('F2').catch(() => undefined);
  const tira = page.getByRole('region', { name: 'Placas de impresión' });
  await tira.locator('.kura-plate-chip').last().locator('button').first().dblclick();
  const campo = tira.locator('input').first();
  await campo.fill(nombres0[0]); await campo.press('Enter');
  await page.waitForTimeout(400);
  console.log('USAB26B placas', JSON.stringify(nombres0), '->', JSON.stringify(await S(page, (s) => s.plates.map((p: any) => p.name))), 'alerta:', await tira.getByRole('alert').allInnerTexts());
  const n = await S(page, (s) => s.plates.map((p: any) => p.name));
  expect(new Set(n).size).toBe(n.length);
});
