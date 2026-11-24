/**
 * @file e2e/ux8-avisos-barra.spec.ts
 * @description Lote ux8: los avisos no tapan paneles ni controles del visor (apilado acotado), la barra de
 * herramientas tiene exactamente una herramienta pulsada y ninguna apagada, y a 1024 px el chip de la cama y el
 * pie caben sin scroll horizontal. Ejecuta con `KURA_URL=… npx playwright test e2e/ux8-avisos-barra.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

async function conCaja(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 30, height: 30, depth: 30 }, {});
    s.setSelection([obj.id]);
  });
}

async function avisos(page: Page, n: number) {
  await page.evaluate((count) => {
    const s = (window as any).__s.getState();
    for (let i = 0; i < count; i += 1) s.addToast(`Aviso de prueba número ${i + 1} con texto algo largo para ocupar`, 'info');
  }, n);
}

const caja = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

const solapa = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const [w, h] of [[1280, 720], [1440, 900]] as const) {
  test(`los avisos no tapan el panel derecho ni los controles del visor (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await abrir(page);
    await conCaja(page);
    await avisos(page, 5);
    const pila = page.locator('.kura-toast-stack');
    await expect(pila).toBeVisible();
    await page.screenshot({ path: `.eval-tmp/ux8-avisos-${w}.png` });
    const rp = await caja(page, '.kura-toast-stack');
    // Apilado acotado: como mucho 3 avisos visibles y el resto plegado en «+N».
    await expect(page.locator('.kura-toast')).toHaveCount(3);
    for (const sel of ['.kura-right-inspector, [aria-label="Inspector"]', '.kura-tool-rail', '.kura-hud-top-stack']) {
      if (await page.locator(sel).count()) {
        const r = await caja(page, sel);
        expect(solapa(rp, r), `la pila solapa ${sel}`).toBe(false);
      }
    }
  });
}

test('barra de herramientas: exactamente una pulsada y ninguna apagada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrir(page);
  const pulsadas = () => page.locator('#kura-tool-rail button[aria-pressed="true"]');
  // Escena vacía: solo Seleccionar, aunque el modo interno sea «mover».
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).toHaveAccessibleName(/Seleccionar|Select/);
  await conCaja(page);
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).toHaveAccessibleName(/Mover|Move/);
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).not.toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(() => (window as any).__s.getState().deleteObjects((window as any).__s.getState().objects.map((o: any) => o.id)));
  await expect(pulsadas()).toHaveCount(1);
  await expect(pulsadas()).not.toHaveAttribute('aria-disabled', 'true');
});

test('a 1024 px el chip de la cama y el pie caben sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await abrir(page);
  await conCaja(page);
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(desborda).toBe(false);
  await page.screenshot({ path: '.eval-tmp/ux8-1024.png' });
});
