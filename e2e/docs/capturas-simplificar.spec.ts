/**
 * @file e2e/docs/capturas-simplificar.spec.ts
 * @description Capturas de la sección «Simplificar» de la guía «Importar y reparar»: el panel abierto desde el botón
 * «Simplificar…» del inspector con los tres grupos y los modos, y el informe del resultado con «Deshacer». La esfera
 * sale de la propia app (nunca modelos de terceros).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

test('simplificar', async ({ page }) => {
  await abrir(page);
  const esfera = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera', position: [0, 0, 0], color: '#38bdf8' });
  await encuadrar(page, 'scene');
  await seleccionar(page, [esfera.id]);

  // 1) Panel desde el botón «Simplificar…» del inspector, en el modo «Por cantidad» al 50 %.
  await page.getByTestId('simplify-entry').click();
  const seccion = page.locator('.kura-simplify-section');
  await expect(seccion).toBeVisible();
  await seccion.locator('select').first().selectOption('target');
  const kind = seccion.locator('select').nth(1);
  if (await kind.count()) await kind.selectOption('percent');
  const campo = seccion.getByRole('spinbutton').first();
  await campo.fill('50');
  await campo.blur();
  await sinAvisos(page);
  await page.mouse.move(700, 120);
  await page.waitForTimeout(500);
  await captura(page, 'importar-y-reparar-06-simplificar-panel');

  // 2) Resultado: el informe con las cifras y «Deshacer».
  await seccion.getByRole('button', { name: /^Simplificar/ }).click();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
  await sinAvisos(page);
  await page.getByTestId('simplify-report').scrollIntoViewIfNeeded();
  await page.mouse.move(700, 120);
  await page.waitForTimeout(500);
  await captura(page, 'importar-y-reparar-07-simplificar-informe');
});
