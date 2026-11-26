/**
 * @file e2e/barra-flotante.spec.ts
 * @description Barra flotante de acciones junto al objeto: aparece al seleccionar, sigue al objeto al orbitar, se oculta
 * al arrastrar y reaparece al soltar, Duplicar y Eliminar funcionan, no aparece con Pintar y se apaga desde Ajustes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Acciones del objeto' });

async function conCaja(page: Page) {
  await abrir(page);
  await page.evaluate(() => localStorage.removeItem('kura3d-floating-bar'));
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 30, height: 30, depth: 30 });
    s.selectObject(obj.id, false);
  });
}

const caja = async (page: Page) => (await barra(page).boundingBox())!;

test('aparece al seleccionar, dentro del visor, con seis botones nombrados', async ({ page }) => {
  await conCaja(page);
  await expect(barra(page)).toBeVisible();
  const nombres = await barra(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(nombres).toEqual(['Color base', 'Duplicar', 'Ocultar (no se exporta)', 'Bloquear', 'Eliminar', 'Más']);
  const visor = (await page.locator('.kura-viewport-wrap').boundingBox())!;
  const b = await caja(page);
  expect(b.x).toBeGreaterThanOrEqual(visor.x);
  expect(b.y).toBeGreaterThanOrEqual(visor.y);
  expect(b.x + b.width).toBeLessThanOrEqual(visor.x + visor.width);
  expect(b.y + b.height).toBeLessThanOrEqual(visor.y + visor.height);
  await expect(barra(page).getByRole('button', { name: 'Bloquear' })).toHaveAttribute('aria-pressed', 'false');
});

test('sigue al objeto al orbitar la cámara y se oculta mientras se arrastra', async ({ page }) => {
  await conCaja(page);
  await expect(barra(page)).toBeVisible();
  const antes = await caja(page);
  const visor = (await page.locator('.kura-viewport-wrap').boundingBox())!;
  const cx = visor.x + visor.width * 0.8;
  const cy = visor.y + visor.height * 0.75;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy - 40, { steps: 6 });
  await expect(barra(page)).toBeHidden();
  await page.mouse.up();
  await expect(barra(page)).toBeVisible();
  const despues = await caja(page);
  expect(Math.abs(despues.x - antes.x) + Math.abs(despues.y - antes.y)).toBeGreaterThan(1);
});

test('Duplicar y Eliminar actúan sobre la selección', async ({ page }) => {
  await conCaja(page);
  const total = () => page.evaluate(() => (window as any).__s.getState().objects.length);
  const n = await total();
  await barra(page).getByRole('button', { name: 'Duplicar' }).click();
  expect(await total()).toBe(n + 1);
  await barra(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect.poll(total).toBe(n);
});

test('Bloquear alterna aria-pressed y «Más» abre el menú del objeto sin la barra', async ({ page }) => {
  await conCaja(page);
  const bloquear = barra(page).getByRole('button', { name: 'Bloquear' });
  await bloquear.click();
  await expect(barra(page).getByRole('button', { name: 'Desbloquear' })).toHaveAttribute('aria-pressed', 'true');
  await barra(page).getByRole('button', { name: 'Más' }).click();
  await expect(page.getByRole('menu').first()).toBeVisible();
  await expect(barra(page)).toHaveCount(0);
});

test('con Pintar no aparece y se puede apagar desde Ajustes', async ({ page }) => {
  await conCaja(page);
  await expect(barra(page)).toBeVisible();
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('paint'));
  await expect(barra(page)).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
  await expect(barra(page)).toBeVisible();
  await page.evaluate(() => localStorage.setItem('kura3d-floating-bar', '0'));
  await page.reload();
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 30, height: 30, depth: 30 });
    s.selectObject(obj.id, false);
  });
  await expect(barra(page)).toHaveCount(0);
});

test('con el teclado: Alt+. enfoca la barra y las flechas recorren los botones', async ({ page }) => {
  await conCaja(page);
  await expect(barra(page)).toBeVisible();
  await page.keyboard.press('Alt+.');
  await expect(barra(page).getByRole('button', { name: 'Color base' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(barra(page).getByRole('button', { name: 'Duplicar' })).toBeFocused();
});
