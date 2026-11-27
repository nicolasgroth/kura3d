/**
 * @file e2e/ux3-forma-avisos.spec.ts
 * @description Emergentes: uno solo a la vista (el más reciente), los informativos pasan solos al histórico (~6 s) y se
 * pausan con el cursor, los de error esperan al usuario y uno idéntico reemplaza al anterior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

test('emergente único: caduca solo a los 6 s, pausa con el cursor, errores persisten', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  const toasts = page.locator('.kura-toast');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    for (let i = 1; i <= 5; i += 1) s.addToast(`Aviso informativo ${i}`, 'info');
  });
  await expect(toasts).toHaveCount(1);
  await expect(page.getByText('Aviso informativo 5')).toBeVisible();
  await expect(page.getByText('Aviso informativo 1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Cerrar todos|avisos más/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/avisos-tres.png` });
  // Un aviso idéntico reemplaza al anterior.
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso informativo 5', 'info'));
  await expect(page.getByText('Aviso informativo 5', { exact: true })).toHaveCount(1);
  // Pausa con el cursor: pasan 7 s (más que los 6 s de cierre) y sigue ahí.
  await toasts.getByRole('button', { name: 'Cerrar' }).click();
  await expect(toasts).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso con pausa', 'info'));
  await page.getByText('Aviso con pausa', { exact: true }).hover();
  await page.waitForTimeout(7000);
  await expect(page.getByText('Aviso con pausa', { exact: true })).toBeVisible();
  // Al quitar el cursor se va solo.
  await page.mouse.move(5, 5);
  await expect(toasts).toHaveCount(0, { timeout: 12000 });
  // Los errores permanecen hasta cerrarlos; uno informativo posterior lo reemplaza a la vista pero no lo borra.
  await page.evaluate(() => (window as any).__s.getState().addToast('Algo falló', 'error'));
  await page.waitForTimeout(7000);
  await expect(page.getByText('Algo falló')).toBeVisible();
  await page.evaluate(() => (window as any).__s.getState().addToast('Otro dato', 'info'));
  await expect(page.getByText('Algo falló')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '1 error' })).toBeVisible();
});
