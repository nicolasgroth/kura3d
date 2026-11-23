/**
 * @file e2e/ux-cierre-hoja-completa.spec.ts
 * @description A 390 px, con la hoja inferior a altura completa la barra Mover/Rotar/Escalar se oculta (no hay
 * visor útil y se solapaba con la fila de cámara); con la hoja a media altura o plegada vuelve a verse.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crearCubo } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-cierre';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('la barra de transformar se oculta con la hoja a altura completa', async ({ page }) => {
  await abrir(page);
  await crearCubo(page);
  const barra = page.getByRole('toolbar', { name: 'Transformar el objeto' });
  await expect(barra).toBeVisible();
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  await expect(barra).toBeVisible();
  const tirador = page.getByRole('button', { name: /Altura del panel/ });
  for (let i = 0; i < 3 && !/completo/.test((await tirador.getAttribute('aria-label')) ?? ''); i++) await tirador.tap();
  await expect(tirador).toHaveAttribute('aria-label', /completo/);
  await expect(barra).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/hoja-completa-sin-barra.png` });
  // Al volver a una altura menor reaparece.
  for (let i = 0; i < 3 && /completo/.test((await tirador.getAttribute('aria-label')) ?? ''); i++) await tirador.tap();
  await expect(tirador).not.toHaveAttribute('aria-label', /completo/);
  await expect(barra).toBeVisible();
});
