/**
 * @file e2e/qa25j-volver-esc.spec.ts
 * @description QA 26-nov (J): «Volver» y Esc de las herramientas. Pasan: un solo «Volver» en Mover, Rotar, Escalar, Pintar,
 * Borrar y Medir; Esc con el foco en un campo o en «Volver» (Tab) cierra y devuelve el foco al botón de la herramienta.
 * Documentados con test.fail (defectos abiertos): Esc con el foco en el visor no cierra el panel, y Cortar muestra dos «Volver».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const S = (page: Page, fn: (s: any) => unknown) => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const volver = (page: Page) => page.getByRole('button', { name: /^Volver$/ });

async function abrirHerramienta(page: Page, boton: string) {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo', position: [0, 15, 0] });
  await S(page, (s) => s.setSelection([s.objects[0].id]));
  await page.getByRole('button', { name: new RegExp('^' + boton) }).first().click();
  await expect(page.getByTestId('panel-back').first()).toBeVisible();
}

for (const boton of ['Mover', 'Rotar', 'Escalar', 'Pintar', 'Esculpir / Borrar', 'Medir']) {
  test(`${boton}: un solo Volver y Esc con el foco en «Volver» (Tab) cierra con un Esc`, async ({ page }) => {
    await abrirHerramienta(page, boton);
    await expect(volver(page)).toHaveCount(1);
    await page.getByTestId('panel-back').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('panel-back')).toHaveCount(0);
    await expect(page.getByRole('button', { name: new RegExp('^' + boton) }).first()).toBeFocused();
  });
}

for (const boton of ['Mover', 'Pintar']) {
  test.fail(`${boton}: Esc con el foco en el visor cierra el panel`, async ({ page }) => {
    await abrirHerramienta(page, boton);
    await page.evaluate(() => (document.querySelector('.kura-viewport-wrap canvas') as HTMLElement).focus());
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('panel-back')).toHaveCount(0, { timeout: 3000 });
  });
}

test.fail('Cortar: un solo Volver', async ({ page }) => {
  await abrirHerramienta(page, 'Cortar');
  await expect(volver(page)).toHaveCount(1);
});
