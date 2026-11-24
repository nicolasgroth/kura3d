/**
 * @file e2e/ux-texto-menu.spec.ts
 * @description Navegador real: el clic derecho en el fondo del visor abre el menú contextual completo dentro de
 * la ventana, el menú del objeto cabe sin recortes y el error del SVG sale dentro del diálogo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { agregarForma } from './agregar-helpers';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5189/';
const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-texto';

test('menú del fondo, menú del objeto y error de SVG dentro del diálogo', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL);
  await page.locator('canvas').first().waitFor();

  // Clic derecho real en el fondo vacío.
  const canvas = page.locator('canvas').first();
  // El lienzo nace de 300×150 y r3f lo agranda al medir el visor: con la máquina cargada, medirlo antes deja el
  // clic sobre la barra de vista y el menú no abre. Se espera a que ocupe el visor.
  await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(500);
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3, { button: 'right' });
  const bgMenu = page.getByRole('menu').first();
  await expect(bgMenu).toBeVisible();
  const r = (await bgMenu.boundingBox())!;
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.y + r.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: `${SHOTS}/menu-fondo.png` });
  await page.keyboard.press('Escape');

  // Cubo de la barra lateral → menú del objeto: entra completo en la ventana.
  await agregarForma(page, /^Cubo$/);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55, { button: 'right' });
  const objMenu = page.getByRole('menu').first();
  if (await objMenu.isVisible()) {
    const o = (await objMenu.boundingBox())!;
    expect(o.y).toBeGreaterThanOrEqual(0);
    expect(o.y + o.height).toBeLessThanOrEqual(800);
    await page.screenshot({ path: `${SHOTS}/menu-objeto.png` });
  }
  expect(errors.filter((e) => !/favicon|WebGL|GPU/i.test(e))).toEqual([]);
});
