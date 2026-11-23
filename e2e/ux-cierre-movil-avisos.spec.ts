/**
 * @file e2e/ux-cierre-movil-avisos.spec.ts
 * @description A 390 px: el aviso "Creado…" no cubre la barra Mover/Rotar/Escalar (aunque haya varios avisos), y la
 * barra de vistas del visor es una fila desplazable con indicio de que hay más (máscara de desvanecido y
 * ajuste al inicio de cada control), sin controles cortados a medias en reposo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('los avisos no cubren la barra de transformar y la fila de vistas es desplazable', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Formas', exact: true }).tap();
  const lateral = page.locator('.kura-sidebar-left');
  await lateral.getByRole('button', { name: 'Cubo', exact: true }).first().tap();
  await lateral.getByRole('button', { name: 'Esfera', exact: true }).first().tap();
  await expect(page.locator('.kura-toast').first()).toBeVisible();
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('.kura-mobile-transform')!.getBoundingClientRect();
    const toasts = [...document.querySelectorAll('.kura-toast')].map((t) => t.getBoundingClientRect());
    const fila = document.querySelector('.kura-hud-top-bar') as HTMLElement;
    const cs = getComputedStyle(fila);
    return {
      barraAbajo: bar.bottom,
      avisosArriba: toasts.map((t) => t.top),
      overflowX: cs.overflowX,
      mascara: cs.maskImage || cs.webkitMaskImage,
      desborda: fila.scrollWidth > fila.clientWidth,
      snap: cs.scrollSnapType,
    };
  });
  expect(r.avisosArriba.length).toBeGreaterThan(0);
  for (const top of r.avisosArriba) expect(top).toBeGreaterThanOrEqual(r.barraAbajo);
  expect(r.overflowX).toBe('auto');
  expect(r.desborda).toBe(true);
  expect(r.mascara).not.toBe('none');
  expect(r.snap).toMatch(/x/);
});
