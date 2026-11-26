/**
 * @file e2e/docs/capturas-tapa-roscada.spec.ts
 * @description Capturas de la guía «Recipiente con tapa roscada» (ESCRITO SIN EJECUTAR): la tarjeta en la galería de
 * Asistentes, el formulario con la vista previa y «Enrosca: holgura mínima…», la página «Rosca» con holgura 0 y su
 * aviso, las dos piezas creadas en el visor y la opción «Crear la pareja que enrosca» del diálogo de roscas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, encuadrar, sinAvisos } from './helpers';

test('tapa roscada', async ({ page }) => {
  await abrir(page);
  // 1) Galería: la tarjeta del recipiente con su miniatura.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  const tarjeta = page.locator('.kura-asis-card[data-recipe="kura.tapa-roscada"]');
  await expect(tarjeta.locator('svg.kura-asis-thumb')).toHaveCount(1, { timeout: 60_000 });
  await sinAvisos(page);
  await page.mouse.move(700, 880);
  await captura(page, 'tapa-roscada-01-galeria');
  // 2) Formulario con la vista previa y el resultado del enroscado.
  await tarjeta.click();
  await expect(page.locator('.kura-asis-screwfit')).toContainText(/Enrosca: holgura mínima/, { timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.mouse.move(700, 880);
  await captura(page, 'tapa-roscada-02-formulario');
  // 3) Holgura 0: el aviso antes de crear.
  const holgura = page.getByLabel('Holgura radial', { exact: true });
  const juego = page.getByLabel('Juego axial', { exact: true });
  await holgura.fill('0');
  await holgura.press('Tab');
  await juego.fill('0');
  await juego.press('Tab');
  await expect(page.locator('.kura-asis-screwfit')).toHaveAttribute('data-status', /tight|interference/, { timeout: 60_000 });
  await holgura.scrollIntoViewIfNeeded();
  await captura(page, 'tapa-roscada-03-sin-holgura');
  await holgura.fill('0.3');
  await holgura.press('Tab');
  await juego.fill('0.45');
  await juego.press('Tab');
  await expect(page.locator('.kura-asis-screwfit')).toHaveAttribute('data-status', 'ok', { timeout: 60_000 });
  // 4) Crear: recipiente y tapa (boca arriba) lado a lado.
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeHidden();
  await encuadrar(page, 'iso');
  await sinAvisos(page);
  await page.waitForTimeout(600);
  await captura(page, 'tapa-roscada-04-piezas');
  // 5) Diálogo de roscas con la pareja que enrosca.
  await page.evaluate(() => (window as any).__s.setState({ activeDialog: 'thread' }));
  await page.getByRole('checkbox', { name: 'Crear la pareja que enrosca' }).check();
  await page.mouse.move(700, 880);
  await captura(page, 'tapa-roscada-05-pareja');
});
