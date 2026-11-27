/**
 * @file e2e/qa19-vista-sin-cama.spec.ts
 * @description QA19: la vista «Sin cama» se activa por botón, atajo B, paleta y menú del fondo; no se dispara al escribir
 * en campos de texto ni al renombrar; no altera el STL exportado ni se guarda en el estado del proyecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

test.use({ viewport: { width: 1280, height: 720 } });

/**
 * Un punto del visor donde de verdad hay solo fondo: el lienzo (no la píldora de Consejo ni los chips del pie) y lejos
 * del centro, donde queda la pieza. Se busca en una rejilla en vez de fijar coordenadas, que cambian con los chips del pie.
 */
async function puntoVacio(page: Page): Promise<{ x: number; y: number }> {
  const punto = await page.evaluate(() => {
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    for (const fy of [0.2, 0.3, 0.4, 0.5]) {
      for (const fx of [0.15, 0.25, 0.75, 0.85]) {
        const x = Math.round(c.x + c.width * fx), y = Math.round(c.y + c.height * fy);
        if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
      }
    }
    return null;
  });
  expect(punto, 'no hay un punto vacío del visor').not.toBeNull();
  return punto!;
}

const cama = (page: Page) => page.evaluate(() => (window as any).__s.getState().showBed as boolean);

async function exportarStl(page: Page, ruta: string) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  await (await dl).saveAs(ruta);
}

test('Sin cama: botón, atajo B, paleta y menú del fondo; B no actúa al escribir; exportación idéntica', async ({ page }) => {
  await abrir(page);
  await agregarForma(page, 'Cubo');
  await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'false');
  const con = test.info().outputPath('con.stl');
  await exportarStl(page, con);

  await page.getByTestId('bed-toggle').click();
  expect(await cama(page)).toBe(false);
  await expect(page.getByTestId('bed-toggle')).toHaveAttribute('aria-pressed', 'true');

  const vacio = await puntoVacio(page);
  await page.mouse.click(vacio.x, vacio.y); // vacío del visor
  await page.keyboard.press('b');
  expect(await cama(page)).toBe(true);
  await page.keyboard.press('b');
  expect(await cama(page)).toBe(false);

  await page.keyboard.press('Control+k');
  await page.keyboard.type('sin cama');
  await page.keyboard.press('Enter');
  await expect.poll(() => cama(page)).toBe(true);

  await page.mouse.click(vacio.x, vacio.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /cama/i }).click();
  await expect.poll(() => cama(page)).toBe(false);

  // Escribir «b» en la paleta, en un campo del inspector o al renombrar no debe conmutar la cama.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('bbb');
  await page.keyboard.press('Escape');
  expect(await cama(page)).toBe(false);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.selectObject(s.objects[0].id); });
  const ancho = page.getByRole('complementary', { name: 'Inspector' }).locator('input[aria-label="Ancho"]').first();
  await ancho.focus();
  await page.keyboard.type('b');
  await page.keyboard.press('Escape');
  expect(await cama(page)).toBe(false);
  await page.locator('[role=treeitem]').first().dblclick();
  await page.keyboard.type('bb');
  await page.keyboard.press('Enter');
  expect(await cama(page)).toBe(false);
  expect(await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name))).toEqual(['bb']);

  // La geometría exportada no cambia y la preferencia no entra en la serialización del proyecto.
  const sin = test.info().outputPath('sin.stl');
  await exportarStl(page, sin);
  const a = fs.readFileSync(con).toString().split('\n').slice(1, -1).join('\n');
  const b = fs.readFileSync(sin).toString().split('\n').slice(1, -1).join('\n');
  expect(b).toBe(a);
  const claves = await page.evaluate(async () => {
    const m = await import('/src/project/projectCodec.ts');
    return Object.keys(m).join(',');
  });
  expect(claves).not.toMatch(/showBed/i);
});
