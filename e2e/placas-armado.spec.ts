/**
 * @file e2e/placas-armado.spec.ts
 * @description Recorridos de los modos de vista Imprimir / Armado / Libre (lote P4 de placas). ESCRITOS SIN EJECUTAR:
 * los corre QA en navegador real. Cubre: el selector no aparece con un proyecto simple y sí con dos placas, cambiar
 * de modo con clic y con flechas (sin pasos de deshacer), camas y tira de placas por modo, chip «Sin cama en esta
 * vista», acciones de cama deshabilitadas con su motivo, rótulo persistente, separación visual que no mueve nada,
 * mover en Armado y volver a Imprimir, atajo A y «Comprobar encaje». A 1024 y 1440 px, tema claro y oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

const selector = (page: Page) => page.getByRole('radiogroup', { name: 'Modo de vista' });
const modo = (page: Page, nombre: 'Imprimir' | 'Armado' | 'Libre') => selector(page).getByRole('radio', { name: nombre });
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });

/** Dos cubos en dos placas, con el segundo seleccionado. */
async function dosPlacas(page: Page) {
  await abrir(page);
  await agregarForma(page, 'Cubo');
  await page.getByTestId('plate-add-first').click();
  await agregarForma(page, 'Cubo');
  await expect(tira(page)).toBeVisible();
}

