/**
 * @file e2e/docs/capturas-orientar.spec.ts
 * @description Capturas de la guía «Orientar para imprimir»: una «T» de pie hecha con dos cajas unidas, la lista
 * de orientaciones con la actual en foco (sus zonas en voladizo en naranja) y tras aplicar la recomendada la pieza
 * acostada, con «Actual» marcada y el resumen «ya es la mejor». Piezas generadas en la propia app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';
import { itemAccion } from '../acciones-helpers';

test('orientar', async ({ page }) => {
  await abrir(page);
  const tallo = await cmd(page, 'create_primitive', { type: 'box', width: 10, depth: 10, height: 40, name: 'Tallo', placement: 'free', position: [0, 0, 20], color: '#38bdf8' });
  const barra = await cmd(page, 'create_primitive', { type: 'box', width: 60, depth: 10, height: 10, name: 'Travesaño', placement: 'free', position: [0, 0, 45], color: '#38bdf8' });
  const te = await cmd(page, 'boolean_operation', { op: 'union', target: tallo.id, tools: [barra.id] });
  await seleccionar(page, [te.resultId]);
  await encuadrar(page, 'iso');
  await sinAvisos(page);

  await (await itemAccion(page, 'Orientar para imprimir…')).click();
  const panel = page.locator('#kura-inspector-panel');
  await expect(panel.getByTestId('orient-options')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId('orient-badge-recommended')).toBeVisible();
  // La actual en foco: el visor resalta en naranja lo que hoy necesitaría soporte.
  await panel.getByRole('option').filter({ has: page.getByTestId('orient-badge-current') }).hover();
  await expect(panel.getByTestId('orient-legend')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'docs/guia/img/orientar-01-lista.png' });

  // La recomendada (primera de la lista) se aplica con el botón.
  await panel.getByRole('option').first().click();
  await panel.getByTestId('orient-apply').click();
  await expect(panel.getByTestId('orient-summary')).toContainText('ya es la mejor', { timeout: 60_000 });
  await encuadrar(page, 'iso');
  await sinAvisos(page);
  await page.mouse.move(700, 880);
  await page.screenshot({ path: 'docs/guia/img/orientar-02-aplicada.png' });
});
