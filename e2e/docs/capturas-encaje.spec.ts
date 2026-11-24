/**
 * @file e2e/docs/capturas-encaje.spec.ts
 * @description Capturas de la guía «Comprobar encaje»: una caja con un bolsillo negativo y una placa de
 * referencia que no cabe (choque resaltado en rojo y el panel con la recomendación), y tras agrandar el
 * bolsillo el par «Bien» con su cota de holgura en el visor. Piezas generadas en la propia app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, cmd, sinAvisos } from './helpers';
import { itemAccion } from '../acciones-helpers';

test('encaje', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 20, name: 'Caja', placement: 'free', position: [0, 0, 0], color: '#38bdf8' });
  const bolsillo = await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Bolsillo', role: 'negative', placement: 'free', position: [0, 0, 12] });
  await cmd(page, 'create_primitive', { type: 'box', width: 22, depth: 22, height: 4, name: 'Placa', role: 'reference', placement: 'free', position: [0, 0, 14], color: '#22c55e' });
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: [] }));
  await sinAvisos(page);

  await (await itemAccion(page, 'Comprobar encaje…')).click();
  const panel = page.locator('#kura-inspector-panel');
  await panel.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(panel.getByTestId('fit-check-result')).toBeVisible({ timeout: 60_000 });
  await panel.getByRole('option').first().click();
  await page.waitForTimeout(1200);
  await page.mouse.move(700, 880);
  await page.screenshot({ path: 'docs/guia/img/comprobar-encaje-01-choque.png' });

  await cmd(page, 'update_primitive_params', { id: bolsillo.id, params: { width: 24, depth: 24 } });
  await panel.getByRole('button', { name: 'Volver a comprobar' }).click();
  await expect(panel.getByTestId('fit-check-clean')).toBeVisible({ timeout: 60_000 });
  await panel.getByRole('option').first().click();
  await expect(page.getByTestId('fit-check-gap-label')).toBeVisible();
  // Sin selección (el bolsillo editado quedaba seleccionado con su manipulador encima de la cota).
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: [] }));
  await sinAvisos(page);
  await page.waitForTimeout(1200);
  await page.mouse.move(700, 880);
  await page.screenshot({ path: 'docs/guia/img/comprobar-encaje-02-holgura.png' });
});
