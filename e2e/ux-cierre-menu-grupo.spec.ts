/**
 * @file e2e/ux-cierre-menu-grupo.spec.ts
 * @description Las filas de grupo del árbol de Escena abren su menú contextual (clic derecho, Mayús+F10 y tecla
 * Menú) junto a la fila y fuera del visor, con Renombrar, Desagrupar, Combinar, Duplicar, Ocultar, Bloquear,
 * Exportar grupo… y Eliminar. Ocultar actúa sobre el grupo y Escape devuelve el foco al árbol.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-cierre';

async function prepararGrupo(page: Page, estrecho = false): Promise<void> {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    await (window as any).__s.getState().createPrimitive('sphere', undefined, {});
    const ids = (window as any).__s.getState().objects.map((o: any) => o.id);
    (window as any).__s.getState().groupObjects(ids, 'Conjunto');
  });
  // En pantallas estrechas «Escena» es un botón de la barra inferior (la hoja no repite las pestañas).
  if (estrecho) await page.getByRole('button', { name: 'Escena', exact: true }).click();
  else await page.getByRole('tab', { name: /Escena/ }).click();
}

const ITEMS = [/Renombrar/, /Desagrupar/, /Combinar en un objeto/, /Duplicar/, /Ocultar Conjunto/, /Bloquear Conjunto/, /Exportar grupo/, /Eliminar/];

test('clic derecho en una fila de grupo abre su menú junto a la fila, fuera del visor', async ({ page }) => {
  const errs: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.setViewportSize({ width: 1280, height: 800 });
  await prepararGrupo(page);
  const fila = page.getByRole('treeitem', { name: /Conjunto/ }).first();
  await fila.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: /Conjunto/ });
  await expect(menu).toBeVisible();
  for (const nombre of ITEMS) await expect(menu.getByRole('menuitem', { name: nombre })).toBeVisible();
  const caja = (await menu.boundingBox())!;
  const filaCaja = (await fila.boundingBox())!;
  expect(caja.y).toBeGreaterThanOrEqual(filaCaja.y - 4);
  expect(caja.y).toBeLessThanOrEqual(filaCaja.y + filaCaja.height + 4);
  expect(caja.x).toBeLessThanOrEqual(filaCaja.x + filaCaja.width);
  expect(await menu.evaluate((m) => Boolean(m.closest('.kura-viewport-wrap')))).toBe(false);
  await page.screenshot({ path: `${SHOTS}/menu-grupo-clic-derecho.png` });

  // Ocultar actúa sobre el grupo entero.
  await menu.getByRole('menuitem', { name: /Ocultar Conjunto/ }).click();
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => (window as any).__s.getState().groups[0].visible)).toBe(false);
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e))).toEqual([]);
});

test('Mayús+F10 y la tecla Menú abren el menú del grupo; Escape devuelve el foco al árbol', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await prepararGrupo(page);
  const arbol = page.getByRole('tree');
  await arbol.focus();
  // La fila activa es la primera (el grupo).
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: /Conjunto/ });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/menu-grupo-teclado.png` });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(arbol).toBeFocused();
  await page.keyboard.press('ContextMenu');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
});

test('el menú de grupo cabe a 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepararGrupo(page, true);
  const fila = page.getByRole('treeitem', { name: /Conjunto/ }).first();
  await fila.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: /Conjunto/ });
  await expect(menu).toBeVisible();
  const caja = (await menu.boundingBox())!;
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(390);
  expect(caja.y).toBeGreaterThanOrEqual(0);
  expect(caja.y + caja.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: `${SHOTS}/menu-grupo-390.png` });
});
