/**
 * @file e2e/ux4-rango.spec.ts
 * @description Rango estricto en el inspector: posición, giro y escala fuera de rango o no numéricos se marcan en
 * el campo y no se aplican (la escala 0 o negativa se rechaza con mensaje propio); en modo relativo, «Aplicar»
 * queda deshabilitado mientras haya un Δ inválido; el tamaño y la holgura de Ajustes › División también.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, SHOTS } from './ux4-helpers';

test('escala 0 o negativa y posiciones absurdas se marcan y no se aplican', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate((x) => (window as any).__s.getState().setSelection([x]), id);
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  const estado = () => page.evaluate((x) => {
    const o = (window as any).__s.getState().objects.find((q: any) => q.id === x);
    return { scale: [...o.scale], position: [...o.position], rotation: [...o.rotation] };
  }, id);
  const antes = await estado();

  const escalaX = insp.getByRole('spinbutton', { name: /Escala.* X$/ }).first();
  await escalaX.scrollIntoViewIfNeeded();
  for (const malo of ['0', '-2', 'abc']) {
    await escalaX.fill(malo);
    await escalaX.press('Enter');
    await expect(escalaX).toHaveAttribute('aria-invalid', 'true');
  }
  await escalaX.fill('0');
  await escalaX.press('Enter');
  await expect(insp.getByRole('alert').filter({ hasText: /mayor que 0/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/5-escala-cero.png` });
  expect((await estado()).scale).toEqual(antes.scale);
  await escalaX.press('Escape');

  const posX = insp.getByRole('spinbutton', { name: /Posición.* X$/ }).first();
  await posX.fill('99999999');
  await posX.press('Enter');
  await expect(posX).toHaveAttribute('aria-invalid', 'true');
  await expect(insp.getByRole('alert').filter({ hasText: /Permitido/ })).toBeVisible();
  expect((await estado()).position).toEqual(antes.position);
  await posX.press('Escape');

  const girZ = insp.getByRole('spinbutton', { name: /Rotación.* Z$/ }).first();
  await girZ.fill('9999999');
  await girZ.press('Enter');
  await expect(girZ).toHaveAttribute('aria-invalid', 'true');
  expect((await estado()).rotation).toEqual(antes.rotation);
  await girZ.press('Escape');

  // Un valor válido sí se aplica.
  await escalaX.fill('2');
  await escalaX.press('Enter');
  await expect.poll(async () => (await estado()).scale[0]).toBe(2);
  expect(errs).toEqual([]);
});

test('modo relativo: un Δ fuera de rango deshabilita «Aplicar Δ»', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate((x) => (window as any).__s.getState().setSelection([x]), id);
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  await insp.getByRole('combobox', { name: /Posición.*Modo/ }).selectOption('relative');
  const dx = insp.getByRole('spinbutton', { name: /Posición.* ΔX$/ }).first();
  const aplicar = insp.getByRole('button', { name: 'Aplicar delta' }).first();
  await dx.fill('10');
  await expect(aplicar).toBeEnabled();
  await dx.fill('99999999');
  await expect(dx).toHaveAttribute('aria-invalid', 'true');
  await expect(aplicar).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/5-relativo-rango.png` });
  await dx.fill('5');
  await expect(aplicar).toBeEnabled();
  expect(errs).toEqual([]);
});

test('Ajustes › División y uniones: holgura fuera de rango se marca y no se guarda', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('settings'));
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: /Proyecto y medidas/ }).click();
  const tol = dlg.getByRole('spinbutton', { name: /Holgura/ }).first();
  await tol.scrollIntoViewIfNeeded();
  const antes = await page.evaluate(() => (window as any).__s.getState().splitPrefs.tolerance);
  await tol.fill('50');
  await tol.press('Enter');
  await expect(tol).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => (window as any).__s.getState().splitPrefs.tolerance)).toBe(antes);
  await page.screenshot({ path: `${SHOTS}/5-ajustes-rango.png` });
  expect(errs).toEqual([]);
});
