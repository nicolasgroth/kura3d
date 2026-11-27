/**
 * @file e2e/centro-mensajes.spec.ts
 * @description Centro de mensajes: un solo emergente a la vista, todo emergente cerrable que pasa al histórico de su
 * tipo, tres iconos con contador en el pie del visor (errores, advertencias, información) que aparecen solo si hay
 * mensajes, panel con teclado y mouse (Esc devuelve el foco al icono, un solo panel abierto), cierre automático de los
 * informativos a los 6 s, mensajes ligados a una pieza que se van al borrarla. 1024 y 1440 px, tema claro y oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/centro-mensajes';
const toast = (page: Page, text: string, kind = 'info') =>
  page.evaluate(([x, k]) => (window as any).__s.getState().addToast(x, k), [text, kind]);
const icono = (page: Page, nombre: string | RegExp) => page.getByTestId('toast-center').getByRole('button', { name: nombre });

for (const [w, h] of [[1024, 768], [1440, 900]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${w} px, tema ${scheme}`, () => {
      test.use({ viewport: { width: w, height: h }, colorScheme: scheme });

      test('un solo emergente, iconos por tipo con contador y panel con teclado y mouse', async ({ page }) => {
        const errores: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
        page.on('pageerror', (e) => errores.push(String(e)));
        await abrir(page);
        await page.evaluate((s) => (window as any).__s.getState().setColorScheme(s), scheme);
        // Sin mensajes no hay iconos.
        await expect(page.getByTestId('toast-center')).toHaveCount(0);

        // Cinco avisos seguidos: solo el último a la vista, sin «N avisos más» ni «Cerrar todos».
        await page.evaluate(() => {
          const s = (window as any).__s.getState();
          s.addToast('Pieza duplicada', 'info');
          s.addToast('Se guardó el proyecto', 'success');
          s.addToast('Malla con bordes abiertos', 'warning');
          s.addToast('No se pudo importar el archivo', 'error');
          s.addToast('Último informativo', 'info');
        });
        await expect(page.locator('.kura-toast')).toHaveCount(1);
        await expect(page.locator('.kura-toast')).toContainText('Último informativo');
        await expect(page.getByRole('button', { name: /más|Cerrar todos|Mostrar menos/ })).toHaveCount(0);

        // Tres iconos con nombre accesible en texto; el color no es la única señal.
        const err = icono(page, '1 error');
        const adv = icono(page, '1 advertencia');
        const inf = icono(page, '3 mensajes informativos');
        await expect(err).toBeVisible();
        await expect(adv).toBeVisible();
        await expect(inf).toBeVisible();
        await expect(err).toHaveAttribute('title', /Ver los mensajes/);
        for (const b of [err, adv, inf]) expect(await b.locator('svg').count()).toBe(1);
        await page.screenshot({ path: `${SHOTS}/iconos-${w}-${scheme}.png` });

        // Todo emergente es cerrable: al cerrarlo sigue en el histórico.
        await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
        await expect(page.locator('.kura-toast')).toHaveCount(0);
        await expect(inf).toBeVisible();

        // Mouse: abrir el panel de información, del más nuevo al más antiguo.
        await inf.click();
        const panel = page.getByRole('dialog', { name: 'Información' });
        await expect(panel).toBeVisible();
        await expect(panel.locator('li')).toHaveText([/Último informativo/, /Se guardó el proyecto/, /Pieza duplicada/]);
        await page.screenshot({ path: `${SHOTS}/panel-${w}-${scheme}.png` });
        // Un solo panel a la vez.
        await err.click();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(page.getByRole('dialog', { name: 'Errores' })).toBeVisible();
        // Quitar uno a uno y Vaciar.
        await page.getByRole('dialog', { name: 'Errores' }).getByRole('button', { name: 'Quitar este mensaje' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(icono(page, /error/)).toHaveCount(0);
        await inf.click();
        await page.getByRole('dialog', { name: 'Información' }).getByRole('button', { name: 'Quitar este mensaje' }).first().click();
        await expect(icono(page, '2 mensajes informativos')).toBeVisible();
        await page.getByRole('dialog', { name: 'Información' }).getByRole('button', { name: /^Vaciar/ }).click();
        await expect(page.getByTestId('toast-center').getByRole('button', { name: /informativo/ })).toHaveCount(0);
        await expect(adv).toBeVisible();

        // Teclado: Enter abre, Esc cierra y el foco vuelve al icono.
        await adv.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog', { name: 'Advertencias' })).toBeVisible();
        await expect(adv).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(adv).toBeFocused();
        expect(errores).toEqual([]);
      });
    });
  }
}

test('informativos pasan solos a los 6 s (pausa con el cursor); errores y advertencias esperan', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page);
  await toast(page, 'Aviso que se va solo', 'info');
  await toast(page, 'Éxito que se va solo', 'success');
  await expect(page.locator('.kura-toast')).toContainText('Éxito que se va solo');
  await page.locator('.kura-toast').hover();
  await page.waitForTimeout(7000);
  await expect(page.locator('.kura-toast')).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(page.locator('.kura-toast')).toHaveCount(0, { timeout: 9000 });
  await toast(page, 'Esto no caduca', 'warning');
  await page.waitForTimeout(7000);
  await expect(page.locator('.kura-toast')).toContainText('Esto no caduca');
  await toast(page, 'Esto tampoco', 'error');
  await page.waitForTimeout(7000);
  await expect(page.getByRole('alert')).toContainText('Esto tampoco');
  // Escape estando enfocado lo cierra.
  await page.getByRole('alert').getByRole('button', { name: 'Cerrar' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-toast')).toHaveCount(0);
  await expect(icono(page, '1 error')).toBeVisible();
});

test('la acción de un mensaje sigue operable desde el panel y los mensajes de una pieza se van al borrarla', async ({ page }) => {
  await abrir(page);
  const id = await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const o = await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    (window as any).__corrio = 0;
    s.addToast('La pieza tiene la malla abierta', 'warning', { label: 'Reparar malla', run: () => { (window as any).__corrio += 1; }, targetIds: [o.id] }, { objectIds: [o.id] });
    s.addToast('Otro mensaje sin pieza', 'warning');
    return o.id as string;
  });
  await page.locator('.kura-toast').getByRole('button', { name: 'Cerrar' }).click();
  await icono(page, '2 advertencias').click();
  const panel = page.getByRole('dialog', { name: 'Advertencias' });
  await panel.locator('li', { hasText: 'malla abierta' }).getByRole('button', { name: 'Reparar malla' }).click();
  expect(await page.evaluate(() => (window as any).__corrio)).toBe(1);
  await expect(icono(page, '2 advertencias')).toBeFocused();
  // Ya aplicada: deshabilitada con el motivo.
  await icono(page, '2 advertencias').click();
  await expect(panel.locator('li', { hasText: 'malla abierta' }).getByRole('button', { name: 'Reparar malla' })).toBeDisabled();
  await page.keyboard.press('Escape');
  // Borrar la pieza quita su mensaje del histórico; el que no tiene pieza se queda.
  await page.evaluate((i) => (window as any).__s.getState().deleteObjects([i]), id);
  await expect(icono(page, '1 advertencia')).toBeVisible();
});

test('un mensaje con acción vigente no caduca ni lo desplaza un informativo; un error sí lo desplaza', async ({ page }) => {
  test.setTimeout(60000);
  await abrir(page);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.addToast('Oferta con acción', 'info', { label: 'Hacer algo', run: () => undefined, applicable: () => true });
    s.addToast('Informativo posterior', 'info');
    s.addToast('Éxito posterior', 'success');
  });
  const emergente = page.locator('.kura-toast');
  await expect(emergente).toHaveCount(1);
  await expect(emergente).toContainText('Oferta con acción');
  await expect(icono(page, '3 mensajes informativos')).toBeVisible();
  // No caduca a los 6 s.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(7500);
  await expect(emergente).toContainText('Oferta con acción');
  // Un error sí la desplaza; la oferta queda en el histórico con su acción operable.
  await toast(page, 'Algo falló', 'error');
  await expect(emergente).toContainText('Algo falló');
  await icono(page, '3 mensajes informativos').click();
  await expect(page.getByRole('dialog', { name: 'Información' }).locator('li', { hasText: 'Oferta con acción' }).getByRole('button', { name: 'Hacer algo' })).toBeEnabled();
});
