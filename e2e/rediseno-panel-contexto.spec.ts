/**
 * @file e2e/rediseno-panel-contexto.spec.ts
 * @description Panel derecho contextual (rediseño, lote 2): sin selección muestra el proyecto; con un objeto, su
 * resumen y los accesos a sus operaciones; una acción (menú Acciones, menú contextual o acceso del resumen)
 * muestra solo sus opciones, con foco dentro, y Esc o «Volver» regresan al resumen devolviendo el foco al
 * control que la abrió. El separador cambia el ancho con teclado (y se recuerda), el panel se pliega y se
 * abre solo al activar una acción. Deja capturas en `.eval-tmp/rediseno-2/` (claro y oscuro, 1280 y 1440).
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-panel-contexto.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir } from './ux-escena-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/rediseno-2';
const st = (page: Page, key: string) => page.evaluate((k) => (window as any).__s.getState()[k], key);
const panel = (page: Page) => page.locator('#kura-inspector-panel');

async function cubo(page: Page) {
  await page.evaluate(() => (window as any).__s.getState().createStarterCube());
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBe(1);
}


let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
});

// Cero errores en la consola del navegador durante cada recorrido.
test.afterEach(() => {
  expect(errores).toEqual([]);
});

test('sin selección muestra el proyecto; con un objeto, su resumen', async ({ page }) => {
  await expect(panel(page)).toHaveAttribute('data-context', 'project');
  await expect(panel(page).getByRole('heading', { name: 'Proyecto', exact: true })).toBeVisible();
  await expect(page.getByTestId('panel-project-count')).toHaveText('0');
  await expect(panel(page).getByText('Cama activa')).toBeVisible();
  await page.screenshot({ path: `${OUT}/proyecto-1440.png` });

  await cubo(page);
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
  await expect(page.getByTestId('panel-live')).toHaveText(/Panel: /);
  // Resumen: nombre, medidas, operaciones; sin las opciones de Ahuecar a la vista.
  await expect(panel(page).locator('#kura-obj-name')).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Ahuecar…' })).toBeVisible();
  await expect(panel(page).getByText('Grosor de pared', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/objeto-1440.png` });

  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await expect(panel(page)).toHaveAttribute('data-context', 'project');
  await expect(page.getByTestId('panel-project-count')).toHaveText('1');
});

test('una acción muestra solo sus opciones; Esc vuelve y devuelve el foco', async ({ page }) => {
  await cubo(page);
  const trigger = page.getByRole('button', { name: 'Acciones', exact: true });
  await (await itemAccion(page, 'Ahuecar…')).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'action');
  await expect(panel(page).getByRole('heading', { name: 'Ahuecar' })).toBeVisible();
  await expect(panel(page).locator('#kura-obj-name')).toHaveCount(0);
  await expect(page.getByTestId('panel-live')).toHaveText('Panel: opciones de Ahuecar');
  // El foco pasó al panel.
  await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('#kura-inspector-panel')))).toBe(true);
  await page.screenshot({ path: `${OUT}/accion-ahuecar-1440.png` });

  // Con el foco en el grosor de pared, el primer Esc revierte el campo (y lo suelta); el siguiente vuelve.
  await page.keyboard.press('Escape');
  if ((await panel(page).getAttribute('data-context')) === 'action') await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
  expect(await st(page, 'activeAction')).toBe(null);
  await expect(trigger).toBeFocused();

  // Acceso del resumen: abre Textura sin ejecutarla; «Volver» regresa al botón que la abrió.
  const acceso = panel(page).getByRole('button', { name: 'Textura superficial…' });
  await acceso.click();
  await expect(panel(page).getByRole('heading', { name: 'Textura superficial' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Volver' }).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
  await expect(panel(page).getByRole('button', { name: 'Textura superficial…' })).toBeFocused();

  // Elegir una herramienta de la barra vertical cierra la acción: Mover muestra su transformación (lote 3b) y
  // Seleccionar, el resumen.
  await acceso.click();
  await page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Mover' }).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'tool');
  expect(await st(page, 'activeAction')).toBe(null);
  await page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Seleccionar' }).click();
  await expect(panel(page)).toHaveAttribute('data-context', 'object');
});

test('menú contextual: Ahuecar abre el panel con solo sus opciones', async ({ page }) => {
  await cubo(page);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.setActiveAction(null);
  });
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('sin visor');
  // El cubo inicial queda al centro del visor.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  // El primer nivel del menú es corto: Ahuecar vive un submenú más adentro, en «Preparar para imprimir».
  await expect(page.getByRole('menuitem', { name: /Ahuecar/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Preparar para imprimir' }).click();
  const item = page.getByRole('menuitem', { name: /Ahuecar/ }).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(panel(page)).toHaveAttribute('data-context', 'action');
  expect(await st(page, 'activeAction')).toBe('hollow');
});

test('ancho con teclado (se recuerda), plegar y abrir solo al activar una acción', async ({ page }) => {
  await cubo(page);
  const sep = page.getByRole('separator', { name: 'Ancho del panel' });
  await sep.focus();
  const before = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => panel(page).evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(Math.round(before + 32));
  await expect(sep).toHaveAttribute('aria-valuenow', String(Math.round(before + 32)));
  await page.keyboard.press('End');
  await expect(sep).toHaveAttribute('aria-valuenow', '560');
  await page.keyboard.press('Home');
  await expect(sep).toHaveAttribute('aria-valuenow', '248');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => localStorage.getItem('kura3d-right-panel-width'))).toBe('264');
  await page.screenshot({ path: `${OUT}/ancho-264-1440.png` });

  // Plegar: queda la tira con el botón; se recuerda.
  await page.getByRole('button', { name: 'Colapsar inspector derecho' }).click();
  await expect.poll(() => panel(page).evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(30);
  expect(await page.evaluate(() => localStorage.getItem('kura3d-right-panel-collapsed'))).toBe('1');
  // Una acción con opciones lo abre solo.
  await (await itemAccion(page, 'Detectar estructuras')).click();
  await expect.poll(() => panel(page).evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(200);
  await expect(panel(page).getByRole('heading', { name: 'Detectar estructuras' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kura3d-right-panel-collapsed'))).toBe(null);
});

test('capturas a 1280 en claro y oscuro: barra de vista con rótulos', async ({ page }) => {
  await cubo(page);
  for (const scheme of ['light', 'dark'] as const) {
    await page.evaluate((s) => (window as any).__s.getState().setColorScheme(s), scheme);
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole('toolbar', { name: 'Vista' }).getByText('Encuadrar')).toBeVisible();
      await page.screenshot({ path: `${OUT}/vista-${width}-${scheme}.png` });
    }
  }
});
