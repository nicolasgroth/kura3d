/**
 * @file e2e/qa20-panel-estados.spec.ts
 * @description QA20: estados inconsistentes del panel derecho contextual con una acción abierta (borrar el
 * objeto, cambiar la selección o la herramienta, deshacer, plegar y recargar). Cero errores de consola.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-panel-estados.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const S = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__s.getState();
    return { action: s.activeAction, tool: s.activeTool, sel: s.selectedIds.length, n: s.objects.length, past: s.past.length };
  });
const ctx = (page: Page) => page.locator('#kura-inspector-panel').getAttribute('data-context');
let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createStarterCube();
    await s.createPrimitive('cylinder');
  });
  await expect.poll(async () => (await S(page)).n).toBe(2);
});
test.afterEach(() => {
  expect(errores).toEqual([]);
});

test('borrar el objeto con su acción abierta: la acción no reaparece al seleccionar otro objeto', async ({ page }) => {
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
    s.setActiveAction('hollow');
  });
  await expect.poll(() => ctx(page)).toBe('action');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.deleteObjects([s.objects[0].id]);
  });
  await expect.poll(async () => (await S(page)).n).toBe(1);
  console.log('tras borrar', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
  });
  console.log('tras seleccionar otro', JSON.stringify(await S(page)), await ctx(page));
  expect(await ctx(page)).toBe('object');
});

test('cambiar la selección con una acción abierta', async ({ page }) => {
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
    s.setActiveAction('simplify');
  });
  await expect.poll(() => ctx(page)).toBe('action');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[1].id]);
  });
  console.log('otro objeto', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  console.log('sin selección', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id, s.objects[1].id]);
  });
  console.log('multi', JSON.stringify(await S(page)), await ctx(page));
});

test('deshacer con una acción abierta', async ({ page }) => {
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
    s.setActiveAction('hollow');
  });
  await page.keyboard.press('Control+z');
  console.log('undo con acción', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => (window as any).__s.getState().undo());
  console.log('undo x2', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => (window as any).__s.getState().undo());
  console.log('undo x3', JSON.stringify(await S(page)), await ctx(page));
  await page.evaluate(() => (window as any).__s.getState().redo());
  console.log('redo', JSON.stringify(await S(page)), await ctx(page));
});
