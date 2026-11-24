/**
 * @file e2e/ux8-menu-pintura.spec.ts
 * @description Lote ux8: el menú contextual del objeto tiene un primer nivel corto con los mismos grupos y nombres
 * que el menú «Acciones» (ninguna acción se pierde, teclado completo); el diálogo de Texto 3D enfoca su campo;
 * en Pintar el trazo que sigue a la confirmación pinta, las muestras miden 32×32 px (44×44 en táctil) y la barra
 * y el panel dicen lo mismo del objeto destino.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { aPixel } from './ux-movil-helpers';
import { abrir, crear } from './ux3-edicion-helpers';

async function cubo(page: Page): Promise<string> {
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
  return id;
}

const triangulos = (page: Page) =>
  page.evaluate(() => (window as any).__s.getState().objects[0].mesh.indices.length / 3);
const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length);

test.describe('Pintura', () => {
  for (const sinSeleccion of [false, true]) test(`tras confirmar el aviso, el primer trazo se aplica y el siguiente también pinta (${sinSeleccion ? 'sin selección previa' : 'objeto seleccionado'})`, async ({ page }) => {
    const errs = await abrir(page, 1280, 800);
    const id = await cubo(page);
    await page.evaluate(({ x, sinSeleccion }) => {
      const s = (window as any).__s.getState();
      s.setSelection(sinSeleccion ? [] : [x]);
      s.setActiveTool('paint');
    }, { x: id, sinSeleccion });
    await expect(page.locator('.kura-paint-toolbar').first()).toBeVisible();
    const base = await pasos(page);
    const a = await aPixel(page, [-8, 40, 0]);
    const b = await aPixel(page, [8, 40, 0]);
    // Trazo 1: arrastre sobre la cara superior; el aviso aparece al soltar.
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    const aviso = page.getByRole('dialog').filter({ hasText: /parámetros|paramétric/i }).first();
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: /^Pintar/ }).first().click();
    await expect(aviso).toBeHidden();
    await expect.poll(() => triangulos(page)).toBeGreaterThan(12);
    await expect.poll(() => pasos(page)).toBe(base + 1);
    const tras1 = await triangulos(page);
    // Trazo 2: otra pasada sobre otra zona de la misma cara; no pide aviso y también pinta.
    const c = await aPixel(page, [-8, 40, 12]);
    const d = await aPixel(page, [8, 40, 12]);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move((c.x + d.x) / 2, (c.y + d.y) / 2, { steps: 4 });
    await page.mouse.move(d.x, d.y, { steps: 4 });
    await page.mouse.up();
    await expect(aviso).toBeHidden();
    await expect.poll(() => pasos(page)).toBe(base + 2);
    expect(await triangulos(page)).toBeGreaterThan(tras1);
    expect(errs).toEqual([]);
  });
});
