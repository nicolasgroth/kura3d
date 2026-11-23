/**
 * @file e2e/docs/capturas-ajustar.spec.ts
 * @description Capturas de la guía «Ajustar a la impresora»: pieza fuera de volumen con el botón del
 * aviso, diálogo con las alternativas y la vista previa, y el editor de «Mis camas». Escena hecha con
 * primitivas de la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('ajustar-a-la-impresora', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kura3d-printer-id', 'elegoo-centauri-carbon-2'));
  await abrir(page);
  const a = await cmd(page, 'create_primitive', { type: 'box', width: 320, height: 60, depth: 90, name: 'Repisa' });
  await seleccionar(page, [a.id]);
  await encuadrar(page, 'scene');
  await expect(page.getByTestId('oob-fit')).toBeVisible();
  await captura(page, 'ajustar-a-la-impresora-01-fuera');

  await page.getByTestId('oob-fit').click();
  const dialog = page.getByRole('dialog', { name: 'Ajustar a la impresora' });
  await expect(dialog.getByTestId('fit-alt-scale')).toBeVisible();
  await dialog.getByTestId('fit-alt-scale').click();
  await page.waitForTimeout(800);
  await captura(page, 'ajustar-a-la-impresora-02-alternativas');

  await dialog.getByTestId('fit-bed-edit').click();
  await dialog.getByTestId('bed-new').click();
  await dialog.getByTestId('bed-name').fill('Mi impresora');
  await page.waitForTimeout(300);
  await captura(page, 'ajustar-a-la-impresora-03-mis-camas', dialog);
  await page.keyboard.press('Escape');
});
