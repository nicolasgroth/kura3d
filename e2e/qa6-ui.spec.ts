/**
 * @file e2e/qa6-ui.spec.ts
 * @description Recorridos Playwright del QA del lote "Z como altura + dividir/armado": medidas de un STL 10×20×30,
 * corte por plano con "mitad positiva" en cada eje (sobre el STL exportado), resumen de división en los ejes del usuario
 * y persistencia de avisos de unión al guardar/reabrir `.kura`. Los fallos que documentaban las marcas `test.fail`
 * (corte en Y, resumen en ejes del motor, avisos que se perdían al reabrir) están corregidos y se cubren además con vitest.
 * Requiere `@playwright/test` y la web en KURA_URL (por defecto http://127.0.0.1:5189).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5189/';

/** STL binario de una caja `x × y × z` con una esquina en el origen. */
function boxStl(x: number, y: number, z: number): Buffer {
  const v = [[0, 0, 0], [x, 0, 0], [x, y, 0], [0, y, 0], [0, 0, z], [x, 0, z], [x, y, z], [0, y, z]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const buf = Buffer.alloc(84 + 50 * f.length);
  buf.writeUInt32LE(f.length, 80);
  f.forEach((t, i) => {
    let o = 84 + 50 * i + 12;
    t.forEach((k) => v[k].forEach((c) => { buf.writeFloatLE(c, o); o += 4; }));
  });
  return buf;
}

function bbox(buf: Buffer) {
  const n = buf.readUInt32LE(80);
  const min = [1e9, 1e9, 1e9];
  const max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) {
    const o = 84 + 50 * i + 12;
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) {
      const val = buf.readFloatLE(o + 12 * k + 4 * c);
      min[c] = Math.min(min[c], val);
      max[c] = Math.max(max[c], val);
    }
  }
  return { min: min.map((q) => Math.round(q * 100) / 100), max: max.map((q) => Math.round(q * 100) / 100) };
}

async function importar(page: Page, name: string, buf: Buffer) {
  await page.evaluate(async ({ n, b64 }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], n));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { n: name, b64: buf.toString('base64') });
  await expect(page.locator('footer')).toContainText('1 objs');
}

async function exportarStl(page: Page, dir: string) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  await page.getByRole('radio', { name: /STL/ }).check();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button[type=submit]').filter({ hasText: /\.stl/ }).click(),
  ]);
  const path = `${dir}/export.stl`;
  await dl.saveAs(path);
  return bbox(fs.readFileSync(path));
}

test('un STL de 10×20×30 mide eso en el inspector y al exportarlo', async ({ page }, info) => {
  await page.goto(URL);
  await importar(page, 'caja.stl', boxStl(10, 20, 30));
  await expect(page.getByText('10 mm × 20 mm × 30 mm').first()).toBeVisible();
  const b = await exportarStl(page, info.outputDir);
  expect(b.max[0] - b.min[0]).toBeCloseTo(10, 1);
  expect(b.max[1] - b.min[1]).toBeCloseTo(20, 1);
  expect(b.max[2] - b.min[2]).toBeCloseTo(30, 1);
  expect(b.min[2]).toBeCloseTo(0, 1);
});

