/**
 * @file e2e/escena-vacia-asistente.spec.ts
 * @description Con la escena vacía, la tarjeta «Escena vacía» no se dibuja sobre la vista previa fantasma de un
 * asistente: se oculta cuando aparece el fantasma y vuelve al volver a la galería de asistentes sin fantasma.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './qa12-helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test('la tarjeta «Escena vacía» se oculta mientras el asistente muestra su vista previa', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  await abrir(page);
  const tarjeta = page.getByRole('heading', { name: 'Escena vacía' });
  await expect(tarjeta).toBeVisible();
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
  // Solo con la galería abierta (sin elegir asistente) todavía no hay fantasma: la tarjeta sigue.
  await expect(tarjeta).toBeVisible();
  await page.locator('.kura-asis-card[data-recipe="kura.caja-tapa"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().operationPreview.key), { timeout: 60000 }).toBe('assistant');
  await expect(tarjeta).toBeHidden();
  expect(errores).toEqual([]);
});
