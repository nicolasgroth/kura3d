/**
 * @file e2e/rediseno-movil.spec.ts
 * @description Rediseño en móvil (390 px): sin desplazamiento horizontal de página, la barra de vista entra
 * entera en la pantalla, no se duplica la pestaña «Formas», las herramientas siguen alcanzables (menú «Más») y
 * los controles de las barras miden al menos 44 px en táctil.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-movil.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, devices } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, locale: 'es-CL' });

test('390 px: barra de vista completa, sin scroll horizontal, herramientas alcanzables', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().createStarterCube());
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('.kura-viewbar') as HTMLElement;
    const b = bar.getBoundingClientRect();
    const fuera = [...bar.querySelectorAll('button, select')]
      .map((el) => el.getBoundingClientRect())
      .filter((x) => x.width > 0 && (x.right > window.innerWidth + 0.5 || x.left < -0.5)).length;
    const chicos = [...bar.querySelectorAll('button, select')]
      .map((el) => el.getBoundingClientRect())
      .filter((x) => x.width > 0 && (x.height < 43.5 || x.width < 43.5)).length;
    return { docW: document.documentElement.scrollWidth, w: window.innerWidth, right: b.right, fuera, chicos, overflow: bar.scrollWidth > bar.clientWidth + 1 };
  });
  expect(r.docW).toBeLessThanOrEqual(r.w);
  expect(r.right).toBeLessThanOrEqual(r.w);
  expect(r.fuera).toBe(0);
  expect(r.overflow).toBe(false);
  expect(r.chicos).toBe(0);
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/rediseno/movil-390.png' });

  // La barra vertical no se muestra: las herramientas están en «Más».
  await expect(page.locator('.kura-tool-rail')).toBeHidden();
  await page.getByRole('button', { name: 'Más', exact: true }).tap();
  await expect(page.getByRole('menuitemradio', { name: 'Medir' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('390 px: la pestaña «Formas» no se duplica al abrir la hoja', async ({ page }) => {
  await abrir(page);
  const formas = page.getByRole('button', { name: /^Formas$/ }).or(page.getByRole('tab', { name: /^Formas$/ }));
  const visibles = async () => {
    const all = await formas.all();
    let n = 0;
    for (const el of all) if (await el.isVisible()) n += 1;
    return n;
  };
  expect(await visibles()).toBeLessThanOrEqual(1);
  await page.locator('.kura-narrow-panel-bar').getByRole('button').first().tap().catch(() => undefined);
  await page.waitForTimeout(400);
  expect(await visibles()).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/rediseno/movil-formas.png' });
});
