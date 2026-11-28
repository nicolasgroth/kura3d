/**
 * @file e2e/placas-1024.spec.ts
 * @description Tira de placas a 1024 y 1280 px con 8 placas: botones «Placas anteriores» y «Placas siguientes» solo
 * si hay más fichas por ese lado (con teclado y mouse), ficha activa siempre a la vista (cambiar, crear, borrar y mover
 * piezas a otra placa), fichas compactas con al menos 3 visibles, estado sin depender solo del color y sin desborde.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });
const anterior = (page: Page) => tira(page).getByRole('button', { name: 'Placas anteriores' });
const siguiente = (page: Page) => tira(page).getByRole('button', { name: 'Placas siguientes' });

/** Fichas completamente visibles dentro de la lista y si la página desborda. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const l = document.querySelector('.kura-plate-list') as HTMLElement;
    const caja = l.getBoundingClientRect();
    const fichas = [...l.querySelectorAll<HTMLElement>('.kura-plate-chip')];
    const visibles = fichas.filter((f) => { const r = f.getBoundingClientRect(); return r.left >= caja.left - 1 && r.right <= caja.right + 1; }).length;
    const activa = l.querySelector<HTMLElement>('[data-active="true"]')!.getBoundingClientRect();
    return { visibles, activaVisible: activa.left >= caja.left - 1 && activa.right <= caja.right + 1, pagina: document.documentElement.scrollWidth - innerWidth, scroll: l.scrollLeft };
  });
}

for (const width of [1024, 1280]) {
  test.describe(`tira con 8 placas, ${width} px`, () => {
    test.use({ viewport: { width, height: 768 } });

    test.beforeEach(async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      for (let i = 0; i < 7; i++) await S(page, (s) => s.createPlate());
      await expect(tira(page).getByRole('button', { name: /^Placa 8:/ })).toBeVisible();
    });

    test('al menos 3 fichas visibles, estado con icono, sin desborde y botones de desplazamiento', async ({ page }) => {
      const m = await medir(page);
      expect(m.visibles).toBeGreaterThanOrEqual(3);
      expect(m.pagina).toBeLessThanOrEqual(0);
      expect(m.activaVisible).toBe(true);
      // La activa (Placa 8) es la última: solo hay «anterior».
      await expect(anterior(page)).toBeVisible();
      await expect(siguiente(page)).toHaveCount(0);
      // El estado se ve por forma (icono) aunque el texto se oculte: la ficha lo dice en su nombre accesible.
      await expect(tira(page).locator('.kura-plate-chip[data-active="true"] .kura-plate-chip-status svg')).toBeVisible();
      await expect(tira(page).getByRole('button', { name: /^Placa 8: .*vacía/i })).toBeVisible();
      await page.screenshot({ path: `.eval-tmp/dev-placas-1024/tira-8-placas-${width}.png`, clip: { x: 0, y: 768 - 110, width, height: 110 } });
      await page.screenshot({ path: `.eval-tmp/dev-placas-1024/tira-8-placas-${width}-completa.png` });
    });

    test('«Placas anteriores» y «siguientes» desplazan un ancho visible, con mouse y con teclado', async ({ page }) => {
      const antes = (await medir(page)).scroll;
      await anterior(page).click();
      await expect.poll(async () => (await medir(page)).scroll).toBeLessThan(antes);
      await expect(siguiente(page)).toBeVisible();
      // Con teclado: Tab hasta el botón y Enter (no crea ni borra nada).
      await siguiente(page).focus();
      await expect(siguiente(page)).toBeFocused();
      const total = await S(page, (s) => s.plates.length);
      const medio = (await medir(page)).scroll;
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await medir(page)).scroll).toBeGreaterThan(medio);
      expect(await S(page, (s) => s.plates.length)).toBe(total);
      // Hasta el principio: «anterior» desaparece.
      await page.evaluate(() => { (document.querySelector('.kura-plate-list') as HTMLElement).scrollLeft = 0; });
      await expect(anterior(page)).toHaveCount(0);
      await expect(siguiente(page)).toBeVisible();
    });

    test('la ficha activa queda a la vista al cambiar, crear, borrar y mover piezas a otra placa', async ({ page }) => {
      // Cambiar: la primera.
      await S(page, (s) => s.setActivePlate(s.plates[0].id));
      expect((await medir(page)).activaVisible).toBe(true);
      await S(page, (s) => s.setActivePlate(s.plates[5].id));
      await expect.poll(async () => (await medir(page)).activaVisible).toBe(true);
      // Crear: la nueva (última).
      await page.getByTestId('plate-add').click();
      await expect(tira(page).getByRole('button', { name: /^Placa 9:/ })).toBeFocused();
      await expect.poll(async () => (await medir(page)).activaVisible).toBe(true);
      // Mover piezas a otra placa: la de destino pasa a ser la activa y queda a la vista.
      await S(page, (s) => s.setActivePlate(s.plates[0].id));
      await expect.poll(async () => (await medir(page)).activaVisible).toBe(true);
      await S(page, (s) => { const ids = s.objects.map((o: any) => o.id); s.setSelection(ids); s.moveToPlate(s.plates[6].id, ids); });
      await expect.poll(async () => (await S(page, (s) => s.activePlateId)) === (await S(page, (s) => s.plates[6].id))).toBe(true);
      await expect.poll(async () => (await medir(page)).activaVisible).toBe(true);
      // Borrar la activa: pasa a otra y queda a la vista.
      await page.getByTestId('plate-delete').click();
      const dialogo = page.getByRole('dialog');
      if (await dialogo.count()) await dialogo.getByRole('button', { name: /Borrar placa/ }).first().click();
      await expect.poll(async () => (await medir(page)).activaVisible).toBe(true);
      expect((await medir(page)).pagina).toBeLessThanOrEqual(0);
    });
  });
}
