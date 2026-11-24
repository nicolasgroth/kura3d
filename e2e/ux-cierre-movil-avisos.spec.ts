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

test('los avisos no cubren la barra de transformar y la barra de vistas cabe completa', async ({ page }) => {
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
        return {
      barraAbajo: bar.bottom,
      avisosArriba: toasts.map((t) => t.top),
      desborda: fila.scrollWidth > fila.clientWidth,
      paginaDesborda: document.documentElement.scrollWidth > window.innerWidth,
      fueraDePantalla: [...fila.querySelectorAll('.kura-viewbar button')]
        .filter((el) => (el as HTMLElement).getClientRects().length > 0)
        .map((el) => ({ el, b: el.getBoundingClientRect() }))
        .filter(({ b }) => b.right > window.innerWidth + 0.5 || b.left < -0.5)
        .map(({ el }) => el.getAttribute('aria-label') ?? el.outerHTML.slice(0, 60)),
      botonesVista: fila.querySelectorAll('.kura-viewbar button').length,
    };
  });
  expect(r.avisosArriba.length).toBeGreaterThan(0);
  for (const top of r.avisosArriba) expect(top).toBeGreaterThanOrEqual(r.barraAbajo);
  // La barra de vista se compacta por niveles: completa y alcanzable a 390 px sin desplazamiento horizontal.
  expect(r.botonesVista).toBeGreaterThan(0);
  expect(r.desborda).toBe(false);
  expect(r.paginaDesborda).toBe(false);
  expect(r.fueraDePantalla).toEqual([]);
});
