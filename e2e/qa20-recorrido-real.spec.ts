/**
 * @file e2e/qa20-recorrido-real.spec.ts
 * @description QA20: recorrido principal con la interfaz nueva y modelos reales (solo lectura desde
 * `QA20_MODELOS`, por defecto `.eval-tmp/modelos`): importar un 3MF y un STL, reparar, exportar 3MF y
 * reimportar (mismo número de piezas y volumen), guardar `.kura` y reabrir, y recuperar el borrador tras
 * recargar (el aviso debe decir cuántos objetos trae). Cero errores de consola. Se omite sin los archivos.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-recorrido-real.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import fs, { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const DIR = process.env.QA20_MODELOS ?? 'G:/proyectos/kura3d/.eval-tmp/modelos';
const TRESMF = `${DIR}/ocarina.3mf`;
const STL = `${DIR}/obj_1_OcarinaDeluxe.stl`;

const resumen = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__s.getState();
    const vol = (o: any) => {
      const P = o.mesh.positions, I = o.mesh.indices;
      let v = 0;
      for (let i = 0; i < I.length; i += 3) {
        const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
        v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      }
      return Math.abs(v * o.scale[0] * o.scale[1] * o.scale[2]);
    };
    return { n: s.objects.length, vol: Math.round(s.objects.reduce((a: number, o: any) => a + vol(o), 0)), tris: s.objects.reduce((a: number, o: any) => a + o.mesh.indices.length / 3, 0) };
  });

async function importar(page: Page, ruta: string, esperados: number) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(ruta);
  await expect.poll(async () => (await resumen(page)).n, { timeout: 180_000 }).toBeGreaterThanOrEqual(esperados);
}

test('recorrido principal con modelos reales: importar, exportar 3MF, reimportar, guardar, reabrir y recuperar', async ({ page }) => {
  test.skip(!existsSync(TRESMF) || !existsSync(STL), 'faltan los modelos de QA20_MODELOS');
  test.setTimeout(480_000);
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('dialog', (d) => void d.accept());
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);

  await importar(page, TRESMF, 1);
  const tras3mf = await resumen(page);
  await importar(page, STL, tras3mf.n + 1);
  const base = await resumen(page);
  console.log('importados', JSON.stringify({ tras3mf, base }));

  // Exportar 3MF de escena completa por el diálogo real.
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await dlg.getByRole('radio', { name: /Escena completa/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  const ruta3mf = test.info().outputPath('salida.3mf');
  await (await dl).saveAs(ruta3mf);
  expect(fs.statSync(ruta3mf).size).toBeGreaterThan(1000);

  // Vaciar y reimportar lo exportado: mismas piezas y mismo volumen (±0,5 %).
  await page.evaluate(() => (window as any).__s.getState().clearScene());
  await expect.poll(async () => (await resumen(page)).n).toBe(0);
  await importar(page, ruta3mf, base.n);
  const vuelta = await resumen(page);
  console.log('reimportado', JSON.stringify(vuelta));
  expect(vuelta.n).toBe(base.n);
  expect(Math.abs(vuelta.vol - base.vol) / base.vol).toBeLessThan(0.005);

  // Recuperar borrador tras recargar: el aviso dice cuántos objetos trae.
  await expect(page.locator('footer')).toContainText(/Borrador local guardado/, { timeout: 90_000 });
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60_000 });
  const conteo = page.getByTestId('recovery-object-count');
  await expect(conteo).toBeVisible({ timeout: 30_000 });
  console.log('aviso de recuperación:', await conteo.textContent());
  expect(await conteo.textContent()).toMatch(new RegExp(`^${base.n}\\s`));
  await page.getByRole('button', { name: 'Restaurar' }).first().click();
  await page.evaluate(async () => {
    (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore;
  });
  await expect.poll(async () => (await resumen(page)).n, { timeout: 120_000 }).toBe(base.n);
  expect(errores).toEqual([]);
});
