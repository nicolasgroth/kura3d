/**
 * @file e2e/ux6-unidades.spec.ts
 * @description Aviso de unidades con todas las opciones: tras importar un STL de 0,9 mm el aviso trae,
 * además de su botón principal, «Otra unidad…», que abre «¿En qué unidad está este modelo?» con cada
 * unidad probable y su tamaño resultante (coma decimal en español) y «ajustar el lado mayor a N mm».
 * Aplicar es un solo paso de deshacer; un tamaño inválido desactiva Aplicar con un mensaje. El resto de
 * avisos con una acción no cambia. Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-unidades.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux6';

const mayor = (page: Page) =>
  page.evaluate(async () => {
    const { maxDimension } = await import('/src/store/unitRescale.ts');
    return maxDimension((window as any).__s.getState().objects);
  });

async function importarDiminuto(page: Page) {
  await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
  await expect(page.getByText(/mide 0,9 mm en su lado mayor/).first()).toBeVisible({ timeout: 30000 });
}

test('«Otra unidad…» abre el diálogo con todas las sugerencias y aplica en un paso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await importarDiminuto(page);
  const aviso = page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first();
  await expect(aviso.getByRole('button', { name: 'Escalar ×100' })).toBeVisible();
  await aviso.getByRole('button', { name: 'Otra unidad…' }).click();

  const dialog = page.getByRole('dialog', { name: '¿En qué unidad está este modelo?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Metros/)).toBeVisible();
  await expect(dialog.getByText('×1000 · queda en 900 mm')).toBeVisible();
  await expect(dialog.getByText('×25,4 · queda en 22,9 mm')).toBeVisible();
  await expect(dialog.getByText(/Centímetros/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/unidades-dialogo-1440.png` });

  // Elegir pulgadas y aplicar: un solo paso de deshacer.
  const pasos = await page.evaluate(() => (window as any).__s.getState().past.length);
  await dialog.getByRole('radio', { name: /Pulgadas/ }).check();
  await page.getByTestId('unit-apply').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => mayor(page)).toBeCloseTo(22.86, 1);
  expect(await page.evaluate(() => (window as any).__s.getState().past.length)).toBe(pasos + 1);
  await page.evaluate(() => (window as any).__s.getState().undo());
  await expect.poll(() => mayor(page)).toBeCloseTo(0.9, 2);
});

test('ajustar a N mm con campo propio; un tamaño inválido desactiva Aplicar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrir(page);
  await importarDiminuto(page);
  await page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first().getByRole('button', { name: 'Otra unidad…' }).click();
  const dialog = page.getByRole('dialog', { name: '¿En qué unidad está este modelo?' });
  const campo = dialog.getByRole('textbox', { name: /Ajustar el lado mayor a/ });
  await campo.fill('0');
  await expect(dialog.getByRole('alert')).toHaveText('Escribe un tamaño entre 1 y 5000 mm.');
  await expect(page.getByTestId('unit-apply')).toBeDisabled();
  await campo.fill('62,5');
  await expect(dialog.getByText('queda en 62,5 mm')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/unidades-dialogo-390.png` });
  await page.getByTestId('unit-apply').click();
  await expect.poll(() => mayor(page)).toBeCloseTo(62.5, 1);
});

test('los avisos con una sola acción no cambian', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().addToast('Aviso de prueba', 'info', { label: 'Hacer algo', run: () => undefined }));
  const aviso = page.locator('.kura-toast', { hasText: 'Aviso de prueba' });
  await expect(aviso.getByRole('button')).toHaveCount(2); // acción + cerrar
});
