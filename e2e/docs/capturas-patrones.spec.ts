/**
 * @file e2e/docs/capturas-patrones.spec.ts
 * @description Capturas de la guía «Patrón»: el panel lineal con la vista previa fantasma en el visor, la rejilla ya
 * aplicada y agrupada, el patrón circular de seis piezas alrededor del centro de la cama, y el espejo con copia. Piezas
 * creadas en la propia app, nunca modelos de terceros. ESCRITO SIN EJECUTAR: se genera con `npm run docs:capturas -- -g patrones`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, cmd } from './helpers';

const ver = (page: Page) => page.getByRole('dialog', { name: 'Patrón' });

async function abrirPanel(page: Page) {
  await page.keyboard.press('Control+K');
  await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('Patrón');
  await page.getByRole('option', { name: /Patrón…/ }).first().click();
  await expect(ver(page)).toBeVisible();
  await page.waitForTimeout(500);
}

test('patrón', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 4, height: 12, name: 'Tornillo', position: [-40, 0, 0], color: '#38bdf8' });
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), pieza.id);

  // 1) Panel lineal con la vista previa fantasma de las copias.
  await abrirPanel(page);
  await page.getByRole('spinbutton', { name: 'Piezas en total' }).fill('5');
  await page.getByRole('spinbutton', { name: 'Piezas en total' }).press('Enter');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/guia/img/patrones-01-lineal.png' });

  // 2) Rejilla de 5 × 2 aplicada: el grupo con nombre en el panel Escena.
  await page.getByTestId('pattern-grid').check();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/guia/img/patrones-02-rejilla.png' });
  await page.getByTestId('pattern-apply').click();
  await expect(ver(page)).toBeHidden();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/guia/img/patrones-03-grupo.png' });

  // 3) Circular: seis piezas alrededor del centro de la cama.
  await cmd(page, 'delete_object', { ids: await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.id)) });
  const rueda = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 5, height: 10, name: 'Pata', position: [50, 0, 0], color: '#f59e0b' });
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), rueda.id);
  await abrirPanel(page);
  await page.getByTestId('pattern-kind-circular').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/guia/img/patrones-04-circular.png' });

  // 4) Espejo con copia respecto del centro de la cama.
  await page.getByTestId('pattern-kind-mirror').click();
  await page.getByTestId('pattern-base-bed').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/guia/img/patrones-05-espejo.png' });
});
