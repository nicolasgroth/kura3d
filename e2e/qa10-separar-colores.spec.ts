/**
 * @file e2e/qa10-separar-colores.spec.ts
 * @description QA10: "Separar por colores" entrega sólidos cerrados cuya suma de volúmenes es la del original (cubo y placa de
 * 1,5 mm); el corte por plano nombra A (lado −) y B (lado +); el resumen previo de Dividir coincide con el resultado.
 * Usa el store del servidor de desarrollo (import dinámico de /src). Requiere `@playwright/test` y la web en KURA_URL
 * (por defecto http://127.0.0.1:5206).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5206/';

async function abrir(page: Page) {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await page.evaluate(() => {
    (window as any).__an = (o: any) => {
      const p = o.mesh.positions, ix = o.mesh.indices, key = new Map<string, number>();
      const id = (i: number) => { const k = [0, 1, 2].map((a) => Math.round(p[3 * i + a] * 1e4)).join(','); if (!key.has(k)) key.set(k, key.size); return key.get(k)!; };
      const bal = new Map<string, number>(), cnt = new Map<string, number>(); let vol = 0;
      for (let t = 0; t < ix.length / 3; t++) {
        const a = ix[3 * t], b = ix[3 * t + 1], c = ix[3 * t + 2], ids = [id(a), id(b), id(c)];
        const A = [p[3 * a], p[3 * a + 1], p[3 * a + 2]], B = [p[3 * b], p[3 * b + 1], p[3 * b + 2]], C = [p[3 * c], p[3 * c + 1], p[3 * c + 2]];
        vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
        if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
        for (let k = 0; k < 3; k++) {
          const u = ids[k], v = ids[(k + 1) % 3], kk = u < v ? `${u}_${v}` : `${v}_${u}`;
          bal.set(kk, (bal.get(kk) ?? 0) + (u < v ? 1 : -1)); cnt.set(kk, (cnt.get(kk) ?? 0) + 1);
        }
      }
      return { name: o.name, vol, open: [...bal.values()].filter((v) => v !== 0).length + [...cnt.values()].filter((v) => v !== 2).length };
    };
  });
}

async function crearCubo(page: Page, dims: [string, string][]) {
  await page.getByRole('button', { name: 'Cubo', exact: true }).click();
  for (const [n, v] of dims) { const t = page.getByRole('textbox', { name: n, exact: true }).first(); await t.fill(v); await t.press('Enter'); }
  await page.waitForTimeout(500);
}

async function colorear(page: Page, umbralY: number) {
  await page.evaluate((u) => {
    const s = (window as any).__s, st = s.getState(), o = st.objects[0], p = o.mesh.positions, ix = o.mesh.indices, fc: string[] = [];
    for (let t = 0; t < ix.length / 3; t++) {
      const cy = (p[3 * ix[3 * t] + 1] + p[3 * ix[3 * t + 1] + 1] + p[3 * ix[3 * t + 2] + 1]) / 3;
      fc.push(cy > u ? '#f97316' : '#22c55e');
    }
    s.setState({ objects: st.objects.map((x: any, i: number) => (i === 0 ? { ...x, mesh: { ...x.mesh, faceColors: fc } } : x)) });
  }, umbralY);
}

for (const [titulo, dims, umbral] of [
  ['cubo 40x40x20 mitad superior', [['Ancho', '40'], ['Fondo', '40'], ['Alto', '20']], 10],
  ['placa de 1,5 mm', [['Ancho', '40'], ['Fondo', '40'], ['Alto', '1.5']], 0.75],
] as [string, [string, string][], number][]) {
  test(`separar por colores: ${titulo} da sólidos cerrados y conserva el volumen`, async ({ page }) => {
    await abrir(page);
    await crearCubo(page, dims);
    const volOriginal = await page.evaluate(() => (window as any).__s.getState().objects[0].stats.volumeMm3);
    await colorear(page, umbral);
    await page.getByRole('button', { name: 'Separar por colores' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Separar por colores' }).click();
    await page.waitForFunction(() => (window as any).__s.getState().objects.length === 2, null, { timeout: 30000 });
    const r = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => (window as any).__an(o)));
    for (const x of r) { expect(x.open, `${x.name} abierta`).toBe(0); expect(x.vol).toBeGreaterThan(0); }
    expect(r.reduce((a: number, x: any) => a + x.vol, 0)).toBeCloseTo(volOriginal, 0);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).first().click();
    await page.waitForFunction(() => (window as any).__s.getState().objects.length === 1);
  });
}

test('corte por plano: mitad A es el lado − y B el lado + en X', async ({ page }) => {
  await abrir(page);
  await crearCubo(page, []);
  await page.getByRole('button', { name: 'Corte por plano + uniones' }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('combobox').nth(0).selectOption({ label: 'X (vertical)' });
  await d.getByRole('combobox').nth(1).selectOption({ label: 'Sin conectores (corte limpio)' });
  const o = d.getByRole('textbox').first(); await o.fill('5'); await o.press('Tab');
  await d.getByRole('button', { name: 'Ejecutar Corte' }).click();
  await page.waitForFunction(() => (window as any).__s.getState().objects.length === 2, null, { timeout: 30000 });
  const r = await page.evaluate(() => (window as any).__s.getState().objects.map((x: any) => ({ n: x.name, w: x.stats.dimensionsMm[0] })));
  expect(r.find((x: any) => /mitad A/.test(x.n)).w).toBeCloseTo(20, 1);
  expect(r.find((x: any) => /mitad B/.test(x.n)).w).toBeCloseTo(10, 1);
});
