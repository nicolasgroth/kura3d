/**
 * @file e2e/bordes-primitivas.spec.ts
 * @description Bordes de primitivas en la interfaz: un cubo 40 × 30 × 20 con las aristas verticales
 * redondeadas a 5 mm mantiene su tamaño y baja el volumen a h·(ab − (4 − π)·r²) ≈ 23.561 mm³; cada
 * cambio se deshace en un paso; el STL exportado y reimportado conserva el volumen; un radio que no
 * cabe se acota con nota visible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { abrir, importarStl } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

/** Volumen firmado (mm³) de las piezas, calculado sobre la malla del store. */
async function volumenes(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    (window as any).__s.getState().objects.map((o: any) => {
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

const params = (page: Page) => page.evaluate(() => ({ ...(window as any).__s.getState().objects[0]?.primitiveParams }));

async function fijar(insp: ReturnType<Page['getByRole']>, etiqueta: string, valor: string) {
  const campo = insp.locator(`input[aria-label="${etiqueta}"]`).first();
  await campo.scrollIntoViewIfNeeded();
  await campo.fill(valor);
  await campo.press('Enter');
}

test('cubo con verticales redondeadas a 5 mm: tamaño igual, volumen exacto, deshacer y STL de ida y vuelta', async ({ page }) => {
  await abrir(page);
  await agregarForma(page, 'Cubo');
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  await fijar(insp, 'Ancho', '40');
  await fijar(insp, 'Fondo', '30');
  await fijar(insp, 'Alto', '20');
  await expect.poll(() => volumenes(page)).toEqual([24000]);

  const bordes = insp.getByRole('group', { name: 'Bordes' });
  await bordes.getByRole('radio', { name: /Redondeados/ }).click();
  await expect.poll(() => params(page)).toMatchObject({ edgeStyle: 'round' });
  // Alcance por defecto de la caja: solo verticales (sin voladizo en la base).
  await expect(bordes.getByRole('radio', { name: /Solo verticales/ })).toHaveAttribute('aria-checked', 'true');
  await fijar(bordes, 'Radio', '5');
  await expect.poll(() => params(page)).toMatchObject({ edgeStyle: 'round', edgeSize: 5 });

  // Volumen: 20·(40·30 − (4 − π)·25) = 23.571 mm³ para el arco continuo; el polígono da 23.561.
  await expect.poll(() => volumenes(page)).toEqual([23561]);
  await expect(insp.getByText(/40 mm × 30 mm × 20 mm/).first()).toBeVisible();
  await expect(insp.getByText(/23\.560,7 mm³/).first()).toBeVisible();

  // Cada cambio es un paso de deshacer: primero el radio, luego el acabado.
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => params(page)).not.toHaveProperty('edgeSize');
  expect((await params(page)).edgeStyle).toBe('round');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(() => volumenes(page)).toEqual([24000]);
  expect((await params(page)).edgeStyle).toBeUndefined();
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect.poll(() => volumenes(page)).toEqual([23561]);

  // Exporta el STL por el diálogo real y lo reimporta tras vaciar la cama.
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  const ruta = test.info().outputPath('caja-redondeada.stl');
  await (await dl).saveAs(ruta);
  await page.getByRole('button', { name: 'Vaciar cama' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vaciar cama' }).click();
  await importarStl(page, 'caja-redondeada.stl', fs.readFileSync(ruta));
  await expect.poll(() => volumenes(page), { timeout: 20000 }).toEqual([23561]);
});

test('un radio que no cabe se acota con nota visible y la pieza sigue cerrada', async ({ page }) => {
  await abrir(page);
  await agregarForma(page, 'Cubo');
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  for (const l of ['Ancho', 'Fondo', 'Alto']) await fijar(insp, l, '20');
  await expect.poll(() => volumenes(page)).toEqual([8000]);
  const bordes = insp.getByRole('group', { name: 'Bordes' });
  await bordes.getByRole('radio', { name: /Achaflanados/ }).click();
  await fijar(bordes, 'Chaflán', '15');
  const nota = bordes.getByTestId('params-edges-clamped');
  await expect(nota).toBeVisible();
  // Cubo de 20 mm: el chaflán vertical cabe hasta 10 mm menos el margen (coma decimal en español; se
  // muestra truncado para no decir «10» cuando no cabe 10).
  await expect(nota).toContainText('Se aplicó 9,99 mm');
  await expect(nota).toContainText('pediste 15 mm');
  const closed = await page.evaluate(() => (window as any).__s.getState().objects[0].stats.isManifold);
  expect(closed).toBe(true);
  // Volumen exacto del chaflán al tope: 20·(20·20 − 2·c²).
  const c = 10 - 0.005;
  await expect.poll(() => volumenes(page)).toEqual([Math.round(20 * (400 - 2 * c * c))]);
});
