/**
 * @file e2e/docs/capturas-importar.spec.ts
 * @description Capturas de la guía «Importar y reparar»: menú de importación, aviso de unidades dudosas,
 * aviso de malla abierta y resultado de Reparar malla. Archivos de ejemplo generados en memoria.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, encuadrar, importarArchivo, sinAvisos, stlCubos } from './helpers';

test('importar-y-reparar', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Opciones de importación' }).click();
  await page.waitForTimeout(300);
  await captura(page, 'importar-y-reparar-01-menu', { x: 0, y: 0, width: 640, height: 400 });
  await page.keyboard.press('Escape');
  // Unidades dudosas: un cubo de 0,9 mm de lado.
  await importarArchivo(page, 'pieza-diminuta.stl', stlCubos([[0, 0, 0]], 0.9));
  await expect(page.getByText(/mide 0,9 mm en su lado mayor/).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.mouse.move(720, 890);
  await page.screenshot({ path: 'docs/guia/img/importar-y-reparar-02-unidades.png' });
  // «Otra unidad…»: diálogo con todas las opciones; se aplica la primera (×100).
  await page.getByRole('button', { name: 'Otra unidad…' }).first().click();
  const dialogo = page.getByRole('dialog', { name: '¿En qué unidad está este modelo?' });
  await expect(dialogo).toBeVisible();
  await page.waitForTimeout(400);
  await captura(page, 'importar-y-reparar-05-otra-unidad', dialogo);
  await page.getByTestId('unit-apply').click();
  await page.waitForTimeout(800);
  // Malla abierta: cubo sin una cara.
  await page.evaluate(() => (window as any).__s.setState({ objects: [], selectedIds: [] }));
  await importarArchivo(page, 'cubo-con-agujero.stl', stlCubos([[0, 15, 0]], 30, true));
  await page.waitForTimeout(2500);
  await encuadrar(page, 'fit');
  await page.mouse.move(720, 890);
  await page.screenshot({ path: 'docs/guia/img/importar-y-reparar-03-malla-abierta.png' });
  await sinAvisos(page);
  await page.getByRole('button', { name: /Reparar malla/ }).first().click();
  // Un solo mensaje a la vista: tras «Malla reparada» llega la nota del agujero grande y el resumen queda en el histórico.
  await expect(page.locator('.kura-toast', { hasText: /Malla reparada|Se cerró 1 agujero/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
  await page.mouse.move(720, 890);
  await page.screenshot({ path: 'docs/guia/img/importar-y-reparar-04-reparada.png' });
});
