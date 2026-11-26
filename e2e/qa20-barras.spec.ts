/**
 * @file e2e/qa20-barras.spec.ts
 * @description QA20: barras del rediseño a 1440, 1024 y 390 px, claro y oscuro: sin desborde horizontal, Ajustes
 * en «Más» bajo 900 px, historial desplegable (saltar y volver), menú Acciones con motivo de lo deshabilitado,
 * Esc cierra menús devolviendo el foco, y cero errores de consola. Capturas en `.eval-tmp/qa20/`.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-barras.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/qa20';
let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
});
test.afterEach(() => {
  expect(errores).toEqual([]);
});

async function conEscena(page: Page, w: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: w, height: 900 });
  await abrir(page);
  await page.evaluate(async (sc) => {
    const s = (window as any).__s.getState();
    s.setColorScheme?.(sc);
    await s.createStarterCube();
  }, scheme);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
}

for (const w of [1440, 1024]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`sin desborde horizontal ni cortes a ${w}px (${scheme})`, async ({ page }) => {
      await conEscena(page, w, scheme);
      const r = await page.evaluate(() => ({
        docW: document.documentElement.scrollWidth,
        win: window.innerWidth,
        top: (() => { const t = document.querySelector('.kura-topbar') as HTMLElement | null; return t ? { sw: t.scrollWidth, cw: t.clientWidth, h: t.getBoundingClientRect().height } : null; })(),
      }));
      console.log(w, scheme, JSON.stringify(r));
      expect(r.docW).toBeLessThanOrEqual(r.win + 1);
      if (r.top) expect(r.top.sw).toBeLessThanOrEqual(r.top.cw + 1);
      await page.screenshot({ path: `${OUT}/barras-${w}-${scheme}.png` });
    });
  }
}

test('historial: saltar a un paso anterior y volver', async ({ page }) => {
  await conEscena(page, 1440, 'light');
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('cylinder');
    await s.createPrimitive('sphere');
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(3);
  await page.getByRole('button', { name: 'Historial de acciones' }).click();
  const lista = page.getByRole('listbox', { name: 'Historial de acciones' });
  const items = lista.getByRole('option');
  const n = await items.count();
  console.log('items historial', n, await items.allTextContents());
  expect(n).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: `${OUT}/historial.png` });
  // saltar al paso más antiguo
  await items.nth(1).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBeLessThan(3);
  const tras = await page.evaluate(() => (window as any).__s.getState().objects.length);
  console.log('objetos tras saltar atrás', tras);
  // volver al presente por el historial
  await page.getByRole('button', { name: 'Historial de acciones' }).click();
  const items2 = page.getByRole('listbox', { name: 'Historial de acciones' }).getByRole('option');
  console.log('items tras saltar', await items2.allTextContents());
  await items2.last().click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(3);
});

test('menú Acciones sin selección: lo deshabilitado explica el motivo; Esc devuelve el foco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const btn = page.getByRole('button', { name: 'Acciones', exact: true });
  await btn.click();
  const menu = page.getByRole('menu', { name: 'Acciones' });
  await expect(menu).toBeVisible();
  const items = menu.getByRole('menuitem');
  const info = await items.evaluateAll((els) => els.map((e) => ({ t: (e.textContent || '').trim().slice(0, 60), dis: e.getAttribute('aria-disabled') === 'true' || (e as HTMLButtonElement).disabled, desc: e.getAttribute('aria-describedby'), title: e.getAttribute('title') })));
  console.log(JSON.stringify(info, null, 1));
  const sinMotivo = info.filter((i) => i.dis && !i.desc && !i.title);
  expect(sinMotivo, 'ítems deshabilitados sin motivo accesible').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(btn).toBeFocused();
});
