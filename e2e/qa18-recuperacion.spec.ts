/**
 * @file e2e/qa18-recuperacion.spec.ts
 * @description Borrador de recuperación con escena sintética (tres piezas, un grupo): el pie indica
 * "Borrador local guardado", se mueve una pieza, se recarga la pestaña y "Recuperar" restaura piezas, grupo y
 * posición movida. Ejecuta con `KURA_URL=http://127.0.0.1:5236/ npx playwright test e2e/qa18-*.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5236/';

test('recargar y recuperar el borrador restaura piezas, grupo y posición', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  const movida = await page.evaluate(async () => {
    const st = () => (window as any).__s.getState();
    const a = (await st().createPrimitive('box', undefined, { name: 'Pieza A', position: [-40, 0, 0] })).id;
    const b = (await st().createPrimitive('sphere', undefined, { name: 'Pieza B', position: [0, 0, 0] })).id;
    await st().createPrimitive('cone', undefined, { name: 'Pieza C', position: [40, 0, 0] });
    st().groupObjects([a, b], 'Mi grupo');
    st().setObjectTransform(a, { position: [-55, 0, 7] });
    return st().objects.find((o: any) => o.id === a).position;
  });
  await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 30000 });

  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(3);
  const r = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    return { grupos: s.groups.map((g: any) => g.name), a: s.objects.find((o: any) => o.name === 'Pieza A').position };
  });
  expect(r.grupos).toEqual(['Mi grupo']);
  expect(r.a[0]).toBeCloseTo(movida[0], 3);
  expect(r.a[2]).toBeCloseTo(movida[2], 3);
});
