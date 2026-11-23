/**
 * @file e2e/qa9-creacion-worker.spec.ts
 * @description QA9: operaciones de creación movidas al Worker del motor, recorridas con la interfaz: SVG válido/inválido/vacío,
 * texto 3D con caracteres no soportados, molde de esfera sin embudo (cavidad sellada), proyección de texto y deshacer.
 * Requiere `@playwright/test` y la web en KURA_URL (por defecto http://127.0.0.1:5198).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5198/';

const objs = (p: Page) => p.evaluate(() => document.body.innerText.match(/(\d+) objs/)?.[1] ?? '?');
const size = (p: Page) => p.evaluate(() => document.body.innerText.match(/Tamaño:\s*([^\n]*)\n?([^\n]*)/)?.[0] ?? '');

async function fresh(p: Page) {
  await p.goto(URL);
  await p.waitForSelector('text=Manifold WASM Listo', { timeout: 30000 });
  const discard = p.getByRole('button', { name: 'Descartar' });
  if (await discard.count()) await discard.first().click().catch(() => undefined);
}

test('SVG: válido crea sólido; roto, vacío y texto plano dan error y no crean nada', async ({ page }) => {
  await fresh(page);
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M5 5H55V55H5Z M20 20H40V40H20Z"/><rect x="65" y="65" width="30" height="30"/></svg>';
  const bad = ['<svg xmlns="http://www.w3.org/2000/svg"><path d="M5 5 L', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', 'esto no es un svg'];
  await page.getByRole('button', { name: 'Importar SVG' }).click();
  for (const code of bad) {
    await page.locator('textarea:visible').fill(code);
    await page.getByRole('button', { name: 'Extruir SVG en 3D' }).click();
    await expect(page.getByText(/No se encontraron contornos vectoriales válidos/).first()).toBeVisible();
    expect(await objs(page)).toBe('0');
  }
  await page.locator('textarea:visible').fill(ok);
  await page.getByRole('button', { name: 'Extruir SVG en 3D' }).click();
  await expect(page.getByText(/Importado correctamente/).first()).toBeVisible();
  expect(await objs(page)).toBe('1');
  expect(await size(page)).toContain('60 mm × 60 mm × 6 mm');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => objs(page)).toBe('0');
});

test('Texto 3D: emoji y chino dan error claro; Kura3D se crea y deshacer lo revierte', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Texto 3D' }).first().click();
  const inp = page.locator('#kura-text3d-input');
  for (const t of ['😀🚀', '你好世界']) {
    await inp.fill(t);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByText(/La fuente no tiene estos caracteres/).first()).toBeVisible();
    expect(await objs(page)).toBe('0');
  }
  await inp.fill('Kura3D');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect.poll(() => objs(page)).toBe('1');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => objs(page)).toBe('0');
});

test('Molde: esfera sin embudo explica la cavidad sellada; con embudo crea 2 piezas y deshacer revierte', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Esfera' }).first().click();
  await page.getByRole('button', { name: 'Generar Molde / Silicona' }).click();
  await page.locator('#mold-split').selectOption({ index: 0 });
  await page.getByRole('combobox', { name: 'Arquitectura del molde' }).selectOption({ index: 1 });
  await page.getByRole('checkbox', { name: /embudo/ }).setChecked(false);
  await page.getByRole('button', { name: 'Generar Molde 3D' }).click();
  await expect(page.getByText(/cavidades selladas/).first()).toBeVisible();
  expect(await objs(page)).toBe('1');
  await page.getByRole('checkbox', { name: /embudo/ }).setChecked(true);
  await page.getByRole('button', { name: 'Generar Molde 3D' }).click();
  await expect(page.getByText(/Molde generado \(2 piezas\)/).first()).toBeVisible();
  expect(await objs(page)).toBe('3');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => objs(page)).toBe('1');
});

test('Proyectar texto en cubo: el eje superior crece Z, el frontal crece Y; deshacer restaura', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: 'Cubo' }).first().click();
  for (const [index, grows] of [[0, '30 mm × 30 mm × 31,2 mm'], [2, '30 mm × 31,2 mm × 30 mm']] as const) {
    await page.getByRole('button', { name: 'Proyectar Texto/SVG en Superficie' }).click();
    await page.locator('#proj-axis').selectOption({ index });
    await page.getByRole('button', { name: 'Proyectar sobre Modelo' }).click();
    await expect.poll(() => size(page)).toContain(grows);
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect.poll(() => size(page)).toContain('30 mm × 30 mm × 30 mm');
  }
});
