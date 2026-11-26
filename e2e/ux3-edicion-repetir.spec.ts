/**
 * @file e2e/ux3-edicion-repetir.spec.ts
 * @description Recorrido del evaluador para F4: tras Agrupar, apoyar un objeto en la cama con la tecla L, elegir
 * otro y pulsar F4 repite «Apoyar en la cama» (no Agrupar) y el aviso dice qué se repitió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

test('F4 repite la última acción hecha con la tecla L', async ({ page }) => {
  const errs = await abrir(page);
  const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [0, 30, 0]);
  const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [40, 25, 0]);
  const c = await crear(page, 'sphere', undefined, [-40, 10, 0]);
  // Una acción repetible anterior (Agrupar) que no debe repetirse.
  await page.evaluate((ids) => (window as any).__s.getState().groupObjects(ids), [b, c]);
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), a);
  await page.locator('canvas').first().hover();
  await page.keyboard.press('l');
  await expect.poll(() => page.evaluate((id) => (window as any).__s.getState().objects.find((o: any) => o.id === id).position[1], a)).toBeLessThan(15);

  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), b);
  await page.keyboard.press('F4');
  await expect(page.getByText('Repetido: Apoyar en la cama')).toBeVisible();
  await expect(page.getByText(/«Agrupar» no se aplica/)).toHaveCount(0);
  const yB = await page.evaluate((id) => (window as any).__s.getState().objects.find((o: any) => o.id === id).position[1], b);
  expect(yB).toBeLessThan(15);
  await page.screenshot({ path: `${SHOTS}/2-f4-apoyar.png` });
  expect(errs).toEqual([]);
});
