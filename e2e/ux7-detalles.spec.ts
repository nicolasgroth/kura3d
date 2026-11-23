/**
 * @file e2e/ux7-detalles.spec.ts
 * @description Detalles del lote ux7: «¿Unidad equivocada?» en el inspector abre el diálogo de unidades;
 * menú contextual con varios objetos dice «N objetos»; Exportar explica los excluidos; Filamentos dice
 * «N piezas»; separar por colores nombra los colores; el pie no dice «Web Studio»; la paleta es un diálogo
 * con nombre. Ejecuta con `KURA_URL=… npx playwright test e2e/ux7-detalles.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';
import { SHOTS } from './ux7-helpers';

test('«¿Unidad equivocada?» en el inspector abre el diálogo aunque el aviso se cierre', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
  const aviso = page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first();
  await expect(aviso).toBeVisible({ timeout: 30000 });
  await aviso.getByRole('button', { name: 'Cerrar' }).click();
  const enlace = page.getByRole('button', { name: '¿Unidad equivocada?' });
  await expect(enlace).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/detalles-unidad-1440.png` });
  await enlace.click();
  await expect(page.getByRole('dialog', { name: '¿En qué unidad está este modelo?' })).toBeVisible();
  await page.getByTestId('unit-apply').click();
  await expect(enlace).toHaveCount(0);
});

test('menú con varios objetos, exportar con excluidos, filamentos y pie', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    const st = (window as any).__s.getState();
    st.updateObjectMeta(st.objects[2].id, { visible: false });
    st.setSelection([st.objects[0].id, st.objects[1].id]);
    const { useContextMenuRequest } = await import('/src/store/contextMenuRequest.ts');
    useContextMenuRequest.getState().open({ objectId: st.objects[0].id, x: 600, y: 300, returnFocus: null });
  });
  await expect(page.getByRole('menu', { name: /2 objetos/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.locator('.kura-statusbar')).not.toContainText('Web Studio');
  await expect(page.locator('.kura-statusbar')).toContainText('Estudio web');
  await expect(page.locator('.kura-filament-chip').first()).toContainText(/\d+ piezas?/);

  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('export'));
  await expect(page.getByTestId('export-excluded')).toHaveText('2 de 3: 1 oculto no se exporta');
  await page.screenshot({ path: `${SHOTS}/detalles-exportar-1440.png` });
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  const paleta = page.getByRole('dialog').filter({ has: page.getByRole('combobox') });
  await expect(paleta).toBeVisible();
  expect(await paleta.getAttribute('aria-labelledby')).toBeTruthy();
});
