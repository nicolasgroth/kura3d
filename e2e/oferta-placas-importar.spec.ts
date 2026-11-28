/**
 * @file e2e/oferta-placas-importar.spec.ts
 * @description Al importar un 3MF con varias placas la oferta «Convertir en placas» queda a la vista como mensaje
 * emergente: las advertencias sin botón que llegan después (orientación mezclada, avisos del motor) no la reemplazan,
 * van al histórico y encienden el icono de advertencias.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { abrir } from './ux-escena-helpers';

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const RUTA = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';

test('3MF con varias placas y avisos del motor: la oferta queda a la vista y las advertencias van al icono', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(!existsSync(RUTA), 'sin modelo');
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrir(page);
  // El motor también avisa (orientación mezclada) justo después del resultado de la importación.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(RUTA);
  const oferta = page.getByRole('status').filter({ has: page.getByRole('button', { name: /Convertir en placas/ }) });
  await expect(oferta).toBeVisible({ timeout: 90_000 });
  // Un aviso del motor sin botón llega después: no la tapa.
  await S(page, (s) => s.addToast('Orientación mezclada en las caras de la malla (prueba).', 'warning'));
  await expect(oferta).toBeVisible();
  const historial = await S(page, (s) => s.toastHistory.map((x: any) => `${x.kind}:${x.text}`));
  expect(historial.some((x: string) => x.startsWith('warning:Orientación mezclada'))).toBe(true);
  const iconos = page.getByTestId('toast-center').locator('.kura-toast-center-icons');
  await expect(iconos).toContainText(/\d/);
  await expect(page.getByTestId('toast-center').getByRole('button', { name: /advertencia/i }).first()).toBeVisible();
  // Un error sí la desplaza.
  await S(page, (s) => s.addToast('Error de prueba', 'error'));
  await expect(oferta).toHaveCount(0);
});
