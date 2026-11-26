/**
 * @file e2e/qa12-medir.spec.ts
 * @description QA12: herramienta Medir con clics reales sobre el visor (proyección con la cámara real). Distancia
 * (arista, diagonal de cara y del cubo, imanes, Alt, Escape/clic derecho, ejes del usuario), ángulo, área, borrar, y
 * que Medir no ensucie el historial. Requiere `@playwright/test` y la web en KURA_URL (por defecto 5213).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, clicMundo, medidas, mover, SHOTS } from './qa12-helpers';

const cubo = async (page: Page, extra: Record<string, unknown> = {}) => {
  await page.evaluate(async (o) => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 40, height: 40, depth: 40 }, o);
  }, extra);
  await page.waitForTimeout(500);
  // Medir exige un objeto: se activa con el cubo ya creado (tecla D) y luego se encuadra descontando su panel.
  await page.keyboard.press('d');
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
};
const hist = (page: Page) => page.evaluate(() => { const s = (window as any).__s.getState(); return { past: s.past.length, future: s.future.length }; });
const hover = (page: Page) => page.evaluate(() => (window as any).__m.getState().hover);
const V = (x: number, y: number, z: number) => [x, y, z] as [number, number, number];

test.use({ viewport: { width: 1440, height: 900 } });

test('distancia: arista 40, diagonal de cara 56,57, diagonal del cubo 69,28; Medir no crea pasos de deshacer', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await abrir(page);
  await cubo(page);
  const h0 = await hist(page);
  expect(await page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('measure');
  // Se hace clic 1 mm hacia dentro de la cara: el imán lleva al vértice.
  await clicMundo(page, V(19, 39, 20));
  await clicMundo(page, V(-19, 39, 20));
  let m = await medidas(page);
  expect(m.length).toBe(1);
  expect(m[0].mm).toBeCloseTo(40, 1);
  await clicMundo(page, V(19, 40, 19));
  await clicMundo(page, V(-19, 40, -19));
  m = await medidas(page);
  expect(m[1].mm).toBeCloseTo(56.57, 1);
  // ejes del usuario: Z es altura; la diagonal de la cara superior no tiene ΔZ.
  expect(Math.abs(m[1].delta[2])).toBeLessThan(0.01);
  expect(Math.abs(m[1].delta[0])).toBeCloseTo(40, 1);
  expect(Math.abs(m[1].delta[1])).toBeCloseTo(40, 1);
  // Diagonal del cubo: la esquina opuesta queda oculta; se cambia la cámara a "bajo" entre los dos clics.
  await clicMundo(page, V(19, 40, 19));
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('bottom'));
  await page.waitForTimeout(1200);
  // 0,5 mm hacia dentro: con el panel de Medir más angosto el encuadre desde abajo agranda el cubo y
  // 1 mm en diagonal ya supera los 14 px del imán.
  await clicMundo(page, V(-19.5, 0, -19.5));
  m = await medidas(page);
  expect(m[2].mm).toBeCloseTo(69.28, 1);
  expect(Math.abs(m[2].delta[2])).toBeCloseTo(40, 1);
  await page.screenshot({ path: SHOTS + '/a1-medir-dist.png' });
  expect(await hist(page)).toEqual(h0);
  expect(errs).toEqual([]);
});

test('imanes (vértice, punto medio, centro de cara), Alt los desactiva, Escape y clic derecho cancelan', async ({ page }) => {
  await abrir(page);
  await cubo(page);
  await mover(page, V(19, 39, 20));
  expect((await hover(page)).kind).toBe('vertex');
  await mover(page, V(1, 39.5, 20));
  const mid = await hover(page);
  expect(mid.kind).toBe('edge-mid');
  expect(mid.point[0]).toBeCloseTo(0, 3);
  await mover(page, V(1, 40, 1));
  const c = await hover(page);
  expect(['face-center']).toContain(c.kind);
  await mover(page, V(19, 39, 20), true);
  const raw = await hover(page);
  expect(raw.kind).toBe('surface');
  // Escape cancela el punto en curso
  await clicMundo(page, V(19, 39, 20));
  expect(await page.evaluate(() => (window as any).__m.getState().pending.length)).toBe(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__m.getState().pending.length)).toBe(0);
  expect(await page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('measure');
  // Clic derecho cancela
  await clicMundo(page, V(19, 39, 20));
  const px = await page.evaluate(() => 0);
  void px;
  await page.mouse.click(700, 420, { button: 'right' });
  expect(await page.evaluate(() => (window as any).__m.getState().pending.length)).toBe(0);
  // Alt: el punto no se pega al vértice
  await clicMundo(page, V(19, 39, 20), { alt: true });
  await clicMundo(page, V(-19, 39, 20), { alt: true });
  const m = await medidas(page);
  expect(m[0].mm).not.toBeCloseTo(40, 1);
});

test('ángulo de tres puntos 90° y área de una cara 1600 mm²; borrar una y todas', async ({ page }) => {
  await abrir(page);
  await cubo(page);
  await page.getByRole('button', { name: 'Ángulo', exact: true }).click();
  await clicMundo(page, V(-19, 39, 20));
  await clicMundo(page, V(19, 39, 20));
  await clicMundo(page, V(19, 40, -19));
  let m = await medidas(page);
  expect(m[0].deg).toBeCloseTo(90, 1);
  await page.getByRole('button', { name: 'Área', exact: true }).click();
  await clicMundo(page, V(5, 40, 5));
  m = await medidas(page);
  expect(m[1].area).toBeCloseTo(1600, 1);
  // Mayús suma otra cara
  await clicMundo(page, V(10, 30, 20), { shift: true });
  m = await medidas(page);
  expect(m[1].area).toBeCloseTo(3200, 1);
  expect(m[1].regions).toBe(2);
  await page.screenshot({ path: SHOTS + '/a3-area.png' });
  // Borrar una
  await page.getByTestId('measure-list').getByRole('button').nth(1).click();
  expect((await medidas(page)).length).toBe(1);
  await page.getByRole('button', { name: /Borrar todas/i }).click();
  expect((await medidas(page)).length).toBe(0);
});
