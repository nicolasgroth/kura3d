/**
 * @file e2e/docs/capturas-generadores.spec.ts
 * @description Capturas de las guías Generadores y Guardar y recuperar, y la animación de muestra de Dividir
 * para imprimir (video WebM de Playwright, sin dependencias nuevas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { URL, IMG_DIR, abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('generadores', async ({ page }) => {
  await abrir(page);
  // Texto 3D
  const texto = await cmd(page, 'create_primitive', { primitiveType: 'text', type: 'text', text: 'Kura3D', name: 'Texto' });
  await encuadrar(page, 'fit');
  await seleccionar(page, [texto.id]);
  await page.waitForTimeout(800);
  await captura(page, 'generadores-01-texto');
  // SVG
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('svg'));
  await page.waitForTimeout(800);
  await captura(page, 'generadores-02-svg');
  await page.keyboard.press('Escape');
  // Imagen a 3D
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('image'));
  await page.waitForTimeout(800);
  await captura(page, 'generadores-03-imagen');
  await page.keyboard.press('Escape');
  // Rosca ISO
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('thread'));
  await page.waitForTimeout(800);
  await captura(page, 'generadores-04-rosca');
  await page.keyboard.press('Escape');
  // Molde
  const pieza = await cmd(page, 'create_primitive', { type: 'sphere', radius: 15, name: 'Esfera', position: [60, 0, 0] });
  await seleccionar(page, [pieza.id]);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('mold'));
  await page.waitForTimeout(800);
  await captura(page, 'generadores-05-molde');
  await page.keyboard.press('Escape');
});

test('guardar-y-recuperar', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 20, depth: 30, name: 'Soporte', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await page.getByRole('button', { name: /^Proyecto/ }).first().click();
  await page.waitForTimeout(400);
  await captura(page, 'guardar-y-recuperar-01-menu', { x: 0, y: 0, width: 640, height: 320 });
  await page.keyboard.press('Escape');
  // Borrador: el estado se guarda solo; al recargar sin guardar aparece el aviso de recuperación.
  await expect(page.getByText(/Borrador local guardado/).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await captura(page, 'guardar-y-recuperar-02-borrador');
});

test('ajustes-mcp', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.setState({ activeDialog: 'settings', settingsTab: 'mcp' }));
  await page.waitForTimeout(1000);
  await captura(page, 'mcp-01-ajustes');
});

test('dividir-animacion', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'es-CL', colorScheme: 'light',
    recordVideo: { dir: path.resolve(process.cwd(), '.eval-tmp/video-docs'), size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  await abrir(page);
  const grande = await cmd(page, 'create_primitive', { type: 'box', width: 400, height: 200, depth: 180, name: 'Pieza grande', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [grande.id]);
  await page.keyboard.press('Shift+C');
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.waitForTimeout(2500);
  await dividir.click();
  await page.waitForTimeout(5000);
  await encuadrar(page, 'scene');
  await page.waitForTimeout(1500);
  const video = page.video();
  // La animación de armado: el botón de reproducir del control "Armado".
  await page.getByRole('button', { name: /Reproducir|Armar|Play/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(7000);
  await ctx.close();
  await video?.saveAs(path.join(IMG_DIR, 'dividir-para-imprimir-armado.webm'));
  expect(URL).toBeTruthy();
});
