/**
 * @file e2e/gen-ui-molde.spec.ts
 * @description Diálogo de molde: abre en bivalvo (dos mitades), cada modo muestra solo los campos que usa, con una
 * frase y un esquema que explican lo que se obtiene.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/gen-ui';

test('molde: modo por defecto bivalvo y campos según el modo', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, { placement: 'free' });
    s.setActiveDialog('mold');
  });
  const dlg = page.getByRole('dialog');
  const modo = dlg.locator('#mold-mode');
  await expect(modo).toHaveValue('direct_2part');
  const ayuda = dlg.getByRole('note');
  await expect(ayuda).toContainText('Dos mitades');
  await expect(ayuda.locator('svg')).toBeVisible();
  await expect(dlg.locator('#mold-split')).toBeVisible();
  await expect(dlg.locator('#mold-tol')).toBeVisible();
  await expect(dlg.locator('#mold-spout-r')).toBeVisible();
  await expect(dlg.locator('#mold-boxwall')).toHaveCount(0);
  await expect(dlg.locator('#mold-cavwall')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/09-molde-bivalvo.png` });

  await modo.selectOption('silicone_master');
  await expect(ayuda).toContainText('silicona');
  await expect(dlg.locator('#mold-boxwall')).toBeVisible();
  await expect(dlg.locator('#mold-split')).toHaveCount(0);
  await expect(dlg.locator('#mold-tol')).toHaveCount(0);
  await expect(dlg.locator('#mold-spout-r')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/10-molde-silicona.png` });

  await modo.selectOption('direct_1part');
  await expect(dlg.locator('#mold-split')).toHaveCount(0);
  await expect(dlg.locator('#mold-spout-r')).toBeVisible();

  await modo.selectOption('core_cavity');
  await expect(dlg.locator('#mold-cavwall')).toBeVisible();
  await expect(dlg.locator('#mold-boxwall')).toHaveCount(0);
  expect(errores.filter((e) => !/404/.test(e))).toEqual([]);
});