for (const width of [1024, 1440]) {
  for (const tema of ['light', 'dark'] as const) {
    test.describe(`modos de vista, ${width} px, tema ${tema}`, () => {
      test.use({ viewport: { width, height: 760 }, colorScheme: tema });

      test('proyecto simple: el selector no ensucia la barra; con dos placas aparece', async ({ page }) => {
        await abrir(page);
        await agregarForma(page, 'Cubo');
        await expect(selector(page)).toHaveCount(0);
        await page.getByTestId('plate-add-first').click();
        await expect(selector(page)).toBeVisible();
        await expect(modo(page, 'Imprimir')).toHaveAttribute('aria-checked', 'true');
        // El selector cabe en la barra a una sola fila (sin desbordar el visor).
        const caja = await page.getByRole('toolbar').first().boundingBox();
        expect(caja!.x + caja!.width).toBeLessThanOrEqual(width);
      });

      test('cambiar de modo con clic y con flechas no suma pasos de deshacer ni cambia las posiciones de placa', async ({ page }) => {
        await dosPlacas(page);
        const pasos = await store(page, (s) => s.past.length);
        const posiciones = await store(page, (s) => s.objects.map((o: any) => [...o.position]));
        await modo(page, 'Armado').click();
        await expect(modo(page, 'Armado')).toHaveAttribute('aria-checked', 'true');
        await modo(page, 'Armado').focus();
        await page.keyboard.press('ArrowRight');
        await expect(modo(page, 'Libre')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('Home');
        await expect(modo(page, 'Imprimir')).toHaveAttribute('aria-checked', 'true');
        expect(await store(page, (s) => s.past.length)).toBe(pasos);
        expect(await store(page, (s) => s.objects.map((o: any) => [...o.position]))).toEqual(posiciones);
      });

      test('Armado oculta camas y atenúa la tira con su nota; el pie dice «Sin cama en esta vista»; Libre también', async ({ page }) => {
        await dosPlacas(page);
        await expect(page.getByTestId('viewmode-hud')).toHaveCount(0);
        await modo(page, 'Armado').click();
        await expect(page.getByTestId('viewmode-badge')).toContainText('Vista armada');
        await expect(page.getByTestId('viewmode-badge')).toContainText('no cambia su lugar en la placa');
        await expect(tira(page)).toBeVisible();
        await expect(page.getByTestId('plate-strip-note')).toContainText('figura armada');
        await expect(page.getByTestId('viewmode-bed-chip')).toHaveText('Sin cama en esta vista');
        await expect(page.getByText('Fuera de volumen')).toHaveCount(0);
        await modo(page, 'Libre').click();
        await expect(page.getByTestId('viewmode-badge')).toContainText('Vista libre');
        await expect(page.getByTestId('viewmode-bed-chip')).toBeVisible();
        await page.getByTestId('viewmode-back').click();
        await expect(modo(page, 'Imprimir')).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByTestId('viewmode-hud')).toHaveCount(0);
      });

      test('las acciones de cama salen deshabilitadas en Armado con el motivo «Disponible en la vista Imprimir»', async ({ page }) => {
        await dosPlacas(page);
        await modo(page, 'Armado').click();
        await page.keyboard.press('Control+k');
        await page.keyboard.type('Apoyar');
        const opcion = page.getByRole('option', { name: /Apoyar/ }).first();
        await expect(opcion).toHaveAttribute('aria-disabled', 'true');
        await page.keyboard.press('Escape');
        // La tecla L (apoyar) no mueve nada y avisa por qué.
        const antes = await store(page, (s) => s.objects.map((o: any) => [...o.position]));
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('l');
        expect(await store(page, (s) => s.objects.map((o: any) => [...o.position]))).toEqual(antes);
        await expect(page.getByText('Disponible en la vista Imprimir').first()).toBeVisible();
      });

      test('la separación es solo visual: no mueve piezas, no entra al historial y vuelve a 0 al volver a Imprimir', async ({ page }) => {
        await dosPlacas(page);
        await modo(page, 'Armado').click();
        const pasos = await store(page, (s) => s.past.length);
        const posiciones = await store(page, (s) => s.objects.map((o: any) => [...o.position]));
        await page.getByTestId('viewmode-explode').fill('60');
        expect(await store(page, (s) => s.figureExplode?.factor)).toBeCloseTo(0.6, 2);
        expect(await store(page, (s) => s.objects.map((o: any) => [...o.position]))).toEqual(posiciones);
        expect(await store(page, (s) => s.past.length)).toBe(pasos);
        await modo(page, 'Imprimir').click();
        expect(await store(page, (s) => s.figureExplode)).toBeNull();
      });

      test('mover una pieza en Armado y volver a Imprimir la deja en su placa; deshacer conserva el modo del paso', async ({ page }) => {
        await dosPlacas(page);
        const id = await store(page, (s) => s.selectedIds[0]);
        const placa = await store(page, (s) => s.objects.find((o: any) => o.id === s.selectedIds[0]).position);
        await modo(page, 'Armado').click();
        await page.evaluate((i) => (window as any).__s.getState().setObjectTransform(i, { position: [15, 20, 15] }, true), id);
        await modo(page, 'Imprimir').click();
        expect(await store(page, (s) => s.objects.find((o: any) => o.id === s.selectedIds[0]).position)).toEqual(placa);
        await modo(page, 'Armado').click();
        expect(await store(page, (s) => s.objects.find((o: any) => o.id === s.selectedIds[0]).position)).toEqual([15, 20, 15]);
      });

      test('el atajo A cicla Imprimir, Armado y Libre y figura en el modal de Atajos', async ({ page }) => {
        await dosPlacas(page);
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('a');
        await expect(modo(page, 'Armado')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('a');
        await expect(modo(page, 'Libre')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('a');
        await expect(modo(page, 'Imprimir')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('?');
        await expect(page.getByText('Cambiar de vista: Imprimir, Armado, Libre')).toBeVisible();
      });

      test('con una operación en curso el selector no cambia y dice por qué', async ({ page }) => {
        await dosPlacas(page);
        await page.evaluate(() => (window as any).__s.setState({ busyOperation: 'repair' }));
        await modo(page, 'Armado').click();
        await expect(modo(page, 'Imprimir')).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByText(/No se puede cambiar de vista/).first()).toBeVisible();
        await page.evaluate(() => (window as any).__s.setState({ busyOperation: null }));
      });

      test('«Comprobar encaje» dice que se comprueba con las piezas armadas', async ({ page }) => {
        await dosPlacas(page);
        await page.evaluate(() => (window as any).__s.getState().setSelection((window as any).__s.getState().objects.map((o: any) => o.id)));
        await page.getByRole('button', { name: /Acciones/ }).click();
        await page.getByRole('menuitem', { name: /Comprobar encaje/ }).click();
        await expect(page.getByTestId('fit-check-assembled-note')).toContainText('piezas armadas');
      });
    });
  }
}
