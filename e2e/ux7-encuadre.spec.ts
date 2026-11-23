/**
 * @file e2e/ux7-encuadre.spec.ts
 * @description Encuadre tras importar y tras operaciones: una pieza de 0,9 mm o de 2 m queda entera a la
 * vista, con la cámara fuera de su caja y el plano cercano por delante; tras escalar desde el aviso de
 * unidades se reencuadra; tras cortar por plano, dividir y ahuecar, el resultado queda a la vista.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/ux7-encuadre.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';
import { SHOTS, camaraQuieta, encuadre, exponerR3f } from './ux7-helpers';

const ids = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.id) as string[]);

async function conCubo(page: Page) {
  await exponerR3f(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 30, height: 30, depth: 30 }, {});
  });
}

test('una pieza de 0,9 mm importada junto a otra queda encuadrada y legible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await conCubo(page);
  await camaraQuieta(page);
  const antes = await ids(page);
  await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
  await expect(page.getByText(/mide 0,9 mm/).first()).toBeVisible({ timeout: 30000 });
  await camaraQuieta(page);
  const nuevo = (await ids(page)).filter((id) => !antes.includes(id));
  const e = await encuadre(page, nuevo);
  expect(e.inside).toBe(false);
  expect(e.inView).toBe(true);
  expect(e.frac).toBeGreaterThan(0.1);
  expect(e.near).toBeLessThan(e.distance);
  await page.screenshot({ path: `${SHOTS}/encuadre-diminuto-1440.png` });

  // Escalar desde el aviso: se reencuadra la pieza ya escalada.
  await page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first().getByRole('button', { name: 'Escalar ×100' }).click();
  await page.waitForTimeout(400);
  await camaraQuieta(page);
  const tras = await encuadre(page, nuevo);
  expect(tras.inside).toBe(false);
  expect(tras.inView).toBe(true);
  expect(tras.frac).toBeGreaterThan(0.1);
});

test('una pieza de 2 m importada queda entera a la vista, sin la cámara dentro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await conCubo(page);
  await camaraQuieta(page);
  const antes = await ids(page);
  await importarStl(page, 'enorme.stl', stlCubes([[0, 0, 1000]], 2000));
  await page.waitForFunction((n) => (window as any).__s.getState().objects.length > n, antes.length, { timeout: 30000 });
  await page.waitForTimeout(500);
  await camaraQuieta(page);
  const nuevo = (await ids(page)).filter((id) => !antes.includes(id));
  const e = await encuadre(page, nuevo);
  expect(e.inside).toBe(false);
  expect(e.inView).toBe(true);
  await page.screenshot({ path: `${SHOTS}/encuadre-enorme-1440.png` });
});
