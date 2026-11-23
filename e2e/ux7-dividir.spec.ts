/**
 * @file e2e/ux7-dividir.spec.ts
 * @description Dividir para imprimir: los rótulos de los planos de corte y de las piezas no se solapan en el
 * visor; el resumen de uniones no dice «hasta 0 con conector»; tras dividir, cada pieza del árbol de Escena
 * lleva su rótulo («A1a · nombre»), el mismo que el visor. Ejecuta con
 * `KURA_URL=… npx playwright test e2e/ux7-dividir.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { SHOTS } from './ux7-helpers';

test('rótulos de planos sin solapes, resumen claro y piezas rotuladas en el árbol', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 440, height: 440, depth: 440 }, { name: 'Caja' });
  });
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  const planos = page.locator('.kura-split-label-layer .kura-split-plane-tag');
  await expect.poll(() => planos.count(), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  const cajas = await page.locator('.kura-split-label-layer .kura-split-label').evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).style.display !== 'none')
      .map((e) => e.getBoundingClientRect())
      .map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })),
  );
  expect(cajas.length).toBeGreaterThan(1);
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      expect(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b).toBe(false);
    }
  await expect(page.getByText(/hasta 0 con conector/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/dividir-rotulos-1440.png` });

  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);
  await page.getByRole('tab', { name: /Escena/ }).first().click();
  const code = await page.evaluate(() => (window as any).__s.getState().objects.find((o: any) => o.metadata?.split).metadata.split.code as string);
  const fila = page.getByRole('treeitem', { name: new RegExp(`^${code} · Caja`) });
  await expect(fila.first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/dividir-arbol-1440.png` });
});
