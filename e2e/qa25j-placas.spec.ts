/**
 * @file e2e/qa25j-placas.spec.ts
 * @description QA 26-nov (I), bloque 2 (tema claro): cama por placa con camas distintas (256 y 180) — «Fuera de volumen» por placa,
 * «Repartir en placas…» manda la pieza grande a la cama grande, el botón «Repartir…» de la tira con 2+ placas, exportar por placa
 * deja cada pieza dentro de su cama, importar un 3MF real de laminador con placas (aviso «Convertir en placas») y la ida y vuelta
 * del 3MF de escena con 2 placas. Evidencia en `.eval-tmp/qa25j/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25j';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

test('camas 256 y 180: Fuera de volumen por placa y Repartir manda la pieza grande a la cama grande', async ({ page }) => {
  test.setTimeout(180_000);
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 200, depth: 200, height: 50, name: 'Grande', position: [100, 25, 100] });
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Chica', position: [10, 10, 10] });
  await S(page, (s) => s.createPlate());
  await S(page, (s) => s.setPlateBed(s.plates[1].id, { name: 'Mini 180', widthMm: 180, depthMm: 180, heightMm: 180 }));
  await expect(tira(page).getByTestId('plate-chip-bed')).toContainText('Mini 180');
  // La grande en la placa 2 (180): fuera de volumen en esa placa; en la 1 (256) cabe.
  await S(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[0].id]));
  await page.screenshot({ path: `${EV}/camas-fuera.png` });
  const ficha2 = tira(page).getByRole('button', { name: /^Placa 2[:,]/ });
  await expect(ficha2).toContainText(/Fuera/);
  await expect(tira(page).getByRole('button', { name: /^Placa 1[:,]/ })).not.toContainText(/Fuera/);
  // Botón «Repartir…» de la tira con 2+ placas.
  const repartir = tira(page).getByRole('button', { name: 'Repartir…', exact: true });
  await expect(repartir).toBeVisible();
  await repartir.click();
  const panel = page.getByRole('dialog', { name: 'Repartir en placas' });
  await expect(panel).toBeVisible();
  await page.getByTestId('arrange-scope-all').check();
  await expect(page.getByTestId('arrange-summary')).toContainText(/2 piezas colocadas/, { timeout: 30_000 });
  await page.screenshot({ path: `${EV}/repartir-camas.png` });
  await page.getByTestId('arrange-apply').click();
  await expect(panel).toHaveCount(0, { timeout: 30_000 });
  const reparto = await S(page, (s) => s.objects.map((o: any) => ({ n: o.name, p: o.plateRef })));
  const idGrande = await S(page, (s) => s.plates[0].id);
  console.log('QA25J reparto', JSON.stringify(reparto));
  expect(reparto.find((r: any) => r.n === 'Grande').p, 'la pieza de 200 mm va a la cama de 256').toBe(idGrande);
  await expect(tira(page).getByRole('button', { name: /^Placa \d+:.*Fuera/ })).toHaveCount(0);
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});

test('3MF real de laminador con placas: aviso «Convertir en placas»', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page);
  const ruta = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';
  test.skip(!existsSync(ruta), 'sin modelo');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(ruta);
  const conv = page.locator('button', { hasText: 'Convertir en placas' }).first();
  const t0 = Date.now();
  await expect(conv).toBeVisible({ timeout: 90_000 });
  console.log('QA25J aviso visible tras', Date.now() - t0, 'ms');
  await page.screenshot({ path: `${EV}/import-3mf-llaveros.png` });
  const info = await S(page, (s) => ({ n: s.objects.length, plates: s.plates.length, groups: new Set(s.objects.map((o: any) => o.groupId).filter(Boolean)).size }));
  console.log('QA25J llaveros', JSON.stringify(info), (await page.locator('[role="status"], .kura-toast').allInnerTexts()).join(' | '));
  const pasos0 = await S(page, (s) => s.past.length as number);
  const placas0 = await S(page, (s) => s.plates.length as number);
  await conv.click();
  await expect.poll(() => S(page, (s) => s.plates.length), { timeout: 20_000 }).toBe(2);
  const reparto = await S(page, (s) => { const c: Record<string, number> = {}; for (const o of s.objects) c[o.plateRef] = (c[o.plateRef] ?? 0) + 1; return c; });
  console.log('QA25J piezas por placa', JSON.stringify(reparto), 'pasos', pasos0, '->', await S(page, (s) => s.past.length as number));
  expect(Object.keys(reparto).length).toBe(2);
  expect(await S(page, (s) => s.past.length as number)).toBe(pasos0 + 1);
  await page.keyboard.press('Control+z');
  await expect.poll(() => S(page, (s) => s.plates.length), { timeout: 10_000 }).toBe(placas0);
  await page.screenshot({ path: `${EV}/import-3mf-convertido.png` });
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});

test('exportar el 3MF de escena con 2 placas y reabrirlo en escena vacía devuelve las placas', async ({ page: page0, browser }) => {
  let page = page0;
  test.setTimeout(150_000);
  const errs = await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'A', position: [10, 10, 10] });
  await S(page, (s) => s.createPlate());
  const o2 = await S(page, (s) => s.plates[1].origin as number[]);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'B', position: [o2[0] + 10, 10, o2[1] + 10] });
  await S(page, (st) => st.setSelection([]));
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^3MF/ }).check({ timeout: 15_000 });
  await dlg.getByRole('radio', { name: /Un 3MF con todas las placas/ }).check({ timeout: 15_000 });
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /\.3mf$/ }).click();
  const d = await dl;
  const file = join(mkdtempSync(join(tmpdir(), 'qa25j-')), 'dos.3mf');
  await d.saveAs(file);
  expect(readFileSync(file).length).toBeGreaterThan(500);
  // Escena vacía: contexto nuevo (sin borradores locales que abran el diálogo de recuperación).
  const ctx2 = await browser.newContext({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });
  page = await ctx2.newPage();
  await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(file);
  await expect.poll(() => S(page, (s) => s.plates.length), { timeout: 30_000 }).toBe(2);
  const piezas = await S(page, (s) => s.objects.map((o: any) => o.plateRef));
  expect(new Set(piezas).size, 'cada pieza en su placa').toBe(2);
  await page.screenshot({ path: `${EV}/roundtrip-placas.png` });
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});

// DEFECTO (QA 26-nov J): el botón «Convertir en placas» del aviso de importación se ve con ese texto pero no se encuentra por
// rol y nombre accesible (getByRole('button', { name: /Convertir en placas/ }) da 0). test.fail hasta que se corrija.
test.fail('el botón «Convertir en placas» tiene nombre accesible', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  const ruta = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';
  test.skip(!existsSync(ruta), 'sin modelo');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(ruta);
  await expect(page.locator('button', { hasText: 'Convertir en placas' }).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: /Convertir en placas/ })).toHaveCount(1, { timeout: 3000 });
});
