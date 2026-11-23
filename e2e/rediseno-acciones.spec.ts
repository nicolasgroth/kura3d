/**
 * @file e2e/rediseno-acciones.spec.ts
 * @description Menú «Acciones» de la barra superior: es un menú accesible (`role="menu"`, grupos, atajos a la
 * derecha, flechas, Esc devuelve el foco), cada acción hace lo mismo que su entrada anterior (abre el mismo
 * diálogo o panel, o corre la misma operación) y registra `activeAction`; sin selección los ítems salen
 * deshabilitados con el motivo a la vista.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-acciones.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

/** Lee una propiedad del store. */
const st = (page: Page, key: string) => page.evaluate((k) => (window as any).__s.getState()[k], key);

async function abrirMenu(page: Page) {
  await page.getByRole('button', { name: 'Acciones', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Acciones' });
  await expect(menu).toBeVisible();
  return menu;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
});

test('sin selección: ítems deshabilitados con el motivo; teclado y Esc', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Acciones', exact: true });
  const menu = await abrirMenu(page);
  for (const group of ['Preparar para imprimir', 'Malla', 'Separar y combinar', 'Posición y tipo', 'Analizar']) {
    await expect(menu.getByRole('group', { name: group })).toBeVisible();
  }
  const reparar = menu.getByRole('menuitem', { name: 'Reparar malla' });
  await expect(reparar).toBeDisabled();
  await expect(reparar).toContainText('Selecciona un objeto primero');
  await expect(menu.getByRole('menuitem', { name: 'Generar molde…' })).toContainText('La escena está vacía');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/rediseno/acciones-vacio.png' });
});

test('cada acción hace lo mismo que su entrada anterior y registra la acción activa', async ({ page }) => {
  await page.evaluate(() => (window as any).__s.getState().createStarterCube());
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBe(1);

  // Dividir para imprimir: el mismo diálogo que Shift+C.
  let menu = await abrirMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Dividir para imprimir…' })).toContainText('Shift+C');
  await menu.getByRole('menuitem', { name: 'Dividir para imprimir…' }).click();
  expect(await st(page, 'activeDialog')).toBe('splitForBed');
  expect(await st(page, 'activeAction')).toBe('splitForBed');
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));

  // Generar molde: el mismo diálogo que Shift+M.
  menu = await abrirMenu(page);
  await menu.getByRole('menuitem', { name: 'Generar molde…' }).click();
  expect(await st(page, 'activeDialog')).toBe('mold');
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));

  // Ahuecar: lleva el inspector a su panel (como el menú contextual).
  menu = await abrirMenu(page);
  await menu.getByRole('menuitem', { name: 'Ahuecar…' }).click();
  await expect(page.getByText(/Ahuecar/).first()).toBeVisible();
  expect(await st(page, 'activeAction')).toBe('hollow');

  // Simplificar: misma petición que el aviso de malla pesada.
  menu = await abrirMenu(page);
  await menu.getByRole('menuitem', { name: 'Simplificar…' }).click();
  expect(await page.evaluate(() => { const s = (window as any).__s.getState(); return s.simplifyRequest?.id === s.selectedIds[0]; })).toBe(true);

  // Convertir en ▸ Negativo: igual que el menú contextual.
  menu = await abrirMenu(page);
  await menu.getByRole('menuitem', { name: 'Convertir en' }).click();
  await page.getByRole('menuitem', { name: 'Negativo' }).click();
  expect(await page.evaluate(() => (window as any).__s.getState().objects[0].role)).toBe('negative');
  expect(await st(page, 'activeAction')).toBe('convert');

  // Elegir una herramienta limpia la acción activa (un único lugar dice qué está activo).
  await page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Medir' }).click();
  expect(await st(page, 'activeAction')).toBe(null);

  // Agrupar pide dos objetos: deshabilitado con motivo.
  menu = await abrirMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Agrupar', exact: true })).toContainText('Selecciona dos o más objetos');
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/rediseno/acciones-menu.png' });
  await page.keyboard.press('Escape');
});
