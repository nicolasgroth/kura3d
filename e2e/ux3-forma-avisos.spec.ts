/**
 * @file e2e/ux3-forma-avisos.spec.ts
 * @description Avisos: máximo 3 visibles, los informativos se van solos (~4 s) y se pausan con el cursor, los de error
 * esperan al usuario, uno idéntico reemplaza al anterior, «Cerrar todos» aparece con más de uno.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

test('avisos: máximo 3, caducan solos, pausan con el cursor, errores persisten, cerrar todos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  const toasts = page.locator('.kura-toast');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    for (let i = 1; i <= 5; i += 1) s.addToast(`Aviso informativo ${i}`, 'info');
  });
  await expect(toasts).toHaveCount(3);
  await expect(page.getByText('Aviso informativo 5')).toBeVisible();
  await expect(page.getByText('Aviso informativo 1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar todos los avisos' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/avisos-tres.png` });
  // Un aviso idéntico reemplaza al anterior.
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso informativo 5', 'info'));
  await expect(page.getByText('Aviso informativo 5', { exact: true })).toHaveCount(1);
  // Pausa con el cursor (un solo aviso, para que la pila no se mueva bajo el cursor): pasan 6 s y sigue ahí.
  await page.getByRole('button', { name: 'Cerrar todos los avisos' }).click();
  await expect(toasts).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso con pausa', 'info'));
  await page.getByText('Aviso con pausa', { exact: true }).hover();
  await page.waitForTimeout(6000);
  await expect(page.getByText('Aviso con pausa', { exact: true })).toBeVisible();
  // Al quitar el cursor se va solo.
  await page.mouse.move(5, 5);
  await expect(toasts).toHaveCount(0, { timeout: 12000 });
  // Los errores permanecen hasta cerrarlos.
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.addToast('Algo falló', 'error');
    s.addToast('Otro dato', 'info');
  });
  await page.waitForTimeout(7000);
  await expect(page.getByText('Algo falló')).toBeVisible();
  await expect(page.getByText('Otro dato')).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.getState().addToast('Segundo', 'info'));
  await page.getByRole('button', { name: 'Cerrar todos los avisos' }).click();
  await expect(toasts).toHaveCount(0);
});
