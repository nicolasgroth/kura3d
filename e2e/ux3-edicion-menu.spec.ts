/**
 * @file e2e/ux3-edicion-menu.spec.ts
 * @description Menú contextual del objeto: fondo opaco (token de superficie) en tema claro y oscuro, «Separar y
 * combinar» (grupo del menú «Acciones») con una descripción bajo Agrupar, Combinar y Unir, «Separar piezas sueltas»
 * deshabilitado con motivo si hay un solo cuerpo, submenús que abren al pasar el cursor y Escape que devuelve el foco a quien abrió el menú.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { aPixel } from './ux-movil-helpers';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

async function abrirMenu(page: Page): Promise<void> {
  const a = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  const b = await crear(page, 'cylinder', undefined, [50, 15, 0]);
  // Con los dos objetos seleccionados, Agrupar, Combinar y Unir están disponibles y muestran su descripción.
  await page.evaluate((ids) => (window as any).__s.getState().setSelection(ids), [a, b]);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
  const p = await aPixel(page, [0, 20, 0]);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.getByRole('menu').first()).toBeVisible();
}

for (const tema of ['light', 'dark'] as const) {
  test(`menú opaco y legible en tema ${tema}; Organizar explica cada opción`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    const errs = await abrir(page, 1440, 900);
    await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
    await abrirMenu(page);
    const menu = page.locator('.kura-context-menu').first();
    const fondo = await menu.evaluate((m) => getComputedStyle(m).backgroundColor);
    // Opaco: sin canal alfa parcial.
    expect(fondo).toMatch(/^rgb\(/);
    await menu.getByRole('menuitem', { name: 'Separar y combinar' }).click();
    const organizar = page.getByRole('menu', { name: 'Separar y combinar' });
    await organizar.scrollIntoViewIfNeeded();
    await expect(organizar.getByText('Se mueven juntos; siguen siendo objetos separados')).toBeVisible();
    await expect(organizar.getByText('Un solo objeto con varias piezas, sin fundirlas')).toBeVisible();
    await expect(organizar.getByText('Funde los volúmenes en un solo sólido')).toBeVisible();
    const separar = organizar.getByRole('menuitem', { name: 'Separar piezas sueltas' });
    await expect(separar).toBeDisabled();
    await expect(organizar.getByText(/una sola pieza/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/7-menu-${tema}.png` });
    expect(errs).toEqual([]);
  });
}

test('los submenús abren al pasar el cursor y Escape devuelve el foco', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await abrirMenu(page);
  const sub = page.getByRole('menuitem', { name: 'Posición y tipo' }).first();
  await sub.hover();
  await expect(sub).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-context-menu')).toHaveCount(0);
  // El menú se abrió con el lienzo: el foco vuelve al visor, no se pierde en el cuerpo de la página.
  expect(await page.evaluate(() => document.activeElement?.closest('.kura-viewport-wrap') !== null)).toBe(true);

  // Desde la fila del árbol (Mayús+F10), Escape vuelve al árbol.
  const arbol = page.getByRole('tree');
  await arbol.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(arbol).toBeFocused();
  expect(errs).toEqual([]);
});
