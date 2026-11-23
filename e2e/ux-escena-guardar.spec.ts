/**
 * @file e2e/ux-escena-guardar.spec.ts
 * @description Guardar en la web siempre da señal: con `showSaveFilePicker` simulado aparece "Proyecto
 * guardado: <nombre>" y el título pierde el «*»; si se cancela el selector, "Guardado cancelado"; sin esa
 * API se descarga el .kura y el aviso dice dónde. Ejecuta con `npm run test:e2e`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

async function conCubo(page: Page) {
  await abrir(page);
  await page.getByRole('button', { name: 'Cubo', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  await expect.poll(() => page.title()).toMatch(/^\* /);
  // El foco fuera de campos de texto, como tras crear con el ratón.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test('Ctrl+S con selector: aviso con el nombre y el título sin «*»', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).showSaveFilePicker = async (opts: { suggestedName: string }) => ({
      name: 'mi-pieza.kura',
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined, abort: async () => undefined }),
      suggested: opts.suggestedName,
    });
  });
  await conCubo(page);
  await page.keyboard.press('Control+s');
  await expect(page.getByText('Proyecto guardado: mi-pieza.kura').first()).toBeVisible();
  await expect.poll(() => page.title()).not.toMatch(/^\*/);
  await expect.poll(() => page.title()).toContain('mi-pieza.kura');
});

test('Cancelar el selector avisa "Guardado cancelado" y deja el «*»', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).showSaveFilePicker = async () => {
      throw new DOMException('The user aborted a request.', 'AbortError');
    };
  });
  await conCubo(page);
  await page.keyboard.press('Control+s');
  await expect(page.getByText('Guardado cancelado.').first()).toBeVisible();
  expect(await page.title()).toMatch(/^\* /);
});

test('Sin guardar en sitio: descarga el .kura y dice dónde', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as any).showSaveFilePicker;
    (window as any).showSaveFilePicker = undefined;
  });
  await conCubo(page);
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.kura$/);
  await expect(page.getByText(/se descargó en tu carpeta de descargas/).first()).toBeVisible();
});
