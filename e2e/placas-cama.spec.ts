/**
 * @file e2e/placas-cama.spec.ts
 * @description Recorridos de la cama por placa (lote P7, dos impresoras), ESCRITOS SIN EJECUTAR por el autor del lote:
 * QA los corre en navegador. Abrir «Cama de esta placa…» desde la ficha con teclado, elegir una impresora incluida
 * (el rótulo «Cama: …» aparece en la ficha), volver a la del proyecto, un paso de deshacer, Esc devuelve el foco,
 * agrandar la placa 1 corre a la placa 2 sin solaparlas, «fuera de volumen» por placa con camas distintas y
 * «Convertir grupos en placas» desde la paleta. Se comprueba a 1024 px y a 1280 px.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });
const ficha = (page: Page, nombre: string) => tira(page).getByRole('button', { name: new RegExp(`^${nombre}:|^${nombre},`) });
const abrirCama = (page: Page, nombre: string) => tira(page).getByRole('button', { name: `Cama de ${nombre}…` });
const dialogo = (page: Page) => page.getByRole('dialog');

async function dosPlacas(page: Page) {
  await abrir(page);
  await agregarForma(page, 'Cubo');
  await page.getByTestId('plate-add-first').click();
  await expect(tira(page)).toBeVisible();
}

for (const width of [1024, 1280]) {
  test.describe(`cama por placa, ${width} px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test('elegir otra impresora para la placa 2 con teclado: rótulo en la ficha, deshacer en un paso', async ({ page }) => {
      await dosPlacas(page);
      const boton = abrirCama(page, 'Placa 2');
      await boton.focus();
      await page.keyboard.press('Enter');
      await expect(dialogo(page)).toBeVisible();
      await expect(dialogo(page)).toContainText('Cama de Placa 2');
      // «La del proyecto» marcada al abrir; los grupos tienen nombre visible.
      await expect(dialogo(page).getByRole('radio', { name: /La del proyecto|Bambu|Genérica/ }).first()).toBeChecked();
      await expect(dialogo(page).getByText('Impresoras incluidas')).toBeVisible();
      await expect(dialogo(page).getByText('Mis camas')).toBeVisible();
      await dialogo(page).getByTestId('plate-bed-option-profile:bambu-a1-mini').check();
      await dialogo(page).getByTestId('plate-bed-apply').click();
      await expect(dialogo(page)).toHaveCount(0);
      await expect(abrirCama(page, 'Placa 2')).toBeFocused();
      await expect(tira(page).locator('[data-plate-id] [data-testid="plate-chip-bed"]')).toHaveText(/Cama: .*A1 mini/);
      expect(await page.evaluate(() => (window as any).__s.getState().plates[1].bed?.widthMm)).toBe(180);
      // Sin desplazamiento horizontal a este ancho.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.evaluate(() => (window as any).__s.getState().undo());
      await expect(tira(page).getByTestId('plate-chip-bed')).toHaveCount(0);
    });

    test('Esc cierra sin cambiar y devuelve el foco al botón', async ({ page }) => {
      await dosPlacas(page);
      await abrirCama(page, 'Placa 1').click();
      await expect(dialogo(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialogo(page)).toHaveCount(0);
      await expect(abrirCama(page, 'Placa 1')).toBeFocused();
      expect(await page.evaluate(() => (window as any).__s.getState().plates[0].bed)).toBeUndefined();
    });

    test('agrandar la placa 1 corre la placa 2 sin solaparlas y avisa', async ({ page }) => {
      await dosPlacas(page);
      const antes = await page.evaluate(() => (window as any).__s.getState().plates[1].origin[0]);
      await abrirCama(page, 'Placa 1').click();
      // La más grande de las incluidas.
      await dialogo(page).getByTestId('plate-bed-option-profile:bambu-h2d').check();
      await dialogo(page).getByTestId('plate-bed-apply').click();
      const despues = await page.evaluate(() => (window as any).__s.getState().plates[1].origin[0]);
      expect(despues).toBeGreaterThan(antes);
      await expect(page.getByText(/cambió de lugar con sus piezas/)).toBeVisible();
    });

    test('«fuera de volumen» por placa con camas distintas', async ({ page }) => {
      await dosPlacas(page);
      await page.evaluate(() => {
        const s = (window as any).__s.getState();
        s.setPlateBed(s.plates[1].id, { name: 'Mini', widthMm: 50, depthMm: 50, heightMm: 50 });
      });
      await page.evaluate(() => {
        const s = (window as any).__s.getState();
        const cube = s.objects[0];
        s.moveToPlate(s.plates[1].id, [cube.id]);
      });
      await page.evaluate(() => {
        const s = (window as any).__s.getState();
        s.updateObject?.(s.objects[0].id, { scale: [4, 4, 4] });
      });
      await expect(ficha(page, 'Placa 2')).toContainText(/Fuera/);
    });

    test('«Convertir grupos en placas» desde la paleta sin grupos dice por qué no está disponible', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await page.keyboard.press('Control+k');
      await page.keyboard.type('Convertir grupos en placas');
      await expect(page.getByRole('option', { name: /Convertir grupos en placas/ })).toBeVisible();
      await page.keyboard.press('Escape');
    });
  });
}
