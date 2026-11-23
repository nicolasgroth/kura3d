/**
 * @file e2e/qa18-unidades.spec.ts
 * @description Unidades dudosas: un STL sintético de 0,9 mm de lado (como los exportados en unidades
 * normalizadas) debe avisar que es diminuto y ofrecer "Escalar ×100"; aplicarlo deja ~90 mm y un solo
 * Deshacer lo revierte (Rehacer lo reaplica). Ejecuta con
 * `KURA_URL=http://127.0.0.1:5236/ npx playwright test e2e/qa18-*.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5236/';

function cuboStl(lado: number): string {
  const h = lado / 2;
  const L = ['solid c'];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const t of [[a, b, c], [a, c, d]]) {
      L.push('facet normal 0 0 0', 'outer loop');
      for (const v of t) L.push(`vertex ${v[0]} ${v[1]} ${v[2]}`);
      L.push('endloop', 'endfacet');
    }
  };
  const p = (x: number, y: number, z: number) => [x * h, y * h, z * h];
  quad(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1));
  quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
  quad(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1));
  quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
  quad(p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1));
  L.push('endsolid c');
  return L.join('\n');
}

test('STL diminuto: avisa, ofrece escalar ×100 y Deshacer lo revierte en un paso', async ({ page }) => {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  const ch = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  (await ch).setFiles({ name: 'diminuto.stl', mimeType: 'model/stl', buffer: Buffer.from(cuboStl(0.9)) });
  const escala = () => page.evaluate(() => (window as any).__s.getState().objects[0]?.scale[0] ?? -1);
  await expect(page.getByText(/mide 0,9 mm en su lado mayor/).first()).toBeVisible({ timeout: 30000 });
  const btn = page.getByRole('button', { name: 'Escalar ×100' }).first();
  await expect(btn).toBeVisible();
  await btn.click();
  await expect.poll(escala).toBeGreaterThan(50);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(escala).toBeLessThan(2);
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect.poll(escala).toBeGreaterThan(50);
});
