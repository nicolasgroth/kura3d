/**
 * @file e2e/placas-usab.spec.ts
 * @description Usabilidad de placas: nombres e insignias coherentes tras convertir grupos en placas, foco tras «+ Placa»,
 * borrar y «Deshacer», ficha de ancho acotado con nombre largo y degradado cuando la tira continúa, mensaje de placa
 * borrada con «Deshacer», encuadre al usar «Solo esta» o cambiar de vista y categoría «Placas» en la paleta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });
const ficha = (page: Page, nombre: string) => tira(page).getByRole('button', { name: new RegExp(`^${nombre}:`) });
const fichaActiva = (page: Page) => tira(page).locator('[data-active="true"] button.kura-plate-chip-main');
const enfocadoEsCuerpo = (page: Page) => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);

const LARGO = 'Soporte de la cabeza con pestañas de encaje y refuerzos laterales A';

for (const width of [1024, 1280]) {
  test.describe(`usabilidad de placas, ${width} px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test('convertir grupos con número de laminador: nombres sin saltos, en orden, e insignia = posición en la tira', async ({ page }) => {
      await abrir(page);
      for (const n of [8, 2, 7]) {
        await agregarForma(page, 'Cubo');
        await agregarForma(page, 'Cubo');
        await page.evaluate((nombre) => {
          const s = (window as any).__s.getState();
          s.groupObjects(s.objects.slice(-2).map((o: any) => o.id), nombre);
        }, `Placa ${n}`);
      }
      expect(await store(page, (s) => s.groups.map((g: any) => g.name))).toEqual(['Placa 8', 'Placa 2', 'Placa 7']);
      const res = await store(page, (s) => s.convertGroupsToPlates(s.groups.map((g: any) => g.id)));
      expect(res?.created).toHaveLength(3);
      expect(await store(page, (s) => s.plates.map((p: any) => p.name))).toEqual(['Placa 1', 'Placa 2', 'Placa 3']);
      const insignias = page.getByTestId('plate-badge');
      const total = await insignias.count();
      expect(total).toBe(6);
      const nombres: string[] = await store(page, (s) => s.plates.map((p: any) => p.name));
      for (let i = 0; i < total; i++) {
        const etiqueta = (await insignias.nth(i).getAttribute('aria-label')) ?? '';
        const nombre = /Placa \d+/.exec(etiqueta)![0];
        await expect(insignias.nth(i)).toHaveText(`P${nombres.indexOf(nombre) + 1}`);
        await expect(insignias.nth(i)).toHaveAttribute('title', new RegExp(nombre));
      }
    });

    test('«+ Placa» deja el foco en la ficha nueva, también desde la tira', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await page.getByTestId('plate-add-first').click();
      await expect(ficha(page, 'Placa 2')).toBeFocused();
      await expect(fichaActiva(page)).toBeFocused();
      await page.getByTestId('plate-add').click();
      await expect(ficha(page, 'Placa 3')).toBeFocused();
      expect(await enfocadoEsCuerpo(page)).toBe(false);
    });

    test('borrar una placa: aviso con «Deshacer», foco en la ficha activa y el deshacer no deja el foco en body', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.setActivePlate(s.plates[1].id));
      await page.getByTestId('plate-delete').click();
      const dlg = page.getByRole('dialog');
      if (await dlg.count()) await dlg.getByRole('button', { name: 'Borrar placa' }).click();
      await expect(tira(page).locator('.kura-plate-chip')).toHaveCount(2);
      await expect(fichaActiva(page)).toBeFocused();
      await expect(page.getByText(/Placa «Placa 2» borrada/).first()).toBeVisible();
      const deshacer = page.getByRole('button', { name: 'Deshacer' }).first();
      await expect(deshacer).toBeVisible();
      await deshacer.click();
      await expect(tira(page).locator('.kura-plate-chip')).toHaveCount(3);
      await expect.poll(() => enfocadoEsCuerpo(page)).toBe(false);
    });

    test('nombre largo: ficha acotada, elipsis, nombre completo en title y en el nombre accesible; 6 placas sin desbordar la página', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      expect(LARGO.length).toBeGreaterThanOrEqual(60);
      await store(page, (s) => s.createPlate());
      await page.evaluate((nombre) => (window as any).__s.getState().renamePlate((window as any).__s.getState().plates[1].id, nombre), LARGO);
      const boton = tira(page).getByRole('button', { name: new RegExp(`^${LARGO.slice(0, 20)}`) });
      const caja = await boton.boundingBox();
      expect(caja!.width).toBeLessThanOrEqual(222);
      await expect(boton).toHaveAttribute('title', new RegExp(LARGO));
      await expect(boton).toHaveAttribute('aria-label', new RegExp(LARGO));
      const recortado = await boton.locator('.kura-plate-chip-name').evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(recortado).toBe(true);
      for (let i = 0; i < 4; i++) await page.evaluate((n) => (window as any).__s.getState().createPlate({ name: `Bandeja ${n}` }), i + 10);
      expect(await store(page, (s) => s.plates.length)).toBe(6);
      const medidas = await page.evaluate(() => {
        const lista = document.querySelector('.kura-plate-list') as HTMLElement;
        return { pagina: document.documentElement.scrollWidth - window.innerWidth, lista: lista.scrollWidth - lista.clientWidth };
      });
      expect(medidas.pagina).toBeLessThanOrEqual(0);
      if (medidas.lista > 1) {
        // Hay más fichas de las que caben: el borde por donde continúa se difumina.
        await expect.poll(() => page.locator('.kura-plate-list').evaluate((el) => el.getAttribute('data-more-start') === 'true' || el.getAttribute('data-more-end') === 'true')).toBe(true);
        const mascara = await page.locator('.kura-plate-list').evaluate((el) => getComputedStyle(el).maskImage || (getComputedStyle(el) as any).webkitMaskImage);
        expect(mascara).toContain('gradient');
      }
    });

    test('«Solo esta» y el cambio de vista piden encuadrar en vez de dejar la cámara pegada a la pieza', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await tira(page).getByTestId('plate-solo').click();
      expect(await store(page, (s) => s.cameraRequest?.preset)).toBe('activePlateFit');
      await tira(page).getByTestId('plate-solo').click();
      expect(await store(page, (s) => s.cameraRequest?.preset)).toBe('plates');
      await store(page, (s) => s.setViewMode('assembly'));
      expect(await store(page, (s) => s.cameraRequest?.preset)).toBe('scene');
      await store(page, (s) => s.setViewMode('print'));
      expect(await store(page, (s) => s.cameraRequest?.preset)).toBe('plates');
    });

    test('la paleta agrupa «Mover a placa» en «Placas» (la insignia «Local» es transversal a todas las acciones)', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.setSelection([s.objects[0].id]));
      await page.keyboard.press('Control+k');
      await page.keyboard.type('Mover a placa: Placa 2');
      const opcion = page.getByRole('option', { name: /Mover a placa: Placa 2/ }).first();
      await expect(opcion).toBeVisible();
      await expect(opcion).toContainText('Placas');
      await expect(opcion).not.toContainText('Posición y tipo');
      await page.keyboard.press('Escape');
    });
  });
}
