/**
 * @file e2e/qa26-mensajes-placas.spec.ts
 * @description QA del lote «Usabilidad del centro de mensajes y de placas»: lo que los specs del dev no cubren. Nombre de
 * archivo largo sin espacios en el emergente, error nacido con un diálogo abierto, caducar no veta, borrar la placa
 * activa con piezas con deshacer y rehacer, renombrar a un nombre repetido, 9 placas a 1024 px y convertir un 3MF con placas
 * manuales. Los dos primeros casos documentaron fallos de QA ya corregidos. Evidencia en `.eval-tmp/qa-mensajes-placas/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { abrir, stlCubes, importarStl } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const toast = (page: Page, text: string, kind = 'info') => page.evaluate(([x, k]) => (window as any).__s.getState().addToast(x, k), [text, kind]);
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });

for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  test.describe(`QA mensajes y placas, ${w} px`, () => {
    test.use({ viewport: { width: w, height: h } });

    // FALLO ABIERTO (mayor): con un nombre de archivo sin espacios de 76 caracteres el texto ensancha el emergente más allá de
    // su caja y la acción «Reparar malla» y «Cerrar» quedan fuera (x≈799 y 903, con el emergente terminando en x=716).
    test('un nombre de archivo largo sin espacios no empuja la acción ni «Cerrar» fuera del emergente', async ({ page }) => {
      await abrir(page);
      const stl = stlCubes([[0, 0, 0]], 30).replace(/facet normal 0 0 0\nouter loop\n(vertex .*\n){3}endloop\nendfacet\n/, '');
      await importarStl(page, `${'x'.repeat(76)}.stl`, stl);
      const t = page.locator('.kura-toast').first();
      await expect(t).toBeVisible({ timeout: 20_000 });
      const dentro = await t.evaluate((el) => {
        const c = el.getBoundingClientRect();
        return [...el.querySelectorAll('button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1; });
      });
      expect(dentro).toBe(true);
    });

    // FALLO ABIERTO (mayor, criterio 5): con el diálogo Exportar abierto, un error nuevo queda detrás del velo (no se ve ni se cierra).
    test('un error nacido con el diálogo Exportar abierto se puede ver y cerrar', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
      await expect(page.locator('dialog[open]')).toHaveCount(1);
      await toast(page, 'Error nacido dentro del diálogo', 'error');
      await page.waitForTimeout(500);
      const visible = await page.evaluate(() => {
        const t = document.querySelector('.kura-toast') as HTMLElement;
        const b = t.getBoundingClientRect();
        const el = document.elementFromPoint(b.x + 20, b.y + b.height / 2);
        return !!el && t.contains(el);
      });
      expect(visible).toBe(true);
    });

    test('caducar no veta: el mismo informativo con acción vuelve; cerrado a mano sigue vetado', async ({ page }) => {
      await abrir(page);
      const add = () => page.evaluate(() => (window as any).__s.getState().addToast('Aviso con objetos', 'info', { label: 'Ir', run: () => undefined, targetIds: ['obj_x'] }));
      await add();
      await expect(page.locator('.kura-toast')).toHaveCount(1);
      await expect(page.locator('.kura-toast')).toHaveCount(0, { timeout: 12_000 });
      await add();
      await expect(page.locator('.kura-toast')).toHaveCount(1);
      await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
      await add();
      await expect(page.locator('.kura-toast')).toHaveCount(0);
    });

    test('borrar la placa activa con piezas: deshacer dos veces y rehacer vuelven al estado esperado', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await agregarForma(page, 'Cilindro');
      await S(page, (s) => s.createPlate());
      await S(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[1].id]));
      await S(page, (s) => s.setActivePlate(s.plates[1].id));
      const reparto = () => S(page, (s) => ({ placas: s.plates.length, enPlaca: s.objects.map((o: any) => s.plates.findIndex((p: any) => p.id === o.plateRef)) }));
      await page.getByTestId('plate-delete').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Borrar placa' }).click();
      expect(await reparto()).toEqual({ placas: 1, enPlaca: [0, 0] });
      await page.keyboard.press('Control+z');
      expect(await reparto()).toEqual({ placas: 2, enPlaca: [0, 1] });
      await page.keyboard.press('Control+z');
      expect(await reparto()).toEqual({ placas: 2, enPlaca: [0, 0] });
      await page.keyboard.press('Control+Shift+z');
      expect(await reparto()).toEqual({ placas: 2, enPlaca: [0, 1] });
      await page.keyboard.press('Control+Shift+z');
      expect(await reparto()).toEqual({ placas: 1, enPlaca: [0, 0] });
      // Con una sola placa la pieza nueva cae en la que queda.
      await agregarForma(page, 'Esfera');
      expect(await S(page, (s) => new Set(s.objects.map((o: any) => o.plateRef)).size)).toBe(1);
    });

    test('renombrar a un nombre repetido avisa en la ficha, no cambia el nombre y Escape devuelve el foco a la ficha', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await S(page, (s) => s.createPlate());
      await S(page, (s) => s.createPlate());
      await tira(page).locator('.kura-plate-chip-main').nth(2).dblclick();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Placa 1');
      await page.keyboard.press('Enter');
      await expect(tira(page).getByText(/Otra placa ya se llama/)).toBeVisible();
      expect(await S(page, (s) => s.plates.map((p: any) => p.name))).toEqual(['Placa 1', 'Placa 2', 'Placa 3']);
      await page.keyboard.press('Escape');
      await expect(tira(page).getByRole('button', { name: /^Placa 3:/ })).toBeFocused();
    });

    test('9 placas: la tira continúa (degradado), la página no desborda y las fichas conservan su nombre', async ({ page }) => {
      await abrir(page);
      await agregarForma(page, 'Cubo');
      for (let i = 0; i < 8; i++) await S(page, (s) => s.createPlate());
      const m = await page.evaluate(() => {
        const l = document.querySelector('.kura-plate-list') as HTMLElement;
        return { pagina: document.documentElement.scrollWidth - innerWidth, lista: l.scrollWidth - l.clientWidth, mas: l.getAttribute('data-more-start') === 'true' || l.getAttribute('data-more-end') === 'true' };
      });
      expect(m.pagina).toBeLessThanOrEqual(0);
      expect(m.lista).toBeGreaterThan(0);
      expect(m.mas).toBe(true);
      expect(await S(page, (s) => s.plates.map((p: any) => p.name))).toEqual(Array.from({ length: 9 }, (_, i) => `Placa ${i + 1}`));
    });

    test('convertir un 3MF con placas manuales: nombres sin choques, insignia = posición y deshacer', async ({ page }) => {
      test.setTimeout(240_000);
      const ruta = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';
      test.skip(!existsSync(ruta), 'sin modelo');
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await S(page, (s) => s.createPlate({ name: 'Mi base' }));
      await S(page, (s) => s.createPlate());
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
      await (await chooser).setFiles(ruta);
      const conv = page.getByRole('button', { name: /Convertir en placas/ });
      await expect(conv).toBeVisible({ timeout: 90_000 });
      await conv.click();
      await expect.poll(() => S(page, (s) => s.plates.length), { timeout: 30_000 }).toBe(5);
      const nombres: string[] = await S(page, (s) => s.plates.map((p: any) => p.name));
      expect(nombres).toEqual(['Placa 1', 'Mi base', 'Placa 3', 'Placa 4', 'Placa 5']);
      const ins = page.getByTestId('plate-badge');
      const n = await ins.count();
      for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 12))) {
        const nombre = /Placa \d+/.exec((await ins.nth(i).getAttribute('aria-label')) ?? '')![0];
        await expect(ins.nth(i)).toHaveText(`P${nombres.indexOf(nombre) + 1}`);
      }
      await page.keyboard.press('Control+z');
      await expect.poll(() => S(page, (s) => s.plates.length)).toBe(3);
    });
  });
}
