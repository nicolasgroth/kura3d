/**
 * @file e2e/ux-escena-importar.spec.ts
 * @description Importación: un STL con varios cuerpos sueltos avisa y "Separar cuerpos" los separa; una
 * malla pesada (≥ 300 000 triángulos) ofrece "Simplificar…"; la barra de progreso trae Cancelar y
 * cancelar no agrega nada. Ejecuta con `npm run test:e2e`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';

const cuenta = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.length);

/** STL binario con `tris` triángulos sueltos de una rejilla (soup, sin cuerpos cerrados). */
function stlBinario(tris: number): Buffer {
  const buf = Buffer.alloc(84 + tris * 50);
  buf.writeUInt32LE(tris, 80);
  const side = Math.ceil(Math.sqrt(tris / 2));
  let off = 84;
  for (let t = 0; t < tris; t++) {
    const cell = t >> 1;
    const x = (cell % side) * 0.2;
    const y = Math.floor(cell / side) * 0.2;
    const v = t % 2 === 0
      ? [[x, y, 0], [x + 0.2, y, 0], [x, y + 0.2, 0]]
      : [[x + 0.2, y, 0], [x + 0.2, y + 0.2, 0], [x, y + 0.2, 0]];
    off += 12;
    for (const p of v) for (const c of p) { buf.writeFloatLE(c, off); off += 4; }
    off += 2;
  }
  return buf;
}

test('STL con dos cuerpos sueltos: aviso con "Separar cuerpos" que los separa', async ({ page }) => {
  await abrir(page);
  await importarStl(page, 'dos.stl', stlCubes([[0, 10, 0], [60, 10, 0]], 20));
  await expect.poll(() => cuenta(page)).toBe(1);
  await expect(page.getByText(/trae 2 cuerpos separados/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Separar cuerpos' }).first().click();
  await expect.poll(() => cuenta(page)).toBe(2);
});

test('malla pesada: aviso con Simplificar', async ({ page }) => {
  await abrir(page);
  await importarStl(page, 'pesada.stl', stlBinario(320_000));
  await expect.poll(() => cuenta(page), { timeout: 90_000 }).toBe(1);
  await expect(page.getByRole('button', { name: /Simplificar/ }).first()).toBeVisible();
});

test('cancelar la importación no agrega nada y avisa', async ({ page }) => {
  await abrir(page);
  const before = await cuenta(page);
  const run = page.evaluate(async () => {
    const s = (window as any).__s.getState();
    // Lectura que no termina (disco lento): queda en curso hasta que se cancela.
    const never = () => new Promise<ArrayBuffer>(() => undefined);
    return s.importModelFiles([{ name: 'lento.stl', size: 100, read: never }]);
  });
  const cancel = page.getByRole('button', { name: /Cancelar/ }).first();
  await expect(cancel).toBeVisible({ timeout: 10_000 });
  await cancel.click();
  void run;
  await expect(page.getByText(/Importación cancelada/).first()).toBeVisible();
  expect(await cuenta(page)).toBe(before);
});
