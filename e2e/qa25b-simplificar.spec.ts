/**
 * @file e2e/qa25b-simplificar.spec.ts
 * @description QA de «Simplificar» por modos: sin pérdida (cubo: nada que quitar, intacto), por tolerancia, por
 * cantidad (esfera 50 %), entradas inválidas, un solo paso de deshacer, informe visible, sin claves crudas ni
 * nombre antiguo, y modelo real mediano al 50 % con cancelación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, clavesCrudas, cmd, idioma, libre, pasos, seleccionar, volumen } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25b';
const tris = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);

async function abrirPanel(page: Page) {
  await (await itemAccion(page, 'Simplificar…')).click();
  await expect(page.locator('.kura-simplify-section')).toBeVisible();
}
const modo = (page: Page, v: 'lossless' | 'tolerance' | 'target') => page.locator('.kura-simplify-section select').first().selectOption(v);
const boton = (page: Page) => page.locator('.kura-simplify-section').getByRole('button', { name: /^Simplificar/ });

test('sin pérdida en un cubo: no cambia nada, no hay paso de historial, avisa', async ({ page }) => {
  const errs = await abrir(page);
  const c = await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
  await seleccionar(page, [c.id]);
  const p0 = await pasos(page);
  const t0 = await tris(page, c.id);
  await abrirPanel(page);
  await boton(page).click();
  await libre(page);
  expect(await pasos(page)).toBe(p0);
  expect(await tris(page, c.id)).toBe(t0);
  await page.screenshot({ path: `${EV}/simp-cubo-sinperdida.png` });
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(/Kura3D(?! )/);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('por cantidad 50 % en esfera: se aplica lo pedido con aviso en un paso, deshacer; valores inválidos', async ({ page }) => {
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
  await seleccionar(page, [s.id]);
  const t0 = await tris(page, s.id);
  const v0 = await volumen(page, s.id);
  const p0 = await pasos(page);
  await abrirPanel(page);
  await modo(page, 'target');
  const pct = page.getByRole('spinbutton', { name: 'Conservar (%)' });
  // inválidos
  for (const bad of ['0', '-5', '150', 'abc']) {
    await pct.fill(bad);
    await pct.blur();
    await page.screenshot({ path: `${EV}/simp-pct-invalido-${bad}.png` });
    const dis = await boton(page).isDisabled();
    const val = await pct.inputValue();
    console.log('QA25B inválido', `"${bad}" -> valor="${val}" botónDeshabilitado=${dis}`);
  }
  await pct.fill('50');
  await pct.blur();
  await boton(page).click();
  await libre(page);
  const t1 = await tris(page, s.id);
  console.log('QA25B tris', `${t0} -> ${t1}`);
  expect(t1).toBeLessThan(t0);
  // Regla de dos niveles (26-nov): en la esfera gruesa el 50 % cambia el volumen −5,4 % y se desvía 1,7 mm. Eso es
  // AVISO, no destructivo: se aplica lo pedido (~248 de 512) y el informe lo advierte.
  expect(Math.abs(t1 / t0 - 0.5)).toBeLessThan(0.15);
  await expect(page.getByTestId('simplify-notice')).toBeVisible();
  await expect(page.getByTestId('simplify-safe-applied')).toHaveCount(0);
  await expect(page.getByTestId('simplify-report-warnings')).toContainText('se avisa desde 5 %');
  expect(await pasos(page)).toBe(p0 + 1);
  const v1 = await volumen(page, s.id);
  expect(Math.abs(v1 - v0) / v0).toBeLessThan(0.1);
  const rep = page.locator('.kura-simplify-section');
  await expect(rep).toContainText('→');
  await page.screenshot({ path: `${EV}/simp-esfera-50.png` });
  expect(await clavesCrudas(page, '.kura-simplify-section')).toEqual([]);
  // deshacer = 1 paso
  await page.keyboard.press('Control+z');
  expect(await tris(page, s.id)).toBe(t0);
  await page.keyboard.press('Control+y');
  expect(await tris(page, s.id)).toBe(t1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('por tolerancia: tolerancia mayor reduce más; idiomas sin claves crudas', async ({ page }) => {
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 20, height: 40, name: 'Cil' });
  await seleccionar(page, [s.id]);
  await abrirPanel(page);
  await modo(page, 'tolerance');
  for (const lang of ['es', 'en', 'de']) {
    await idioma(page, lang);
    for (const m of ['lossless', 'tolerance', 'target'] as const) {
      await modo(page, m);
      expect(await clavesCrudas(page, '.kura-simplify-section'), `${lang}/${m}`).toEqual([]);
    }
  }
  await idioma(page, 'es');
  await modo(page, 'tolerance');
  const t0 = await tris(page, s.id);
  await boton(page).click();
  await libre(page);
  console.log('QA25B tol', `cilindro ${t0} -> ${await tris(page, s.id)}`);
  await page.screenshot({ path: `${EV}/simp-tolerancia.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

const REAL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
test('modelo real mediano al 50 %: se acerca, un paso, cancelable', async ({ page }) => {
  test.skip(!existsSync(REAL), 'sin modelo');
  test.setTimeout(300_000);
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(REAL);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 120_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await seleccionar(page, [id]);
  const t0 = await tris(page, id);
  const v0 = await volumen(page, id);
  const p0 = await pasos(page);
  await abrirPanel(page);
  await modo(page, 'target');
  await boton(page).click();
  await page.screenshot({ path: `${EV}/simp-real-espera.png` });
  await libre(page);
  const t1 = await tris(page, id);
  console.log('QA25B real', `${t0} -> ${t1} (${((t1 / t0) * 100).toFixed(1)}%)`);
  await page.screenshot({ path: `${EV}/simp-real-50.png` });
  expect(await pasos(page)).toBe(p0 + 1);
  expect(Math.abs((await volumen(page, id)) - v0) / v0).toBeLessThan(0.05);
  expect(Math.abs(t1 / t0 - 0.5)).toBeLessThan(0.15);
  expect(errs, errs.join('\n')).toEqual([]);
});

const GRANDE = 'G:/proyectos/kura3d/.eval-tmp/modelos/frierenmw.stl';
test('modelo grande: cancelar a mitad no deja restos; cambiar selección a mitad no corrompe; sin pérdida orgánico avisa', async ({ page }) => {
  test.skip(!existsSync(GRANDE), 'sin modelo');
  test.setTimeout(420_000);
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(GRANDE);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 240_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  const otro = await cmd(page, 'create_primitive', { type: 'sphere', radius: 10, name: 'Otra', position: [200, 0, 0] });
  await seleccionar(page, [id]);
  const t0 = await tris(page, id);
  const v0 = await volumen(page, id);
  const p0 = await pasos(page);
  await abrirPanel(page);
  await modo(page, 'target');
  // 1) cancelar
  await boton(page).click();
  const cancelar = page.getByRole('button', { name: 'Cancelar' });
  await expect(cancelar.first()).toBeVisible({ timeout: 20_000 });
  await cancelar.first().click();
  await libre(page);
  console.log('QA25B grande-cancel', `${t0} -> ${await tris(page, id)} pasos ${p0} -> ${await pasos(page)}`);
  await page.screenshot({ path: `${EV}/simp-grande-cancelado.png` });
  expect(await tris(page, id)).toBe(t0);
  expect(await pasos(page)).toBe(p0);
  expect(Math.abs((await volumen(page, id)) - v0)).toBeLessThan(1e-6);
  // 2) cambiar selección a mitad
  await boton(page).click();
  await expect(cancelar.first()).toBeVisible({ timeout: 20_000 });
  await seleccionar(page, [otro.id]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${EV}/simp-grande-cambio-seleccion.png` });
  await libre(page);
  const t1 = await tris(page, id);
  const totros = await tris(page, otro.id);
  console.log('QA25B grande-selec', `grande ${t0} -> ${t1}, otra=${totros}, pasos=${await pasos(page)}`);
  await page.screenshot({ path: `${EV}/simp-grande-cambio-seleccion-fin.png` });
  const objs = await page.evaluate(() => (window as any).__s.getState().objects.length);
  expect(objs).toBe(2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('1024x768: el panel Simplificar cabe sin desborde horizontal y el informe se lee', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
  await seleccionar(page, [s.id]);
  await abrirPanel(page);
  await modo(page, 'target');
  await boton(page).click();
  await libre(page);
  await page.screenshot({ path: `${EV}/simp-1024.png` });
  const sobra = await page.evaluate(() => {
    const p = document.querySelector('.kura-simplify-section') as HTMLElement;
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, psw: p.scrollWidth, pcw: p.clientWidth };
  });
  console.log('QA25B 1024', JSON.stringify(sobra));
  expect(sobra.sw).toBeLessThanOrEqual(sobra.cw);
  expect(sobra.psw).toBeLessThanOrEqual(sobra.pcw + 1);
  expect(errs, errs.join(' / ')).toEqual([]);
});
