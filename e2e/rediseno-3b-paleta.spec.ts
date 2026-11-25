/**
 * @file e2e/rediseno-3b-paleta.spec.ts
 * @description Paleta de pintura personalizable (lote 3b): con clic derecho se cambia una muestra con el selector
 * de color, con Mayús+F10 se abre la misma edición por teclado, se elige una paleta predefinida y todo persiste
 * al recargar. También a 390 px (opciones en la barra del visor). Capturas en `.eval-tmp/rediseno-3b/`.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-3b-paleta.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/rediseno-3b';
const panel = (page: Page) => page.locator('#kura-inspector-panel');
let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
});

test.afterEach(() => {
  expect(errores).toEqual([]);
});

async function pintar(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('kura3d-paint-palette');
    (window as any).__s.getState().createStarterCube();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBe(1);
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('paint'));
}

test('cambiar un color y elegir una paleta persiste al recargar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await pintar(page);
  const swatches = panel(page).locator('[data-swatch]');
  await expect(swatches).toHaveCount(8);
  // Clic derecho: edición de la muestra con el selector de color.
  await swatches.first().click({ button: 'right' });
  const dialogo = panel(page).getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await dialogo.locator('input[type="color"]').fill('#123456');
  await expect(swatches.first()).toHaveAttribute('data-swatch', '#123456');
  await page.screenshot({ path: `${OUT}/paleta-editar-1440.png` });
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  // Teclado: Mayús+F10 abre la misma edición.
  await swatches.nth(1).focus();
  await page.keyboard.press('Shift+F10');
  await expect(panel(page).getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(swatches.nth(1)).toBeFocused();

  // Paleta predefinida.
  await panel(page).getByRole('button', { name: 'Opciones de la paleta' }).click();
  await panel(page).getByRole('combobox', { name: 'Paleta' }).selectOption('pastel');
  await expect(swatches.first()).toHaveAttribute('data-swatch', '#fecaca');
  await page.screenshot({ path: `${OUT}/paleta-opciones-1440.png` });

  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => {
    (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore;
    (window as any).__s.getState().createStarterCube();
    (window as any).__s.getState().setActiveTool('paint');
  });
  await expect(panel(page).locator('[data-swatch]').first()).toHaveAttribute('data-swatch', '#fecaca');
});
