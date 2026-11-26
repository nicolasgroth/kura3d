/**
 * @file e2e/ux3-edicion-pintar.spec.ts
 * @description Recorrido del evaluador en Pintar: con «refinar al pintar» activo no aparece el aviso de «pintará caras
 * enteras»; si el pincel es del mismo color que el objeto se elige otro de la paleta que contraste; y tras
 * «Encuadrar» la barra del pincel no tapa el objeto (cuenta como oclusor del visor).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { aPixel } from './ux-movil-helpers';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

test('Pintar: mensaje coherente, pincel que contrasta y barra que no tapa tras Encuadrar', async ({ page }) => {
  const errs = await abrir(page, 1280, 800);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  // El objeto tiene el mismo color que el pincel por defecto.
  const pincel = await page.evaluate((x) => {
    const s = (window as any).__s.getState();
    s.updateObjectMeta(x, { color: s.paintColor });
    s.setSelection([x]);
    return s.paintColor as string;
  }, id);
  await page.locator('canvas').first().hover();
  await page.getByRole('button', { name: 'Pintar', exact: true }).first().click();
  const barra = page.locator('.kura-paint-toolbar').first();
  await expect(barra).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().paintColor)).not.toBe(pincel);
  // Con refinar al pintar activo (por defecto) no se dice que pintará caras enteras.
  expect(await page.evaluate(() => (window as any).__s.getState().paintRefineEdge)).toBe(true);
  await expect(page.getByText(/pintará caras enteras/)).toHaveCount(0);

  await expect(barra).toHaveAttribute('data-viewport-occluder');
  await page.getByRole('button', { name: /Encuadrar/ }).first().click();
  await page.waitForTimeout(1200);
  const r = (await barra.boundingBox())!;
  // Las 8 esquinas del cubo quedan fuera del rectángulo de la barra.
  for (const sx of [-20, 20]) for (const sy of [0, 40]) for (const sz of [-20, 20]) {
    const p = await aPixel(page, [sx, sy, sz]);
    const dentro = p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
    expect(dentro).toBe(false);
  }
  await page.screenshot({ path: `${SHOTS}/5-pintar.png` });
  expect(errs).toEqual([]);
});
