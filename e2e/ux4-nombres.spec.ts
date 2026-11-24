/**
 * @file e2e/ux4-nombres.spec.ts
 * @description El corte por plano nombra las mitades con su eje («mitad A (X−)», «mitad B (X+)») en el árbol de Escena y
 * en el aviso del resultado, para no confundirlas con los códigos A1, B1a… de Dividir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux4-helpers';

test('corte por plano en X: mitades con su eje en el árbol y en el aviso', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate((x) => (window as any).__s.getState().setSelection([x]), id);
  await page.evaluate(async (x) => {
    await (window as any).__s.getState().planeCutObject(x, {
      axis: 'x', offset: 0, connectorType: 'none', connectorSize: 3, connectorDepth: 4, tolerance: 0.25, connectorCount: 1, keepMode: 'both',
    });
  }, id);
  const nombres: string[] = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name));
  expect(nombres.some((n) => /mitad A \(X−\)/.test(n))).toBe(true);
  expect(nombres.some((n) => /mitad B \(X\+\)/.test(n))).toBe(true);
  await expect(page.getByText(/Corte por plano completado: mitad A \(X−\) y mitad B \(X\+\)/)).toBeVisible();
  await expect(page.locator('.kura-scene-tree').getByText(/mitad A \(X−\)/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/6-mitades.png` });
  expect(errs).toEqual([]);
});

test('corte por plano en Z (altura): el eje es el del usuario', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate(async (x) => {
    await (window as any).__s.getState().planeCutObject(x, {
      axis: 'y', offset: 0, connectorType: 'none', connectorSize: 3, connectorDepth: 4, tolerance: 0.25, connectorCount: 1, keepMode: 'both',
    });
  }, id);
  const nombres: string[] = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name));
  expect(nombres.some((n) => /mitad A \(Z−\)/.test(n))).toBe(true);
  expect(nombres.some((n) => /mitad B \(Z\+\)/.test(n))).toBe(true);
  expect(errs).toEqual([]);
});
