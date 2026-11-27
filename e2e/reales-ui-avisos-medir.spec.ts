/**
 * @file e2e/reales-ui-avisos-medir.spec.ts
 * @description El panel del centro de mensajes se cierra al hacer clic en el visor (fuera) y al elegir una
 * acción; con Medir activo, un clic en el vacío muestra una sola pista junto al cursor ("Toca un
 * punto de la pieza") que no se apila. Ejecuta con
 * `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-avisos-medir`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/reales-ui';

test('el panel del centro de mensajes se cierra con un clic en el visor y al vaciarlo', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso de prueba', 'info'));
  const button = page.getByRole('button', { name: '1 mensaje informativo' });
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const canvas = page.locator('canvas').first();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  // Vaciar el tipo quita sus mensajes: el panel se cierra y el icono desaparece.
  await page.evaluate(() => (window as any).__s.getState().addToast('Otro aviso', 'info'));
  const dos = page.getByRole('button', { name: '2 mensajes informativos' });
  await dos.click();
  await page.getByRole('dialog', { name: 'Información' }).getByRole('button', { name: /Vaciar/ }).click();
  await expect(page.getByRole('dialog', { name: 'Información' })).toHaveCount(0);
  await expect(dos).toHaveCount(0);
});

test('Medir: un clic en el vacío muestra una pista breve junto al cursor, sin apilar', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
  const canvas = page.locator('canvas').first();
  const box = (await canvas.boundingBox())!;
  const hint = page.getByTestId('measure-miss-hint');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
  await expect(hint).toBeVisible();
  // Con ratón la pista dice «Haz clic…» (con táctil, «Toca…»: ver e2e/ux6-medir.spec.ts).
  await expect(hint).toHaveText('Haz clic en un punto de la pieza');
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.25);
  await expect(page.getByTestId('measure-miss-hint')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/medir-pista.png` });
  await expect(hint).toBeHidden({ timeout: 4000 });
  // Un arrastre (girar la vista) no muestra la pista.
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 360, box.y + 240, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await expect(hint).toBeHidden();
});
