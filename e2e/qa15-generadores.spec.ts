/**
 * @file e2e/qa15-generadores.spec.ts
 * @description QA de generadores nunca revisados: errores dentro del diálogo SVG, validación en línea de la
 * rosca ISO, proyección doble en el mismo lugar (fallo conocido, ver informe qa15) y deshacer en un paso del
 * hueco. Sin fixtures: todo se genera en línea. Requiere la web en KURA_URL (por defecto http://127.0.0.1:5189).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { agregarForma } from './agregar-helpers';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 900 } });

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5189/';

test('SVG solo de líneas: el error sale dentro del diálogo y no crea objetos', async ({ page }) => {
  await page.goto(URL);
  await page.locator('button.kura-btn[title*="SVG"]').click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('textarea').fill(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><line x1="0" y1="0" x2="100" y2="100" stroke="black" fill="none"/></svg>',
  );
  await dlg.getByRole('button', { name: /Extrude SVG/ }).click();
  await expect(dlg).toContainText(/unfilled lines/);
  await expect(page.locator('footer')).toContainText('0 objs');
});

test('rosca ISO: valores fuera de rango deshabilitan Crear con mensaje de rango', async ({ page }) => {
  await page.goto(URL);
  await page.locator('button[title*="metric ISO bolt"]').click();
  const dlg = page.getByRole('dialog');
  const create = dlg.getByRole('button', { name: /Create ISO Thread/ });
  const fields = dlg.locator('input[type=text]');
  await fields.nth(0).fill('70');
  await fields.nth(0).press('Tab');
  await expect(create).toBeDisabled();
  await expect(dlg).toContainText(/Allowed: 3–64/);
  await fields.nth(0).fill('8');
  await fields.nth(0).press('Tab');
  await expect(create).toBeEnabled();
});

test('hueco de una caja 30 mm: volumen = 30³ − 25,6³ y deshacer lo revierte en un paso', async ({ page }) => {
  await page.goto(URL);
  await agregarForma(page, 'Box');
  const ins = page.locator('[aria-label="Inspector"]');
  const vol = async () => ((await ins.innerText()).match(/VOLUME\n([^\n]*)/) ?? [])[1];
  await expect.poll(vol).toBe('27,000 mm³');
  const apply = ins.getByRole('button', { name: 'Apply hollowing' });
  await apply.scrollIntoViewIfNeeded();
  await apply.click();
  await expect.poll(vol, { timeout: 15000 }).toBe('10,222.8 mm³');
  await page.keyboard.press('Control+z');
  await expect.poll(vol).toBe('27,000 mm³');
});

// qa15: proyectar dos veces el mismo texto de 20 mm sobre la cara +Z daba "open mesh" en el segundo
// intento (paredes coincidentes). El motor reintenta con el gráfico girado una fracción ínfima.
test('proyectar dos veces el mismo texto en el mismo lugar no debe fallar', async ({ page }) => {
  await page.goto(URL);
  await agregarForma(page, 'Box');
  const ins = page.locator('[aria-label="Inspector"]');
  for (let i = 0; i < 2; i++) {
    const open = ins.getByRole('button', { name: /Project Text\/SVG/ });
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('select').nth(1).selectOption({ label: 'Positive Emboss (+)' });
    await dlg.locator('select').nth(2).selectOption({ label: '+Z (Top)' });
    await dlg.locator('#proj-width').fill('20');
    await dlg.locator('#proj-depth').fill('1.2');
    await dlg.locator('#proj-u').fill('0');
    await dlg.locator('#proj-v').fill('0');
    await dlg.locator('#proj-v').press('Tab');
    await dlg.getByRole('button', { name: /Project onto Model/ }).click();
    await expect(dlg).toBeHidden({ timeout: 10000 });
  }
});
