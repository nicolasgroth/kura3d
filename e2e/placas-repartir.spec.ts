/**
 * @file e2e/placas-repartir.spec.ts
 * @description Recorrido del panel «Repartir en placas…» (lote de interfaz de placas). ESCRITO SIN EJECUTAR: lo corre QA
 * en navegador real. Cubre: abrir desde la paleta y desde la tira de placas, foco inicial, vista previa con su
 * resumen y los contornos en el visor, cambiar de criterio y de separación (recalcula), «Una placa por objeto» como
 * opción, «Repartir» (un paso de deshacer, cierra el panel, aviso con Deshacer), pasar de Armado a Imprimir, Esc y
 * «Volver», y que a 1024 px nada desborda. A 1024 y 1440 px, tema claro y oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

const panel = (page: Page) => page.getByRole('dialog', { name: 'Repartir en placas' });
const resumen = (page: Page) => page.getByTestId('arrange-summary');

/** Tres cubos en una sola placa implícita. */
async function tresCubos(page: Page) {
  await abrir(page);
  for (let i = 0; i < 3; i++) await agregarForma(page, 'Cubo');
}

/** Abre el panel desde la paleta de comandos. */
async function abrirDesdePaleta(page: Page) {
  await page.keyboard.press('Control+K');
  await page.getByRole('combobox').fill('Repartir en placas');
  await page.getByRole('option', { name: /Repartir en placas…/ }).first().click();
  await expect(panel(page)).toBeVisible();
}

for (const width of [1024, 1440]) {
  for (const tema of ['light', 'dark'] as const) {
    test.describe(`repartir en placas, ${width} px, tema ${tema}`, () => {
      test.use({ viewport: { width, height: 768 }, colorScheme: tema });

      test('la paleta abre el panel, con foco inicial y la vista previa lista', async ({ page }) => {
        await tresCubos(page);
        await abrirDesdePaleta(page);
        await expect(page.getByTestId('arrange-scope-all')).toBeChecked();
        await expect(page.getByTestId('arrange-criterion-compact')).toBeFocused();
        await expect(resumen(page)).toContainText(/placa/, { timeout: 10_000 });
        await expect(resumen(page)).toContainText('3 piezas colocadas');
        // El panel no desborda el ancho de la ventana.
        const caja = await panel(page).boundingBox();
        expect(caja!.x + caja!.width).toBeLessThanOrEqual(width);
        // Nada cambió en la escena todavía.
        expect(await store(page, (s) => s.plates.length)).toBe(0);
      });

      test('cambiar el criterio y la separación recalcula; la opción «Una placa por objeto» lo dice', async ({ page }) => {
        await tresCubos(page);
        await abrirDesdePaleta(page);
        await expect(resumen(page)).toContainText('3 piezas colocadas', { timeout: 10_000 });
        await page.getByTestId('arrange-criterion-byColor').check();
        await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', 'ready', { timeout: 10_000 });
        const separacion = page.getByRole('textbox', { name: 'Separación entre piezas' });
        await separacion.fill('200');
        await separacion.press('Enter');
        await page.getByTestId('arrange-criterion-onePerObject').check();
        await expect(resumen(page)).toContainText('Cada pieza irá a su propia placa');
        await expect(page.getByTestId('arrange-orient-flatDown')).toBeDisabled();
      });

      test('«Repartir» crea las placas en un paso, cierra el panel y el aviso permite deshacer', async ({ page }) => {
        await tresCubos(page);
        // Cama chica para que haya que abrir placas nuevas.
        await page.evaluate(() => (window as any).__s.setState({ customBedDimensions: { width: 60, depth: 60, height: 100 } }));
        await abrirDesdePaleta(page);
        await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', 'ready', { timeout: 10_000 });
        const pasos = await store(page, (s) => s.past.length);
        await page.getByTestId('arrange-apply').click();
        await expect(panel(page)).toHaveCount(0);
        expect(await store(page, (s) => s.past.length)).toBe(pasos + 1);
        expect(await store(page, (s) => s.plates.length)).toBeGreaterThanOrEqual(2);
        await expect(page.getByRole('region', { name: 'Placas de impresión' })).toBeVisible();
        const aviso = page.getByRole('status').filter({ hasText: /repartid/ });
        await aviso.getByRole('button', { name: 'Deshacer' }).click();
        expect(await store(page, (s) => s.plates.length)).toBe(0);
      });

      test('desde la tira de placas, desde Armado: pasa a Imprimir y lo avisa', async ({ page }) => {
        await tresCubos(page);
        await page.evaluate(() => (window as any).__s.setState({ customBedDimensions: { width: 60, depth: 60, height: 100 } }));
        await page.evaluate(() => (window as any).__s.getState().spreadOnePlatePerObject());
        await page.evaluate(() => (window as any).__s.getState().setViewMode('assembly'));
        await page.getByTestId('plate-arrange').click();
        await expect(panel(page)).toBeVisible();
        await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', 'ready', { timeout: 10_000 });
        await page.getByTestId('arrange-apply').click();
        await expect(panel(page)).toHaveCount(0);
        expect(await store(page, (s) => s.layout)).toBe('print');
        await expect(page.getByText('Pasaste a la vista Imprimir')).toBeVisible();
      });

      test('Esc y «Volver» cierran sin tocar la escena y devuelven el foco', async ({ page }) => {
        await tresCubos(page);
        await abrirDesdePaleta(page);
        await page.keyboard.press('Escape');
        await expect(panel(page)).toHaveCount(0);
        await abrirDesdePaleta(page);
        await page.getByTestId('panel-back').click();
        await expect(panel(page)).toHaveCount(0);
        expect(await store(page, (s) => s.plates.length)).toBe(0);
      });

      test('una pieza más grande que la cama se nombra con su motivo y no impide repartir las demás', async ({ page }) => {
        await tresCubos(page);
        await page.evaluate(() => (window as any).__s.setState({ customBedDimensions: { width: 15, depth: 15, height: 100 } }));
        await abrirDesdePaleta(page);
        await expect(page.getByTestId('arrange-unplaced')).toContainText('es más grande que la cama', { timeout: 10_000 });
      });

      test('desde el aviso «Fuera de volumen» se ofrece «Repartir en placas…»', async ({ page }) => {
        await tresCubos(page);
        await page.evaluate(() => (window as any).__s.setState({ customBedDimensions: { width: 15, depth: 15, height: 100 } }));
        await page.getByTestId('oob-arrange').click();
        await expect(panel(page)).toBeVisible();
      });
    });
  }
}
