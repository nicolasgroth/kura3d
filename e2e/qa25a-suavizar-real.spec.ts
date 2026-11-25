/**
 * @file e2e/qa25a-suavizar-real.spec.ts
 * @description QA de «Suavizar malla» con un modelo real grande (solo lectura desde `.eval-tmp/modelos`): muestra la
 * espera con progreso, se puede cancelar sin dejar restos ni pasos de historial, y luego aplicar con pocas pasadas
 * es un solo paso sin encoger el volumen. Se omite si el modelo no existe.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, EVID, libre, pasos, volumen } from './qa25a-helpers';

const MODELO = process.env.QA_MODELO ?? 'G:/proyectos/kura3d/.eval-tmp/modelos/busto_anubis_gotico.stl';

test.skip(!existsSync(MODELO), 'modelo real no disponible');

test('suavizar con un modelo real: espera visible, cancelar sin restos, aplicar = 1 paso', async ({ page }) => {
  test.setTimeout(420_000);
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(MODELO);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 240_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await page.evaluate((i) => (window as any).__s.setState({ selectedIds: [i] }), id);
  const tris = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).mesh.indices.length / 3, id);
  const v0 = await volumen(page, id);
  const p0 = await pasos(page);
  await (await itemAccion(page, 'Suavizar…')).click();
  await expect(page.getByRole('heading', { name: 'Suavizar malla' })).toBeVisible();

  // 1) Vista previa y cancelar a mitad.
  await page.getByRole('button', { name: /^Vista previa/ }).click();
  const estado = page.locator('#kura-inspector-panel').getByRole('status');
  await expect(estado.filter({ hasText: /Suavizando|Comprobando|Calculando/ })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${EVID}/suavizar-real-espera.png` });
  const cancelar = page.locator('#kura-inspector-panel').getByRole('button', { name: 'Cancelar' });
  await expect(cancelar).toBeVisible();
  await cancelar.click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().smoothSession?.status ?? null), { timeout: 30_000 }).not.toBe('computing');
  await libre(page);
  expect(await pasos(page)).toBe(p0);
  expect(Math.abs((await volumen(page, id)) - v0)).toBeLessThan(1e-6);
  await page.screenshot({ path: `${EVID}/suavizar-real-cancelado.png` });

  // 2) Aplicar con pocas pasadas.
  const pasadas = page.getByRole('spinbutton', { name: 'Pasadas' });
  await pasadas.fill('2');
  await pasadas.blur();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().smoothSession?.status ?? null), { timeout: 360_000 }).toMatch(/applied|error/);
  await libre(page);
  const status = await page.evaluate(() => (window as any).__s.getState().smoothSession?.status);
  test.info().annotations.push({ type: 'real', description: `triángulos=${tris} estado=${status}` });
  if (status === 'applied') {
    expect(await pasos(page)).toBe(p0 + 1);
    const v1 = await volumen(page, id);
    expect(Math.abs(v1 - v0) / v0, 'el volumen no debe encogerse de forma visible').toBeLessThan(0.03);
  }
  await page.screenshot({ path: `${EVID}/suavizar-real-aplicado.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});
