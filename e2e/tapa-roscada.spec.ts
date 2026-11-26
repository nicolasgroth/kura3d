/**
 * @file e2e/tapa-roscada.spec.ts
 * @description Recorrido del recipiente con tapa roscada. Abre Insertar › Asistentes,
 * elige «Recipiente con tapa roscada», comprueba la miniatura, el aviso «Enrosca: holgura mínima…» de la vista previa,
 * un aviso de medida frágil (pared delgada), que holgura 0 cambia el resultado a un aviso, crea las dos piezas (un paso de
 * deshacer) y reabre con «Editar con el asistente». Después, en el diálogo de roscas, crea la pareja perno + tuerca.
 * Pensado para 1440 y 1024 px, consola sin errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './qa12-helpers';

async function abrirAsistente(page: Page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
  const tarjeta = page.locator('.kura-asis-card[data-recipe="kura.tapa-roscada"]');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator('svg.kura-asis-thumb')).toHaveCount(1, { timeout: 60_000 });
  await tarjeta.click();
}

for (const ancho of [1440, 1024]) {
  test.describe(`recipiente con tapa roscada a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 } });

    test('vista previa con enroscado, avisos, crear y editar con el asistente', async ({ page }) => {
      const errores: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
      await abrirAsistente(page);
      await expect(page.getByRole('slider', { name: 'Deslizador de Diámetro interior' })).toBeVisible();
      // La vista previa mide el enroscado antes de crear.
      const enrosca = page.locator('.kura-asis-screwfit');
      await expect(enrosca).toContainText(/Enrosca: holgura mínima 0,3\d mm/, { timeout: 60_000 });

      // Pared delgada: aviso junto al campo.
      const pared = page.getByLabel('Pared', { exact: true });
      await pared.fill('1.4');
      await pared.press('Tab');
      await expect(page.getByText(/Pared bajo 1,6 mm/)).toBeVisible();

      // Holgura 0: la vista previa avisa que no enrosca.
      const holgura = page.getByLabel('Holgura radial', { exact: true });
      const juego = page.getByLabel('Juego axial', { exact: true });
      await holgura.fill('0');
      await holgura.press('Tab');
      await juego.fill('0');
      await juego.press('Tab');
      await expect(enrosca).toHaveAttribute('data-status', /tight|interference/, { timeout: 60_000 });
      await expect(page.getByText(/Holgura bajo 0,15 mm/)).toBeVisible();
      await holgura.fill('0.3');
      await holgura.press('Tab');
      await juego.fill('0.45');
      await juego.press('Tab');
      await expect(enrosca).toHaveAttribute('data-status', 'ok', { timeout: 60_000 });

      // Alto que no alcanza para la rosca: error que bloquea crear. Con paso 4 y 2 vueltas la rosca pide justo 10 mm
      // (el mínimo del campo), así que se sube a 3 vueltas (12 mm de rosca, alto mínimo 14 mm).
      const vueltas = page.getByLabel('Vueltas', { exact: true });
      await vueltas.fill('3');
      await vueltas.press('Tab');
      const alto = page.getByLabel('Alto interior', { exact: true });
      await alto.fill('10');
      await alto.press('Tab');
      await expect(page.getByText(/El alto interior no alcanza para 12 mm de rosca: súbelo a 14 mm/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Crear', exact: true })).toBeDisabled();
      await alto.fill('40');
      await alto.press('Tab');
      await vueltas.fill('2');
      await vueltas.press('Tab');

      // Crear: dos piezas, un paso de deshacer.
      await page.getByRole('button', { name: 'Crear', exact: true }).click();
      await expect(page.getByText(/Enrosca: holgura mínima/).first()).toBeVisible();
      const nombres = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name));
      expect(nombres).toEqual(['Recipiente', 'Tapa roscada']);

      // Editar con el asistente: vuelve con las respuestas y «Actualizar».
      const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
      await page.evaluate((i) => (window as any).__s.getState().selectObjects?.([i]) ?? (window as any).__s.setState({ selectedIds: [i] }), id);
      await page.getByRole('button', { name: 'Editar con el asistente' }).click();
      await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
      await expect(page.getByLabel('Pared', { exact: true })).toHaveValue('1,4');
      expect(errores).toEqual([]);
    });
  });
}

test('diálogo de roscas: pareja perno + tuerca con su enroscado', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => (window as any).__s.setState({ activeDialog: 'thread' }));
  await page.getByRole('checkbox', { name: 'Crear la pareja que enrosca' }).check();
  await expect(page.getByLabel('Tipo de pieza roscada')).toHaveCount(0);
  await page.getByRole('button', { name: /Crear pareja/ }).click();
  await expect(page.getByText(/Enrosca: holgura mínima/)).toBeVisible({ timeout: 60_000 });
  const n = await page.evaluate(() => (window as any).__s.getState().objects.length);
  expect(n).toBe(2);
});