for (const [axis, label, idx] of [['X', 'X (vertical)', 0], ['Y', 'Y (vertical)', 1], ['Z', 'Z (horizontal)', 2]] as const) {
  test(`corte por plano eje ${axis}: "solo mitad positiva" conserva el lado + del eje`, async ({ page }, info) => {
    // Fallo conocido: en Y conserva la mitad con Y negativa.
    await page.goto(URL);
    await importar(page, 'caja.stl', boxStl(10, 20, 30));
    await page.getByRole('button', { name: 'Corte por plano + uniones' }).first().click();
    await page.locator('#cut-axis').selectOption({ label });
    await page.locator('#cut-conn').selectOption({ index: 0 });
    await page.locator('#cut-keep').selectOption({ label: 'Solo mitad positiva (+)' });
    // Solo el corte horizontal deja la mitad flotando: ahí el diálogo pregunta dónde dejarla y se elige
    // "donde está" para comprobar el lado conservado. Los cortes verticales apoyan en la cama sin preguntar.
    if (idx === 2) await page.getByRole('radio', { name: /^Dejarla donde está/ }).check();
    else await expect(page.getByRole('radio', { name: /^Dejarla donde está/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ejecutar Corte' }).click();
    await expect(page.locator('footer')).toContainText('1 objs');
    const b = await exportarStl(page, info.outputDir);
    const mid = idx === 2 ? 15 : 0;
    expect(b.min[idx]).toBeGreaterThanOrEqual(mid - 0.01);
  });

  test(`corte por plano eje ${axis}: "solo mitad positiva" apoyada en la cama queda en Z=0 con la misma forma`, async ({ page }, info) => {
    test.skip(idx !== 2, 'Solo el corte horizontal pregunta dónde dejar la mitad; los verticales ya quedan apoyados.');
    await page.goto(URL);
    await importar(page, 'caja.stl', boxStl(10, 20, 30));
    await page.getByRole('button', { name: 'Corte por plano + uniones' }).first().click();
    await page.locator('#cut-axis').selectOption({ label });
    await page.locator('#cut-conn').selectOption({ index: 0 });
    await page.locator('#cut-keep').selectOption({ label: 'Solo mitad positiva (+)' });
    await page.getByRole('radio', { name: /^(✓ )?Apoyarla en la cama/ }).check();
    await page.getByRole('button', { name: 'Ejecutar Corte' }).click();
    await expect(page.locator('footer')).toContainText('1 objs');
    const b = await exportarStl(page, info.outputDir);
    // Apoyada: la base queda en Z=0 (en el STL exportado, Z del usuario = eje 2).
    expect(b.min[2]).toBeCloseTo(0, 1);
    // Misma forma que la mitad conservada: la dimensión cortada se reduce a la mitad.
    const dims = [10, 20, 30];
    const size = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
    const cortada = [...size].sort((a, c) => a - c);
    const esperado = [...dims.map((d, i) => (i === idx ? d / 2 : d))].sort((a, c) => a - c);
    cortada.forEach((v, i) => expect(v).toBeCloseTo(esperado[i], 1));
  });
}

test('resumen de dividir muestra rejilla y medidas en los ejes del usuario (Z = altura)', async ({ page }) => {
  await page.goto(URL);
  await importar(page, 'poste.stl', boxStl(100, 100, 600));
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await page.getByLabel('Permitir acostar piezas').uncheck();
  const dlg = page.locator('[role=dialog]').filter({ hasText: 'Dividir para imprimir' }).first();
  await expect(dlg).toContainText('rejilla 1 × 1 × 3');
});

test('guardar y reabrir .kura conserva los avisos de las uniones', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(URL);
  await page.evaluate(() => {
    const w = window as unknown as { __saved: Blob | null; showSaveFilePicker: unknown };
    w.__saved = null;
    w.showSaveFilePicker = async () => ({
      name: 'p.kura',
      createWritable: async () => {
        const parts: Blob[] = [];
        return { write: async (d: BlobPart) => { parts.push(new Blob([d])); }, close: async () => { w.__saved = new Blob(parts); }, abort: async () => {} };
      },
    });
  });
  await importar(page, 'cubo.stl', boxStl(440, 440, 440));
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await page.getByLabel('Tipo de conector').selectOption({ label: 'Tarugo suelto (se imprime aparte)' });
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect(page.getByText(/Uniones \(12\)/i)).toBeVisible({ timeout: 30000 });
  const antes = await page.getByText('Kurra Studio dejó esta unión para pegar').count();
  expect(antes).toBeGreaterThan(0);
  await page.keyboard.press('Control+s');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __saved: Blob | null }).__saved?.size ?? 0)).toBeGreaterThan(0);
  const b64 = await page.evaluate(async () => {
    const buf = new Uint8Array(await (window as unknown as { __saved: Blob }).__saved.arrayBuffer());
    let s = '';
    for (const c of buf) s += String.fromCharCode(c);
    return btoa(s);
  });
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor();
  await page.evaluate(async (data) => {
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], 'p.kura'));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await page.keyboard.press('Control+a');
  await expect(page.getByText(/Uniones \(12\)/i)).toBeVisible({ timeout: 30000 });
  expect(await page.getByText('Kurra Studio dejó esta unión para pegar').count()).toBe(antes);
});
