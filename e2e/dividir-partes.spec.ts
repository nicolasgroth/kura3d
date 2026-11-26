/**
 * @file e2e/dividir-partes.spec.ts
 * @description «Dividir para imprimir» con «Por las partes de la figura»: una pesa asimétrica (esfera
 * grande, cuello delgado, esfera chica) más alta que la cama. Con la rejilla el corte cae en la esfera
 * grande; al elegir la estrategia por partes, el resumen dice «1 corte en partes de la figura» y el
 * plano propuesto queda en el cuello; al dividir salen dos piezas y la chica es solo cabeza y cuello.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, crear } from './ux4-helpers';

test('por las partes de la figura: el corte cae en el cuello', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page, 1440, 900);
  const big = await crear(page, 'sphere', { radius: 60, segments: 64 }, [0, 60, 0]);
  const neck = await crear(page, 'cylinder', { radius: 8, height: 25, segments: 48 }, [0, 115, 0]);
  const head = await crear(page, 'sphere', { radius: 25, segments: 64 }, [0, 160, 0]);
  const id = await page.evaluate(async ({ big, neck, head }) => {
    const r = await (window as any).__s.getState().executeCommand(
      { id: 'e2e_union', command: 'boolean_operation', params: { op: 'union', targetId: big, toolIds: [neck, head] } }, 'ui');
    return r.result.resultId as string;
  }, { big, neck, head });
  await page.evaluate((id) => (window as any).__s.getState().selectObject?.(id), id);

  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  // Cama de 200 × 200 × 160: la pesa (185 de alto) necesita un corte en altura; sin acostar piezas
  for (const [label, v] of [['Ancho X (mm)', '200'], ['Fondo Y (mm)', '200'], ['Alto Z (mm)', '160']] as const) {
    const field = page.getByLabel(label, { exact: true });
    await field.fill(v);
    await field.press('Enter');
  }
  const acostar = page.getByRole('checkbox', { name: 'Permitir acostar piezas' });
  if (await acostar.isChecked()) await acostar.uncheck();

  const plane = () => page.evaluate(() => (window as any).__s.getState().splitPlanPreview.plan?.planes?.[0]?.position as number | undefined);
  await expect.poll(plane, { timeout: 60_000 }).toBeLessThan(115);

  await page.getByLabel('Cómo cortar').selectOption('natural');
  await expect(page.getByText(/Busca los estrechamientos/)).toBeVisible();
  await expect(page.getByTestId('split-natural-summary')).toHaveText(/Cortes en partes de la figura: 1 · cortes rectos adicionales: 0/, { timeout: 60_000 });
  await expect.poll(plane, { timeout: 60_000 }).toBeGreaterThan(118);
  expect(await plane()).toBeLessThan(137);

  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBe(2);
  const alturas = await page.evaluate(() => (window as any).__s.getState().objects
    .filter((o: any) => o.metadata?.split).map((o: any) => o.stats.dimensionsMm[1] as number).sort((a: number, b: number) => a - b));
  expect(alturas[0]).toBeLessThan(70);
});
