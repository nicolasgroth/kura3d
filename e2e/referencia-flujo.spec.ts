/**
 * @file e2e/referencia-flujo.spec.ts
 * @description Objetos de referencia en la web real: importar un STL sintético con «Importar como
 * referencia…», el pie no la cuenta, un cubo nuevo puede ir donde está, exportar STL y 3MF de escena
 * completa no la incluyen (triángulos del archivo), Aplicar restas la ignora, convertirla a sólido y de
 * vuelta es un paso de deshacer cada vez, y el borrador tras recargar la conserva con su opacidad.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5245/ npx playwright test e2e/referencia-flujo.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { abrir, stlCubes } from './ux-escena-helpers';

const state = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  return s.objects.map((o: any) => ({
    id: o.id, name: o.name, role: o.role, opacity: o.referenceOpacity, x: o.position[0], z: o.position[2],
    tris: o.mesh.indices.length / 3,
  }));
});

async function exportar(page: Page, format: 'STL' | '3MF', fileName: string): Promise<Buffer> {
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: new RegExp(`^${format}`) }).check();
  if (format === '3MF') await dlg.getByRole('radio', { name: /Escena completa/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  const path = test.info().outputPath(fileName);
  await (await dl).saveAs(path);
  return fs.readFileSync(path);
}

test('referencia: importar, no contar, no ocupar cama, no exportar, no restar, deshacer y recuperar', async ({ page }) => {
  test.setTimeout(180_000);
  page.on('dialog', (d) => void d.accept());
  await abrir(page);

  // 1. Importar como referencia desde el menú Importar (selector real de archivos).
  await page.getByRole('button', { name: 'Opciones de importación' }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar como referencia…' }).click();
  await (await chooser).setFiles({ name: 'placa.stl', mimeType: 'model/stl', buffer: Buffer.from(stlCubes([[0, 0, 0]], 60)) });
  await expect.poll(async () => (await state(page)).map((o: any) => o.role)).toEqual(['reference']);
  const ref = (await state(page))[0];
  // El árbol la nombra como Referencia (texto accesible) y el pie no la cuenta como objeto.
  await expect(page.getByTestId('status-count')).toContainText('0 objs');
  await expect(page.getByTestId('status-count')).toContainText('1 referencia');

  // 2. Un cubo nuevo puede ir donde está la referencia (no ocupa cama).
  const cubeId = await page.evaluate(async () => (await (window as any).__s.getState().createPrimitive(
    'box', { width: 10, height: 10, depth: 10 }, { name: 'Cubo', placement: 'free' }))?.id);
  const cube = (await state(page)).find((o: any) => o.id === cubeId);
  expect(Math.abs(cube.x - ref.x)).toBeLessThan(31);
  expect(Math.abs(cube.z - ref.z)).toBeLessThan(31);
  await expect(page.getByTestId('status-count')).toContainText('1 objs');

  // 3. Exportar STL y 3MF de escena completa: solo los 12 triángulos del cubo.
  const stl = await exportar(page, 'STL', 'escena.stl');
  expect(stl.readUInt32LE(80)).toBe(12);
  const model = strFromU8(unzipSync(new Uint8Array(await exportar(page, '3MF', 'escena.3mf')))['3D/3dmodel.model']);
  expect((model.match(/<object /g) ?? []).length).toBe(1);
  expect((model.match(/<triangle /g) ?? []).length).toBe(12);

  // 4. Aplicar restas ignora la referencia aunque el negativo la toque.
  await page.evaluate(async () => {
    const st = () => (window as any).__s.getState();
    await st().createPrimitive('box', { width: 4, height: 30, depth: 4 }, { name: 'Taladro', role: 'negative', position: st().objects[1].position });
    await st().applyHolesOnSolids();
  });
  const afterHoles = await state(page);
  expect(afterHoles.find((o: any) => o.id === ref.id)).toMatchObject({ role: 'reference', tris: ref.tris });
  expect(afterHoles.some((o: any) => o.role === 'negative')).toBe(false);

  // 5. Convertir a sólido y de vuelta desde el inspector: un paso de deshacer cada vez.
  await page.evaluate((id) => (window as any).__s.getState().selectObject(id), ref.id);
  const tipo = page.getByRole('group', { name: 'Tipo de volumen' });
  await tipo.getByRole('button', { name: 'Sólido' }).click();
  await expect.poll(async () => (await state(page)).find((o: any) => o.id === ref.id).role).toBe('solid');
  await tipo.getByRole('button', { name: 'Referencia' }).click();
  await expect.poll(async () => (await state(page)).find((o: any) => o.id === ref.id).role).toBe('reference');
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect((await state(page)).find((o: any) => o.id === ref.id).role).toBe('solid');
  await page.evaluate(() => (window as any).__s.getState().redo());
  expect((await state(page)).find((o: any) => o.id === ref.id).role).toBe('reference');

  // 6. Opacidad propia y borrador tras recargar.
  await page.evaluate((id) => (window as any).__s.getState().updateObjectMeta(id, { referenceOpacity: 0.6 }), ref.id);
  await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 30000 });
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await expect.poll(async () => (await state(page)).find((o: any) => o.name === ref.name)?.role, { timeout: 30000 }).toBe('reference');
  expect((await state(page)).find((o: any) => o.name === ref.name).opacity).toBe(0.6);
});
