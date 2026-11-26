/**
 * @file e2e/placas-vista.spec.ts
 * @description Recorridos de la interfaz de placas (lote P2 «Placas a la vista»), ejecutados por QA (25-nov)
 * todavía: una sola placa = la interfaz de siempre, crear la segunda placa (tira, fichas, activa), renombrar con F2,
 * «Mover a placa» desde la paleta y el menú de la fila, fuera de volumen por placa, borrar una placa con piezas
 * (confirmación que dice a cuál pasan) y deshacer cada paso. Se comprueba a 1024 px y a 1280 px.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });
const ficha = (page: Page, nombre: RegExp | string) => tira(page).getByRole('button', { name: typeof nombre === 'string' ? new RegExp(`^${nombre}:`) : nombre });

async function undo(page: Page) {
  await page.evaluate(() => (window as any).__s.getState().undo());
}

for (const width of [1024, 1280]) {
  test.describe(`placas a la vista, ${width} px`, () => {
    test.use({ viewport: { width, height: 720 } });

    test('una sola placa: tira corta (selector de vista y «+ Placa»), sin fichas', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await expect(tira(page)).toHaveAttribute('data-short', 'true');
      await expect(tira(page).getByTestId('viewmode-selector')).toBeVisible();
      await expect(tira(page).getByTestId('plate-solo')).toHaveCount(0);
      await expect(page.getByTestId('plate-add-first')).toBeVisible();
      await expect(page.getByTestId('plate-add-first')).toHaveText('+ Placa');
      // El menú de la fila del objeto no ofrece «Mover a placa» hasta la segunda placa.
      await page.keyboard.press('Control+k');
      await page.keyboard.type('Mover a placa');
      await expect(page.getByRole('option', { name: /Mover a placa/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
    });

    test('crear la segunda placa: aparece la tira, la nueva queda activa, «+ Placa» se va y deshacer vuelve a lo de siempre', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await page.getByTestId('plate-add-first').click();
      await expect(tira(page)).toBeVisible();
      await expect(ficha(page, 'Placa 1')).toHaveAttribute('aria-pressed', 'false');
      await expect(ficha(page, 'Placa 2')).toHaveAttribute('aria-pressed', 'true');
      await expect(ficha(page, 'Placa 1')).toContainText('1 pieza');
      await expect(ficha(page, 'Placa 1')).toContainText('Bien');
      await expect(ficha(page, 'Placa 2')).toContainText('Vacía');
      await expect(page.getByTestId('plate-add-first')).toHaveCount(0);
      // La tira cabe en el ancho: sin desplazamiento horizontal de la página.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await undo(page);
      await expect(tira(page)).toHaveAttribute('data-short', 'true');
      await expect(page.getByTestId('plate-add-first')).toBeVisible();
    });

    test('renombrar con F2 y con doble clic; Escape cancela; deshacer devuelve el nombre', async ({ page }) => {
      await abrir(page);
      await store(page, (s) => s.createPlate());
      await ficha(page, 'Placa 2').focus();
      await page.keyboard.press('F2');
      const campo = page.getByRole('textbox', { name: 'Nombre de la placa' });
      await expect(campo).toBeFocused();
      await campo.fill('Cabeza');
      await page.keyboard.press('Enter');
      await expect(ficha(page, 'Cabeza')).toBeFocused();
      await ficha(page, 'Cabeza').dblclick();
      await page.keyboard.type('Otra');
      await page.keyboard.press('Escape');
      await expect(ficha(page, 'Cabeza')).toBeVisible();
      await undo(page);
      await expect(ficha(page, 'Placa 2')).toBeVisible();
    });

    test('«Mover a placa» desde la paleta traslada la pieza al hueco equivalente en un solo paso', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.setActivePlate(s.plates[0].id));
      await store(page, (s) => s.setSelection([s.objects[0].id]));
      const antes = await store(page, (s) => ({ x: s.objects[0].position[0], pasos: s.past.length, origen: s.plates[1].origin[0] }));
      await page.keyboard.press('Control+k');
      await page.keyboard.type('Mover a placa: Placa 2');
      await page.getByRole('option', { name: /Mover a placa: Placa 2/ }).first().click();
      const despues = await store(page, (s) => ({ x: s.objects[0].position[0], pasos: s.past.length, ref: s.objects[0].plateRef, p2: s.plates[1].id }));
      expect(despues.ref).toBe(despues.p2);
      expect(despues.x).toBeCloseTo(antes.x + antes.origen, 3);
      expect(despues.pasos).toBe(antes.pasos + 1);
      await expect(ficha(page, 'Placa 2')).toContainText('1 pieza');
      await expect(ficha(page, 'Placa 1')).toContainText('Vacía');
      await undo(page);
      await expect(ficha(page, 'Placa 1')).toContainText('1 pieza');
    });

    test('«Mover a placa ›» en el menú de la fila: lista las placas y «Placa nueva»', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      const fila = page.getByRole('treeitem').first();
      await fila.click();
      await fila.press('Shift+F10');
      const menu = page.getByRole('menu').first();
      await menu.getByRole('menuitem', { name: 'Mover a placa' }).click();
      const lista = page.getByRole('menu', { name: /Mover a placa/ });
      await expect(lista.getByRole('menuitem')).toHaveText([/Placa 1 \(actual\)/, /Placa 2/, /Placa nueva/]);
      await lista.getByRole('menuitem', { name: 'Placa nueva' }).click();
      await expect(ficha(page, 'Placa 3')).toContainText('1 pieza');
      await undo(page);
      await expect(ficha(page, 'Placa 3')).toHaveCount(0);
    });

    test('fuera de volumen por placa: el aviso y la ficha dicen cuál placa excede su cama; las demás siguen bien', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[0].id]));
      await store(page, (s) => s.setObjectTransform(s.objects[0].id, { scale: [20, 1, 1] }, true));
      await expect(ficha(page, 'Placa 2')).toContainText('Fuera de volumen');
      await expect(ficha(page, 'Placa 1')).toContainText('Vacía');
      await expect(page.getByTestId('oob-plates')).toHaveText('en Placa 2');
      // El estado también es texto: no depende solo del color.
      await expect(ficha(page, 'Placa 2')).toHaveAccessibleName(/Fuera de volumen/);
    });

    test('borrar una placa con piezas pide confirmación y dice a cuál pasan; Cancelar no cambia nada; deshacer la restaura', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[0].id]));
      await page.getByTestId('plate-delete').click();
      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toContainText('tiene 1 pieza');
      await expect(dialogo).toContainText('«Placa 1»');
      await dialogo.getByRole('button', { name: 'Cancelar' }).click();
      await expect(ficha(page, 'Placa 2')).toBeVisible();
      await page.getByTestId('plate-delete').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Borrar placa' }).click();
      await expect(tira(page)).toHaveCount(0);
      expect(await store(page, (s) => s.objects[0].position[0])).toBeCloseTo(0, 3);
      await undo(page);
      await expect(ficha(page, 'Placa 2')).toContainText('1 pieza');
    });

    test('«Solo esta» y «Sin cama» (B): el estado queda en la tira y en el store (la escena de Three no se expone a las pruebas)', async ({ page }) => {
      await abrir(page);
      await store(page, (s) => s.createPlate());
      const solo = tira(page).getByRole('button', { name: /Solo esta/ });
      await expect(solo).toHaveAttribute('aria-pressed', 'false');
      await solo.click();
      await expect(solo).toHaveAttribute('aria-pressed', 'true');
      expect(await store(page, (s) => s.plateSolo)).toBe(true);
      await page.getByTestId('bed-toggle').click();
      expect(await store(page, (s) => s.showBed)).toBe(false);
    });

    test('deshacer cada paso de placas, uno a uno, con su nombre en el historial', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await store(page, (s) => s.createPlate());
      await store(page, (s) => s.renamePlate(s.plates[1].id, 'Cabeza'));
      await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[0].id]));
      const etiquetas = await page.evaluate(async () => {
        const { historyTimeline } = await import('/src/store/historyLabels.ts');
        const s = (window as any).__s.getState();
        return historyTimeline(s.language, s, 50).entries.map((e: any) => e.label);
      });
      expect(etiquetas.slice(-3)).toEqual(['Crear placa «Placa 2»', 'Renombrar placa «Cabeza»', 'Mover «Cubo 1» a «Cabeza»']);
      await undo(page);
      await expect(ficha(page, 'Cabeza')).toContainText('Vacía');
      await undo(page);
      await expect(ficha(page, 'Placa 2')).toBeVisible();
      await undo(page);
      await expect(tira(page)).toHaveCount(0);
    });
  });
}

test.describe('tira con muchas placas, 1024 px', () => {
  test.use({ viewport: { width: 1024, height: 720 } });

  test('la lista se desplaza dentro de la tira, la activa queda a la vista y los botones fijos siguen alcanzables', async ({ page }) => {
    await abrir(page);
    for (let i = 0; i < 9; i += 1) await store(page, (s) => s.createPlate());
    const lista = tira(page).locator('.kura-plate-list');
    expect(await lista.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(ficha(page, 'Placa 10')).toBeInViewport();
    await expect(tira(page).getByTestId('plate-add')).toBeInViewport();
    await ficha(page, 'Placa 10').focus();
    await page.keyboard.press('Home');
    await expect(ficha(page, 'Placa 1')).toBeFocused();
  });
});
