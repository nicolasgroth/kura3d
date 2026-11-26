/**
 * @file e2e/ux3-edicion-union.spec.ts
 * @description Recorrido del evaluador: cubo de 440 mm dividido con los valores por defecto (conector automático).
 * Ninguna cara maciza queda «débil», no aparece el aviso contradictorio de «pared demasiado delgada» y no se
 * ofrece «Reforzar y dividir de nuevo» (con tamaño automático agrandar más no ayuda).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

test('cubo de 440 mm con conector automático: uniones firmes, sin reforzar ni aviso contradictorio', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page, 1440, 900);
  await crear(page, 'box', { width: 440, height: 440, depth: 440 }, [0, 220, 0]);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect(page.getByText(/Uniones \(\d+\)/i)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('split-weak-summary')).toHaveCount(0);
  await expect(page.getByText(/pared demasiado delgada/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reforzar y dividir de nuevo' })).toHaveCount(0);
  await expect(page.getByText(/Débil ·/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/3-union-firme.png` });
  expect(errs).toEqual([]);
});
