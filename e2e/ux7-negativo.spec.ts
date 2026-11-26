/**
 * @file e2e/ux7-negativo.spec.ts
 * @description Negativo nuevo con un sólido seleccionado: la pieza creada como sólido cae en un hueco libre
 * (no encima de otro objeto), pero al pasarla a Negativo sin moverla va SOBRE el sólido que estaba
 * seleccionado, lista para «Aplicar resta». Sin selección, pasar a Negativo no la mueve.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/ux7-negativo.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, cajas, solapes } from './ux-escena-helpers';
import { SHOTS } from './ux7-helpers';
import { agregarForma } from './agregar-helpers';

test('con un sólido seleccionado, el negativo nuevo queda sobre él', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { name: 'Base', placement: 'free' });
  });
  // Con «Base» seleccionada se crea un cilindro desde Formas: como sólido cae al lado, sin solaparse.
  await agregarForma(page, /^Cilindro/);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  expect(solapes(await cajas(page))).toEqual([]);
  // Pasarlo a Negativo lo lleva sobre «Base».
  await page.getByRole('button', { name: 'Negativo', exact: true }).first().click();
  await expect.poll(async () => solapes(await cajas(page)).length).toBe(1);
  await expect(page.getByRole('button', { name: /Aplicar 1 resta/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/negativo-sobre-1440.png` });
});

test('sin selección, pasar a Negativo no mueve la pieza', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, { name: 'Base', placement: 'free' });
    s.setSelection([]);
  });
  await agregarForma(page, /^Cilindro/);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  const antes = await page.evaluate(() => (window as any).__s.getState().objects[1].position);
  await page.getByRole('button', { name: 'Negativo', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects[1].role)).toBe('negative');
  expect(await page.evaluate(() => (window as any).__s.getState().objects[1].position)).toEqual(antes);
  expect(solapes(await cajas(page))).toEqual([]);
});
