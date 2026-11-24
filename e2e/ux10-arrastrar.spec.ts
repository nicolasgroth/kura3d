/**
 * @file e2e/ux10-arrastrar.spec.ts
 * @description Arrastrar un objeto ya seleccionado lo mueve sobre el plano horizontal (ratón real): objeto apoyado,
 * elevado, varios, bloqueado, Escape, un solo paso de deshacer, arrastre sobre un objeto no seleccionado (orbita),
 * clic sin arrastre y rejilla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];

/** Crea cubos de 30 mm en las posiciones dadas (Y = altura) y devuelve sus ids. */
async function escena(page: Page, posiciones: P3[], snap = 0): Promise<string[]> {
  await abrir(page);
  return page.evaluate(
    async ({ posiciones: pos, snap: paso }) => {
      const s = () => (window as any).__s.getState();
      const ids: string[] = [];
      for (const p of pos) {
        const o = await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: p });
        ids.push(o.id);
      }
      s().setSnapGridMm(paso);
      s().setActiveTool('select');
      s().setTransformMode('translate');
      s().setSelection([]);
      s().dismissAllToasts();
      return ids;
    },
    { posiciones, snap },
  );
}

const pos = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position as P3, id);
const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length as number);
const seleccionar = (page: Page, ids: string[]) =>
  page.evaluate((i) => (window as any).__s.getState().setSelection(i), ids);

/** Arrastra con el botón principal desde el centro (en pantalla) de `desde` hasta un desplazamiento en píxeles. */
async function arrastrar(page: Page, desde: P3, dx: number, dy: number, soltar = true) {
  const a = await aPixel(page, desde);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + dx * 0.3, a.y + dy * 0.3, { steps: 3 });
  await page.mouse.move(a.x + dx, a.y + dy, { steps: 6 });
  if (soltar) await page.mouse.up();
  return a;
}

test('objeto apoyado: sigue el cursor, no cambia la altura y es un solo paso de deshacer', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await seleccionar(page, [a]);
  const antes = await pasos(page);
  await arrastrar(page, [0, 15, 0], 90, 40);
  const p = await pos(page, a);
  expect(Math.hypot(p[0], p[2])).toBeGreaterThan(10);
  expect(p[1]).toBeCloseTo(15, 5);
  expect(await pasos(page)).toBe(antes + 1);
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect(await pos(page, a)).toEqual([0, 15, 0]);
});

test('objeto elevado: se mueve en su plano horizontal sin caer a la cama', async ({ page }) => {
  const [a] = await escena(page, [[0, 80, 0]]);
  await seleccionar(page, [a]);
  const p0 = await aPixel(page, [0, 80, 0]);
  await arrastrar(page, [0, 80, 0], 70, 30);
  const p = await pos(page, a);
  expect(p[1]).toBeCloseTo(80, 5);
  expect(Math.hypot(p[0], p[2])).toBeGreaterThan(10);
  // El objeto queda aproximadamente bajo el cursor (el agarre no salta al empezar).
  const p1 = await aPixel(page, p);
  expect(Math.hypot(p1.x - (p0.x + 70), p1.y - (p0.y + 30))).toBeLessThan(25);
});

test('varios seleccionados se mueven juntos; los bloqueados no', async ({ page }) => {
  const [a, b, c] = await escena(page, [[-70, 15, 0], [0, 15, 0], [70, 15, 40]]);
  await page.evaluate(([id]) => (window as any).__s.getState().updateObjectMeta(id, { locked: true }), [c]);
  await seleccionar(page, [a, b, c]);
  await arrastrar(page, [0, 15, 0], 0, 80);
  const [pa, pb, pc] = [await pos(page, a), await pos(page, b), await pos(page, c)];
  expect(pc).toEqual([70, 15, 40]);
  expect(Math.abs(pb[2])).toBeGreaterThan(10);
  expect(pa[0] + 70).toBeCloseTo(pb[0], 3);
  expect(pa[2]).toBeCloseTo(pb[2], 3);
});

test('todos bloqueados: no hay arrastre y se avisa', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await page.evaluate(([id]) => (window as any).__s.getState().updateObjectMeta(id, { locked: true }), [a]);
  await seleccionar(page, [a]);
  await arrastrar(page, [0, 15, 0], 80, 20);
  expect(await pos(page, a)).toEqual([0, 15, 0]);
  await expect(page.getByText('Los objetos seleccionados están bloqueados').first()).toBeVisible();
});

test('Escape cancela y devuelve la posición inicial sin pasos de deshacer', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await seleccionar(page, [a]);
  const antes = await pasos(page);
  const px = await arrastrar(page, [0, 15, 0], 80, 30, false);
  expect(Math.hypot(...(await pos(page, a)).map((v, i) => (i === 1 ? 0 : v)))).toBeGreaterThan(5);
  await page.keyboard.press('Escape');
  await page.mouse.move(px.x + 140, px.y + 60, { steps: 4 });
  await page.mouse.up();
  expect(await pos(page, a)).toEqual([0, 15, 0]);
  expect(await pasos(page)).toBe(antes);
});

test('arrastrar un objeto no seleccionado orbita la cámara y no lo mueve', async ({ page }) => {
  const [a, b] = await escena(page, [[-60, 15, 0], [60, 15, 0]]);
  await seleccionar(page, [a]);
  const cam = () => page.evaluate(() => (window as any).__r3f.getState().camera.position.toArray() as number[]);
  const c0 = await cam();
  await arrastrar(page, [60, 15, 0], 90, 10);
  await page.waitForTimeout(300);
  const c1 = await cam();
  expect(Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2])).toBeGreaterThan(5);
  expect(await pos(page, b)).toEqual([60, 15, 0]);
});

test('clic sin arrastre sobre uno de varios seleccionados lo deja como único seleccionado', async ({ page }) => {
  const [a, b] = await escena(page, [[-60, 15, 0], [60, 15, 0]]);
  await seleccionar(page, [a, b]);
  const px = await aPixel(page, [60, 15, 0]);
  await page.mouse.move(px.x, px.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__s.getState().selectedIds)).toEqual([b]);
  expect(await pos(page, b)).toEqual([60, 15, 0]);
});

test('respeta el paso de la rejilla elegido', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]], 5);
  await seleccionar(page, [a]);
  await arrastrar(page, [0, 15, 0], 83, 37);
  const p = await pos(page, a);
  expect(Math.abs(p[0] % 5)).toBeCloseTo(0, 5);
  expect(Math.abs(p[2] % 5)).toBeCloseTo(0, 5);
  expect(Math.hypot(p[0], p[2])).toBeGreaterThan(10);
});

test('no se activa con la herramienta Pintar', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await seleccionar(page, [a]);
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('paint'));
  await arrastrar(page, [0, 15, 0], 80, 30);
  expect(await pos(page, a)).toEqual([0, 15, 0]);
});
