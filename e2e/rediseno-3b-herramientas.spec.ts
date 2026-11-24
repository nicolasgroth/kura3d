/**
 * @file e2e/rediseno-3b-herramientas.spec.ts
 * @description Ajustes al rediseño (lote 3b): con la escena vacía las herramientas se apagan y dicen por qué
 * (tooltip, barra de estado y aviso al usar el atajo); Escalar sin selección selecciona todo; Pintar sin selección
 * pinta directo el objeto bajo el pincel; con Pintar activa el panel derecho muestra solo la pintura, sin
 * transformación ni geometría. Capturas en `.eval-tmp/rediseno-3b/`.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-3b-herramientas.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { aPixel } from './ux-movil-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/rediseno-3b';
const st = (page: Page, key: string) => page.evaluate((k) => (window as any).__s.getState()[k], key);
const panel = (page: Page) => page.locator('#kura-inspector-panel');
const rail = (page: Page) => page.getByRole('toolbar', { name: /Herramientas/ });

let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
});

test.afterEach(() => {
  expect(errores).toEqual([]);
});

async function dosCubos(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box');
    await s.createPrimitive('box');
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  return page.evaluate(() => {
    (window as any).__s.getState().setSelection([]);
    return (window as any).__s.getState().objects.map((o: { id: string }) => o.id);
  });
}

test('escena vacía: las herramientas se apagan y explican por qué', async ({ page }) => {
  const escalar = rail(page).getByRole('button', { name: 'Escalar' });
  await expect(escalar).toHaveAttribute('aria-disabled', 'true');
  await expect(rail(page).getByRole('button', { name: 'Pintar' })).toHaveAttribute('aria-disabled', 'true');
  await expect(rail(page).getByRole('button', { name: 'Seleccionar' })).not.toHaveAttribute('aria-disabled', 'true');
  // Sigue enfocable y el motivo sale en la barra de estado y en el tooltip.
  await escalar.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await expect(escalar).toBeFocused();
  await expect(page.getByTestId('status-help')).toContainText('la escena está vacía');
  await expect(page.getByRole('tooltip')).toContainText('la escena está vacía');
  await page.screenshot({ path: `${OUT}/escena-vacia-1440.png` });
  // Atajo con la escena vacía: no cambia el modo y avisa.
  await page.locator('canvas').first().click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('s');
  await expect(page.getByText('Escalar no disponible: la escena está vacía').first()).toBeVisible();
  expect(await st(page, 'transformMode')).toBe('translate');
});

test('Escalar sin selección selecciona todo y el panel pone la escala arriba', async ({ page }) => {
  const ids = await dosCubos(page);
  await rail(page).getByRole('button', { name: 'Escalar' }).click();
  await expect.poll(() => st(page, 'selectedIds')).toEqual(ids);
  expect(await st(page, 'transformMode')).toBe('scale');
  // Con un objeto, el panel muestra solo la escala.
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), ids[0]);
  await expect(panel(page)).toHaveAttribute('data-context', 'tool');
  await expect(panel(page).locator('#kura-precision-scale')).toBeVisible();
  await expect(panel(page).locator('#kura-precision-translate')).toBeHidden();
  await expect(panel(page).locator('#kura-obj-name')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/escalar-panel-1440.png` });
  await panel(page).getByRole('button', { name: 'Ver todo el objeto' }).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
});

test('Pintar sin seleccionar pinta directo el objeto bajo el pincel', async ({ page }) => {
  await page.evaluate(async () => {
    await (window as any).__s.getState().createStarterCube();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  const id = await page.evaluate(() => {
    (window as any).__s.getState().setSelection([]);
    return (window as any).__s.getState().objects[0].id as string;
  });
  await page.waitForTimeout(400);
  const centro = await page.evaluate(() => (window as any).__s.getState().objects[0].position as [number, number, number]);
  await rail(page).getByRole('button', { name: 'Pintar' }).click();
  expect(await st(page, 'activeTool')).toBe('paint');
  expect(await st(page, 'selectedIds')).toEqual([]);
  await expect(panel(page)).toHaveAttribute('data-context', 'tool');
  const p = await aPixel(page, centro);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 4, p.y + 2, { steps: 3 });
  await page.mouse.up();
  await expect.poll(() => st(page, 'selectedIds')).toEqual([id]);
  const pintado = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    const faces: string[] | undefined = s.objects[0].mesh.faceColors;
    return Boolean(faces && faces.some((c) => c.toLowerCase() === s.paintColor.toLowerCase()));
  });
  expect(pintado).toBe(true);
});

test('con Pintar activa el panel muestra solo la pintura', async ({ page }) => {
  await page.evaluate(() => (window as any).__s.getState().createStarterCube());
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBe(1);
  await rail(page).getByRole('button', { name: 'Pintar' }).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'tool');
  await expect(panel(page).getByRole('heading', { name: 'Pintar' })).toBeVisible();
  await expect(panel(page).getByRole('group', { name: 'Color del pincel' }).or(panel(page).locator('.kura-swatch-row')).first()).toBeVisible();
  await expect(panel(page).getByText(/Transformación/)).toHaveCount(0);
  await expect(panel(page).locator('#kura-precision-translate')).toHaveCount(0);
  await expect(panel(page).getByText('Separar por colores').first()).toBeVisible();
  // En escritorio la barra del visor no repite el selector de modo.
  await expect(page.locator('.kura-paint-toolbar').getByRole('combobox', { name: /Modo/ })).toBeHidden();
  await page.screenshot({ path: `${OUT}/pintar-panel-1440.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: `${OUT}/pintar-panel-1440-oscuro.png` });
});
