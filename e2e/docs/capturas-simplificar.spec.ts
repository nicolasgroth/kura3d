/**
 * @file e2e/docs/capturas-simplificar.spec.ts
 * @description Capturas de la sección «Simplificar» de la guía «Importar y reparar»: el panel abierto desde el botón
 * «Simplificar…» del inspector con los tres grupos y los modos, el informe del resultado con «Deshacer» y el caso
 * bloqueado por destructivo (placa con tres agujeros). La esfera de 64 segmentos (una esfera de 512 triángulos al
 * 50 % ya se bloquea: cambia el volumen 5,4 %) y la placa salen de la propia app (nunca modelos de terceros).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

test('simplificar', async ({ page }) => {
  await abrir(page);
  const esfera = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, segments: 64, name: 'Esfera', position: [0, 0, 0], color: '#38bdf8' });
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
  await expect(page.getByTestId('simplify-blocked')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
  await sinAvisos(page);
  await page.getByTestId('simplify-report').scrollIntoViewIfNeeded();
  await page.mouse.move(700, 120);
  await page.waitForTimeout(500);
  await captura(page, 'importar-y-reparar-07-simplificar-informe');
});

test('simplificar: resultado destructivo bloqueado', async ({ page }) => {
  await abrir(page);
  const placa = await cmd(page, 'create_primitive', { type: 'box', width: 60, depth: 40, height: 3, name: 'Placa', color: '#38bdf8' });
  const taladros: string[] = [];
  for (const x of [-18, 0, 18]) taladros.push((await cmd(page, 'create_primitive', { type: 'cylinder', radius: 4, height: 10, name: `T${x}`, position: [x, 1.5, 0] })).id);
  await cmd(page, 'boolean_operation', { op: 'subtract', targetId: placa.id, toolIds: taladros });
  await encuadrar(page, 'scene');
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await seleccionar(page, [id]);
  await page.getByTestId('simplify-entry').click();
  const seccion = page.locator('.kura-simplify-section');
  await expect(seccion).toBeVisible();
  await seccion.locator('select').first().selectOption('target');
  await seccion.getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
  const campo = seccion.getByRole('spinbutton', { name: /Triángulos finales/ });
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  // Desde la tanda de la noche del 26-nov se aplica la versión segura sola, con aviso y «Aplicar de todos modos».
  await expect(page.getByTestId('simplify-safe-applied')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
  await sinAvisos(page);
  await page.getByTestId('simplify-apply-anyway').scrollIntoViewIfNeeded();
  await page.mouse.move(700, 120);
  await page.waitForTimeout(500);
  await captura(page, 'importar-y-reparar-08-simplificar-bloqueo');
});

test('simplificar: vista previa con fantasma', async ({ page }) => {
  await abrir(page);
  const esfera = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, segments: 64, name: 'Esfera', position: [0, 0, 0], color: '#38bdf8' });
  await encuadrar(page, 'scene');
  await seleccionar(page, [esfera.id]);
  await page.getByTestId('simplify-entry').click();
  const seccion = page.locator('.kura-simplify-section');
  await expect(seccion).toBeVisible();
  await seccion.locator('select').first().selectOption('target');
  const campo = seccion.getByRole('spinbutton').first();
  await campo.fill('80');
  await campo.blur();
  await page.getByTestId('simplify-preview').click();
  await expect(page.getByTestId('simplify-ghost-controls')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
  await sinAvisos(page);
  await page.mouse.move(700, 120);
  await page.waitForTimeout(700);
  await captura(page, 'importar-y-reparar-09-simplificar-vista-previa');
});
