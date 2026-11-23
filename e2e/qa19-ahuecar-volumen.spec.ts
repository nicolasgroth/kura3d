/**
 * @file e2e/qa19-ahuecar-volumen.spec.ts
 * @description QA19: ahuecar por la interfaz baja el volumen de verdad (cubo 40 mm, pared 2 -> 17.344 mm³), el STL exportado y reimportado conserva el volumen, y una pared mayor que la pieza falla con error claro dejando la pieza intacta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { abrir, importarStl } from './ux-escena-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** Volumen firmado (mm³) de las piezas sólidas, calculado sobre la malla del store. */
async function volumenFirmado(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    (window as any).__s.getState().objects.filter((o: any) => o.role === 'solid').map((o: any) => {
      const P = o.mesh.positions, I = o.mesh.indices;
      let v = 0;
      for (let i = 0; i < I.length; i += 3) {
        const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
        v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      }
      return Math.round(v * o.scale[0] * o.scale[1] * o.scale[2]);
    }),
  );
}

async function cuboDe(page: Page, lado: string) {
  await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  for (const l of ['Ancho', 'Fondo', 'Alto']) {
    const t = insp.locator(`input[aria-label="${l}"]`).first();
    await t.fill(lado);
    await t.press('Enter');
  }
  return insp;
}

test('ahuecar un cubo de 40 mm con pared 2: volumen exacto y sobrevive a exportar + reimportar', async ({ page }) => {
  await abrir(page);
  const insp = await cuboDe(page, '40');
  const pared = insp.locator('input[aria-label="Grosor de pared"]').first();
  await pared.scrollIntoViewIfNeeded();
  await pared.fill('2');
  await pared.press('Enter');
  await insp.getByRole('button', { name: /Aplicar ahuecado/ }).click();
  await expect(insp.getByText(/17\.344/)).toBeVisible({ timeout: 20000 });
  expect(await volumenFirmado(page)).toEqual([17344]);

  // Exporta el STL por el diálogo real y lo reimporta tras vaciar la cama.
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  const ruta = test.info().outputPath('hueco.stl');
  await (await dl).saveAs(ruta);
  await page.getByRole('button', { name: 'Vaciar cama' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vaciar cama' }).click();
  await importarStl(page, 'hueco.stl', fs.readFileSync(ruta));
  await expect.poll(() => volumenFirmado(page), { timeout: 20000 }).toEqual([17344]);
});

test('ahuecar con una pared igual a la mitad de la pieza da error claro y no toca la pieza', async ({ page }) => {
  await abrir(page);
  const insp = await cuboDe(page, '20');
  const pared = insp.locator('input[aria-label="Grosor de pared"]').first();
  await pared.scrollIntoViewIfNeeded();
  await pared.fill('10');
  await pared.press('Enter');
  await insp.getByRole('button', { name: /Aplicar ahuecado/ }).click();
  await expect(page.getByText(/no deja cavidad/i).first()).toBeVisible({ timeout: 15000 });
  expect(await volumenFirmado(page)).toEqual([8000]);
});
