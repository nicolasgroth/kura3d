/**
 * @file e2e/ux-movil-hoja.spec.ts
 * @description UX móvil (390x844 táctil): una sola hoja inferior a la vez, tres alturas, visor >= 45 % en
 * altura media, plegado al tocar el visor, tirador sin selección de texto y operable con teclado, barra
 * Mover/Rotar/Escalar con áreas de 44x44. Guarda capturas en .eval-tmp/ux-movil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, arrastreTactil, crearCubo, rect, SHOTS } from './ux-movil-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const visibles = (page: Page) =>
  page.evaluate(() =>
    ['.kura-sidebar-left', '.kura-sidebar-right', '.kura-ai-drawer', '#kura-op-slot .kura-op-panel'].filter((sel) => {
      const el = document.querySelector(sel);
      return !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
    }),
  );

const altoVisor = async (page: Page) => (await rect(page, '.kura-viewport-wrap'))?.height ?? 0;

test('una sola hoja a la vez; media deja >= 45 % al visor; se pliega al tocar el visor', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await abrir(page);
  await crearCubo(page);

  await page.getByRole('button', { name: 'Formas', exact: true }).tap();
  await expect.poll(() => visibles(page)).toEqual(['.kura-sidebar-left']);
  expect(await page.locator('.kura-workspace').getAttribute('data-sheet')).toBe('half');
  expect(await altoVisor(page)).toBeGreaterThanOrEqual(844 * 0.45);
  await page.screenshot({ path: `${SHOTS}/hoja-1-formas-media.png` });

  // Medir reemplaza a Formas (no se apilan).
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
  await expect.poll(() => visibles(page)).toEqual(['#kura-op-slot .kura-op-panel']);
  expect(await altoVisor(page)).toBeGreaterThanOrEqual(844 * 0.45);
  await page.screenshot({ path: `${SHOTS}/hoja-2-medir-reemplaza.png` });

  // Abrir Inspector reemplaza a Medir y vuelve a la herramienta de selección.
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  await expect.poll(() => visibles(page)).toEqual(['.kura-sidebar-right']);
  expect(await page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('select');
  await page.screenshot({ path: `${SHOTS}/hoja-3-inspector.png` });

  // Tocar el visor la pliega.
  await page.mouse.click(30, 200);
  await page.touchscreen.tap(30, 200);
  await expect.poll(() => page.locator('.kura-workspace').getAttribute('data-sheet')).toBe('folded');
  expect(await visibles(page)).toEqual([]);
  const plegada = await rect(page, '.kura-narrow-panel-actions');
  expect(plegada!.height).toBeLessThanOrEqual(60);
  await page.screenshot({ path: `${SHOTS}/hoja-4-plegada.png` });
  expect(errs).toEqual([]);
});

test('tirador: botón alterna alturas con aria-expanded y el arrastre no selecciona texto', async ({ page }) => {
  await abrir(page);
  await crearCubo(page);
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  const grip = page.locator('[data-sheet-grip]');
  await expect(grip).toHaveAttribute('aria-expanded', 'true');
  const box = (await grip.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  // Teclado: Enter alterna half -> full -> folded.
  await grip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kura-workspace')).toHaveAttribute('data-sheet', 'full');
  await page.keyboard.press('Enter');
  await expect(page.locator('.kura-workspace')).toHaveAttribute('data-sheet', 'folded');
  await expect(grip).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(page.locator('.kura-workspace')).toHaveAttribute('data-sheet', 'half');

  // Arrastre táctil hacia arriba: queda completa y no hay texto seleccionado.
  const c = (await grip.boundingBox())!;
  const from = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  await arrastreTactil(page, from, { x: from.x, y: from.y - 300 });
  await expect(page.locator('.kura-workspace')).toHaveAttribute('data-sheet', 'full');
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await page.screenshot({ path: `${SHOTS}/hoja-5-completa.png` });

  // Arrastre hacia abajo: primero queda media y luego plegada.
  for (const [dy, esperado] of [[250, 'half'], [300, 'folded']] as const) {
    const g = (await grip.boundingBox())!;
    const f = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    await arrastreTactil(page, f, { x: f.x, y: f.y + dy });
    await expect(page.locator('.kura-workspace')).toHaveAttribute('data-sheet', esperado);
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  }
});

test('barra Mover/Rotar/Escalar con objeto seleccionado: 44x44 y nombre accesible', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('.kura-mobile-transform')).toHaveCount(0);
  await crearCubo(page);
  const barra = page.getByRole('toolbar', { name: 'Transformar el objeto' });
  await expect(barra).toBeVisible();
  for (const nombre of [/Mover/, /Rotar/, /Escalar/]) {
    const b = barra.getByRole('button', { name: nombre });
    const r = (await b.boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(44);
    expect(r.height).toBeGreaterThanOrEqual(44);
  }
  await barra.getByRole('button', { name: /Rotar/ }).tap();
  expect(await page.evaluate(() => (window as any).__s.getState().transformMode)).toBe('rotate');
  await expect(barra.getByRole('button', { name: /Rotar/ })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `${SHOTS}/hoja-6-transformar.png` });
});
