/**
 * @file e2e/docs/capturas-dividir-partes.spec.ts
 * @description Captura de la guía «Dividir para imprimir», sección «Por las partes de la figura»: el panel con
 * «Cómo cortar» en esa opción, su resumen y el plano en el cuello de una pesa creada en la propia app.
 * Se corre con `npm run docs:capturas -- -g "partes de la figura"`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { itemAccion } from '../acciones-helpers';
import { abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('dividir-para-imprimir: partes de la figura', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page);
  // Las primitivas nacen apoyadas: `position` va en ejes del usuario (Z arriba) y es la base. Esfera 0–120, cuello 105–145 y cabeza 135–185.
  const big = await cmd(page, 'create_primitive', { type: 'sphere', radius: 60, segments: 64, name: 'Figura', position: [0, 0, 0] });
  const neck = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 8, height: 40, segments: 48, position: [0, 0, 105] });
  const head = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, segments: 64, position: [0, 0, 135] });
  const union = await cmd(page, 'boolean_operation', { op: 'union', targetId: big.id, toolIds: [neck.id, head.id] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [union.resultId]);
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  for (const [label, v] of [['Ancho X (mm)', '200'], ['Fondo Y (mm)', '200'], ['Alto Z (mm)', '160']] as const) {
    const field = page.getByLabel(label, { exact: true });
    await field.fill(v);
    await field.press('Enter');
  }
  const acostar = page.getByRole('checkbox', { name: 'Permitir acostar piezas' });
  if (await acostar.isChecked()) await acostar.uncheck();
  await page.getByLabel('Cómo cortar').selectOption('natural');
  await expect(page.getByTestId('split-natural-summary')).toHaveText(/Cortes en partes de la figura: 1/, { timeout: 60_000 });
  await page.getByLabel('Cómo cortar').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await captura(page, 'dividir-para-imprimir-07-partes');
});
