/**
 * @file e2e/qa20-panel-estados.spec.ts
 * @description QA20: estados inconsistentes del panel derecho contextual con una acción abierta (borrar el
 * objeto, cambiar la selección o la herramienta, deshacer, plegar y recargar). Cero errores de consola.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-panel-estados.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
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
  // La acción se cierra con su objeto.
  expect((await S(page)).action).toBeNull();
  await expect.poll(() => ctx(page)).toBe('project');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
  });
  await expect.poll(() => ctx(page)).toBe('object');
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
  // Otro objeto: la acción se cierra y el panel muestra su resumen.
  expect((await S(page)).action).toBeNull();
  await expect.poll(() => ctx(page)).toBe('object');
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await expect.poll(() => ctx(page)).toBe('project');
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id, s.objects[1].id]);
  });
  await expect.poll(() => ctx(page)).toBe('multi');
  expect((await S(page)).action).toBeNull();
});

test('deshacer con una acción abierta', async ({ page }) => {
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setSelection([s.objects[0].id]);
    s.setActiveAction('hollow');
  });
  // Coherencia en cada paso: si la acción sigue abierta, el panel la muestra; si su objeto se fue, se cerró.
  const coherente = async () => {
    const s = await S(page);
    if (s.action) {
      expect(s.sel).toBe(1);
      await expect.poll(() => ctx(page)).toBe('action');
    } else {
      expect(await ctx(page)).not.toBe('action');
    }
  };
  await page.keyboard.press('Control+z');
  await coherente();
  await page.evaluate(() => (window as any).__s.getState().undo());
  await coherente();
  await page.evaluate(() => (window as any).__s.getState().undo());
  await coherente();
  // Con la escena vacía la acción ya no está; rehacer no la vuelve a abrir.
  if ((await S(page)).n === 0) expect((await S(page)).action).toBeNull();
  await page.evaluate(() => (window as any).__s.getState().redo());
  await coherente();
});
