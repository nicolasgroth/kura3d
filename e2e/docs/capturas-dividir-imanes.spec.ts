/**
 * @file e2e/docs/capturas-dividir-imanes.spec.ts
 * @description Captura de la guía «Dividir para imprimir», sección «Unión con imanes»: el panel con el tipo de unión
 * «Imanes (desmontable)» elegido sobre una pieza creada en la propia app (nunca modelos de terceros). Se corre con
 * `npm run docs:capturas -- -g imanes`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { itemAccion } from '../acciones-helpers';
import { abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('dividir-para-imprimir con imanes', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'box', width: 300, height: 120, depth: 120, name: 'Figura', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [pieza.id]);
  // Desde Acciones: con el atajo Mayús+C la «C» caía en el primer campo del panel.
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.getByLabel('Tipo de conector', { exact: true }).selectOption('magnet');
  await expect(page.getByTestId('split-magnet-options')).toBeVisible();
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId('split-magnet-options').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await captura(page, 'dividir-para-imprimir-03-imanes');
});

test('dividir-para-imprimir: firmeza de las uniones', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'box', width: 300, height: 120, depth: 120, name: 'Figura', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [pieza.id]);
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  const firmeza = page.getByTestId('split-firmness');
  await expect(firmeza).toBeVisible({ timeout: 60_000 });
  await firmeza.locator('summary').first().click();
  await firmeza.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await captura(page, 'dividir-para-imprimir-04-firmeza');
});
