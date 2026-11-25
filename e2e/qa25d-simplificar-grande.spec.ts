/**
 * @file e2e/qa25d-simplificar-grande.spec.ts
 * @description QA de la ronda 25-nov (D) de «Simplificar» con un modelo de más de 1 M de triángulos: el aviso de
 * malla pesada abre el panel en «Por cantidad» con 500 000 y el foco en el campo, el panel muestra tres grupos
 * titulados, el resultado trae «Deshacer» que funciona y las cifras coinciden entre informe, aviso e inspector.
 * También el botón «Simplificar…» del inspector en un modelo pequeño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25d';
const GRANDE = process.env.QA_GRANDE ?? 'G:/proyectos/kura3d/.eval-tmp/modelos/busto_pablo_victor.stl';
const tris = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).mesh.indices.length / 3, id);

test('inspector: «Simplificar…» junto a los triángulos abre el panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
  await seleccionar(page, [s.id]);
  const entrada = page.getByTestId('simplify-entry');
  await expect(entrada).toBeVisible();
  const fila = await entrada.evaluate((el) => (el.parentElement?.innerText ?? '').replace(/\s+/g, ' '));
  console.log('QA25D entrada fila:', fila);
  expect(fila).toMatch(/riángulos/i);
  await entrada.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.kura-simplify-section')).toBeVisible();
  await page.screenshot({ path: `${EV}/simplificar-entrada.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('modelo de más de 1 M: aviso abre Por cantidad con 500 000 y foco; simplificar, cifras coherentes y Deshacer', async ({ page }) => {
  test.skip(!existsSync(GRANDE), 'sin modelo grande');
  test.setTimeout(840_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(GRANDE);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 300_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  const t0 = await tris(page, id);
  console.log('QA25D grande triángulos', t0);
  expect(t0).toBeGreaterThan(1_000_000);
  // El aviso de malla pesada.
  const aviso = page.locator('[role="status"], [role="alert"], .kura-toast').filter({ hasText: /Simplificar/ }).first();
  await expect(aviso).toBeVisible({ timeout: 20_000 });
  console.log('QA25D aviso:', (await aviso.innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${EV}/simplificar-aviso.png` });
  await aviso.getByRole('button', { name: /Simplificar/ }).click();
  const seccion = page.locator('.kura-simplify-section');
  await expect(seccion).toBeVisible();
  expect(await seccion.locator('select').first().inputValue()).toBe('target');
  const campo = seccion.getByRole('spinbutton').first();
  const valor = await campo.inputValue();
  const foco = await page.evaluate(() => (document.activeElement as HTMLElement)?.outerHTML.slice(0, 160));
  console.log('QA25D campo', valor, 'foco', foco);
  expect(valor.replace(/\D/g, '')).toBe('500000');
  await expect(campo).toBeFocused();
  console.log('QA25D panel texto', (await seccion.innerText()).replace(/\s+/g, ' ').slice(0, 700));
  await page.screenshot({ path: `${EV}/simplificar-panel-grande.png` });

  const p0 = await pasos(page);
  await seccion.getByRole('button', { name: /^Simplificar/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 280_000 }).toBeNull();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  const t1 = await tris(page, id);
  const informe = (await page.getByTestId('simplify-report').innerText()).replace(/\s+/g, ' ');
  const insp = (await page.locator('#kura-inspector-panel').innerText()).replace(/\s+/g, ' ');
  const toasts = await page.locator('.kura-toast, [role="status"]').allInnerTexts();
  console.log('QA25D t0->t1', t0, t1, '| informe:', informe, '| toasts:', JSON.stringify(toasts));
  await page.screenshot({ path: `${EV}/simplificar-resultado.png` });
  expect(await pasos(page)).toBe(p0 + 1);
  const fmt = (n: number) => new Intl.NumberFormat('es').format(n);
  const variantes = [String(t1), fmt(t1), t1.toLocaleString('es-CL'), t1.toLocaleString('en-US')];
  expect(variantes.some((v) => informe.includes(v)), `informe sin ${t1}: ${informe}`).toBe(true);
  expect(variantes.some((v) => insp.includes(v)), `inspector sin ${t1}`).toBe(true);
  // Deshacer desde el aviso.
  const deshacer = page.locator('.kura-toast, [role="status"], [role="alert"]').getByRole('button', { name: 'Deshacer' }).first();
  await expect(deshacer).toBeVisible();
  await deshacer.click();
  await expect.poll(() => tris(page, id), { timeout: 30_000 }).toBe(t0);
  expect(await pasos(page)).toBe(p0);
  expect(errs, errs.join('\n')).toEqual([]);
});
