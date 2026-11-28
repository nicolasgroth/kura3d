/**
 * @file e2e/centro-mensajes-usab.spec.ts
 * @description Usabilidad del centro de mensajes: el foco no cae a <body> al cerrar o usar un emergente ni al quitar
 * filas del histórico; ancho del emergente según su contenido; nombres accesibles únicos al quitar; posición estable
 * con la paleta o un diálogo abierto; Escape que respeta lo que está encima; contadores anunciados. 1024 y 1280 px,
 * tema claro y oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const toast = (page: Page, text: string, kind = 'info') =>
  page.evaluate(([x, k]) => (window as any).__s.getState().addToast(x, k), [text, kind]);
const icono = (page: Page, nombre: string | RegExp) => page.getByTestId('toast-center').getByRole('button', { name: nombre });
/** Descripción del elemento con foco: `body` si el foco se perdió. */
const foco = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return 'body';
    return `${a.tagName.toLowerCase()}|${a.getAttribute('role') ?? ''}|${a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 30) ?? ''}`;
  });
const enVisor = async (page: Page) => expect.poll(() => foco(page)).toMatch(/^canvas\|application\|/);

for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${w} px, tema ${scheme}`, () => {
      test.use({ viewport: { width: w, height: h }, colorScheme: scheme });

      test.beforeEach(async ({ page }) => {
        const errores: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
        page.on('pageerror', (e) => errores.push(String(e)));
        (page as any).__errores = errores;
        await abrir(page);
        await page.evaluate((s) => (window as any).__s.getState().setColorScheme(s), scheme);
      });
      test.afterEach(async ({ page }) => {
        expect((page as any).__errores).toEqual([]);
      });

      test('el foco vuelve al visor o al elemento previo al cerrar o usar un emergente', async ({ page }) => {
        // Cerrar con «Cerrar» desde el visor.
        await page.locator('canvas[role="application"]').focus();
        await toast(page, 'Aviso de prueba', 'error');
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.kura-toast')).toHaveCount(0);
        await enVisor(page);

        // Cerrar con Escape: el foco vuelve al botón que lo tenía antes.
        const previo = page.locator('.kura-topbar button:not([disabled])').first();
        await previo.focus();
        await toast(page, 'Otro aviso', 'warning');
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).focus();
        await page.keyboard.press('Escape');
        await expect(page.locator('.kura-toast')).toHaveCount(0);
        await expect(previo).toBeFocused();

        // Usar la acción del emergente.
        await page.locator('canvas[role="application"]').focus();
        await page.evaluate(() => (window as any).__s.getState().addToast('Aviso con acción', 'warning', { label: 'Hacer algo', run: () => undefined }));
        await page.locator('.kura-toast').getByRole('button', { name: 'Hacer algo' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.kura-toast')).toHaveCount(0);
        await enVisor(page);
      });

      test('en el histórico el foco pasa a la fila vecina, y al icono o al visor si el panel se vacía', async ({ page }) => {
        await toast(page, 'Primero uno', 'info');
        await toast(page, 'Segundo dos', 'info');
        await toast(page, 'Tercero tres', 'info');
        await toast(page, 'Un error aparte', 'error');
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
        await icono(page, /informativo/).click();
        const panel = page.getByRole('dialog', { name: 'Información' });
        // Nombres accesibles únicos, con el inicio del mensaje.
        const quitar = panel.getByRole('button', { name: /^Quitar: / });
        const nombres = await quitar.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
        expect(new Set(nombres).size).toBe(nombres.length);
        expect(nombres[0]).toContain('Tercero tres');
        // Quita la primera fila: el foco pasa a la siguiente.
        await quitar.first().focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => foco(page)).toContain('Quitar: Segundo dos');
        // Quita la última fila: pasa a la anterior.
        await panel.getByRole('button', { name: /^Quitar: Primero/ }).focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => foco(page)).toContain('Quitar: Segundo dos');
        // Última fila: el panel se cierra y el foco va al icono que queda (errores).
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect.poll(() => foco(page)).toContain('1 error');
        // Vaciar el último tipo: el foco va al visor.
        await icono(page, '1 error').click();
        await page.getByRole('dialog', { name: 'Errores' }).getByRole('button', { name: /^Quitar: / }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('toast-center')).toHaveCount(0);
        await enVisor(page);
      });

      test('usar una acción desde el panel no deja el foco en <body>', async ({ page }) => {
        await page.evaluate(() => (window as any).__s.getState().addToast('Aviso reparable', 'warning', { label: 'Hacer algo', run: () => undefined }));
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
        await icono(page, /advertencia/).click();
        await page.getByRole('dialog', { name: 'Advertencias' }).getByRole('button', { name: 'Hacer algo' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect.poll(async () => (await foco(page)) !== 'body').toBe(true);
      });

      test('el emergente se ajusta al contenido sin partir palabras y no se sale del visor', async ({ page }) => {
        const largo = 'caja-abierta-con-nombre-muy-largo.stl tiene la malla abierta y quedó con orientación mezclada: repárala antes de imprimir';
        await toast(page, 'Listo', 'info');
        const corto = await page.locator('.kura-toast').boundingBox();
        await toast(page, largo, 'warning');
        const caja = (await page.locator('.kura-toast').boundingBox())!;
        const visor = (await page.locator('.kura-viewport-wrap').boundingBox())!;
        expect(corto!.width).toBeLessThan(caja.width);
        expect(caja.width).toBeGreaterThan(300);
        expect(caja.width).toBeLessThanOrEqual(481);
        expect(caja.x + caja.width).toBeLessThanOrEqual(visor.x + visor.width);
        // Ninguna palabra queda partida: cada palabra del texto cabe en una sola línea (no se corta a mitad).
        const partidas = await page.evaluate(() => {
          const span = document.querySelector('.kura-toast > span') as HTMLElement;
          const node = span.firstChild as Text;
          const out: string[] = [];
          const re = /\S+/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(node.data))) {
            const r = document.createRange();
            r.setStart(node, m.index);
            r.setEnd(node, m.index + m[0].length);
            if (r.getClientRects().length > 1) out.push(m[0]);
          }
          return out;
        });
        expect(partidas).toEqual([]);
      });

      test('con la paleta abierta el emergente queda en su lugar habitual y no tapa el diálogo', async ({ page }) => {
        await toast(page, 'Aviso en su sitio', 'error');
        const antes = (await page.locator('.kura-toast').boundingBox())!;
        await page.keyboard.press('Control+k');
        await expect(page.locator('dialog[open]')).toHaveCount(1);
        await page.waitForTimeout(500);
        const despues = (await page.locator('.kura-toast').boundingBox())!;
        expect(Math.abs(despues.x - antes.x)).toBeLessThanOrEqual(2);
        // Misma columna; en vertical solo cede lo justo si el lugar habitual cae sobre el diálogo.
        expect(despues.y + despues.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        expect(Math.abs(despues.y - antes.y)).toBeLessThanOrEqual(150);
        const dialogo = (await page.locator('dialog[open]').boundingBox())!;
        const solapa = despues.x < dialogo.x + dialogo.width && despues.x + despues.width > dialogo.x && despues.y < dialogo.y + dialogo.height && despues.y + despues.height > dialogo.y;
        // Si pisara al diálogo quedaría detrás del velo, nunca dentro de él.
        if (solapa) expect(await page.locator('dialog[open] .kura-toast').count()).toBe(0);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
      });

      test('Escape cierra la paleta y los diálogos aunque el panel del histórico esté abierto', async ({ page }) => {
        await toast(page, 'Algo informativo', 'info');
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
        await icono(page, /informativo/).click();
        await expect(page.getByRole('dialog', { name: 'Información' })).toBeVisible();
        await page.evaluate(() => (window as any).__s.getState().setCommandPaletteOpen(true));
        await expect(page.locator('dialog[open]')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        // Diálogo de Atajos encima del panel.
        await page.evaluate(() => (window as any).__s.setState({ activeDialog: 'shortcuts' }));
        await expect(page.locator('dialog[open]')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog[open]')).toHaveCount(0);
        // Sin modal, Escape sí cierra el panel y devuelve el foco al icono.
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Información' })).toHaveCount(0);
        await expect(icono(page, /informativo/)).toBeFocused();
      });

      test('los contadores se anuncian en una región discreta que cambia con ellos', async ({ page }) => {
        const live = page.getByTestId('toast-center-live');
        await expect(live).toHaveCount(1);
        await toast(page, 'Uno', 'info');
        await expect(live).toHaveText('1 mensaje informativo');
        await toast(page, 'Dos', 'error');
        await expect(live).toHaveText('1 error, 1 mensaje informativo');
        await expect(live).toHaveAttribute('aria-live', 'polite');
      });
    });
  }
}
