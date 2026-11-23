/**
 * @file e2e/ux3-edicion-arbol.spec.ts
 * @description Árbol de Escena: el clic en el centro de la fila selecciona (no oculta), los botones de la fila van
 * agrupados al borde derecho y aparecen al pasar el cursor o con foco (oculto o bloqueado siempre visibles),
 * Mayús+clic agrega un rango y Ctrl+clic alterna un elemento. El menú «Organizar» explica cada opción.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crear, seleccion, SHOTS } from './ux3-edicion-helpers';

async function preparar(page: Page): Promise<void> {
  await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [-40, 15, 0]);
  await crear(page, 'cylinder', undefined, [0, 15, 0]);
  await crear(page, 'sphere', undefined, [40, 15, 0]);
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await page.getByRole('tab', { name: /Escena/ }).click();
}

const fila = (page: Page, nombre: RegExp) => page.getByRole('treeitem', { name: nombre }).first();

test('clic al centro de la fila selecciona y no oculta; botones a la derecha al pasar el cursor', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await preparar(page);
  const cubo = fila(page, /Cubo/);
  const caja = (await cubo.boundingBox())!;
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  expect(await seleccion(page)).toEqual([expect.stringMatching(/Cubo/)]);
  expect(await page.evaluate(() => (window as any).__s.getState().objects.every((o: any) => o.visible))).toBe(true);

  // Sin cursor encima (ratón lejos), los botones no ocupan la fila; al pasar el cursor quedan al borde derecho.
  await page.mouse.move(700, 450);
  const ojo = cubo.getByRole('button', { name: /Ocultar/ });
  await expect(ojo).toBeHidden();
  await cubo.hover({ position: { x: 20, y: caja.height / 2 } });
  await expect(ojo).toBeVisible();
  const ojoCaja = (await ojo.boundingBox())!;
  expect(ojoCaja.x).toBeGreaterThan(caja.x + caja.width / 2 + 8);
  await page.screenshot({ path: `${SHOTS}/4-fila-hover.png` });

  // Ocultar con el botón: el ojo tachado queda visible aunque el cursor se vaya.
  await ojo.click();
  await page.mouse.move(700, 450);
  await expect(cubo.getByRole('button', { name: /Mostrar/ })).toBeVisible();
  expect(errs).toEqual([]);
});

for (const [ancho, alto, tema] of [[1024, 768, 'dark'], [390, 844, 'light']] as const) {
  test(`a ${ancho} px (${tema}) el clic en la zona del nombre selecciona sin ocultar`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    const errs = await abrir(page, ancho, alto);
    await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
    await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [-40, 15, 0]);
    await crear(page, 'sphere', undefined, [40, 15, 0]);
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    if (ancho < 900) await page.getByRole('button', { name: 'Formas', exact: true }).click();
    await page.getByRole('tab', { name: /Escena/ }).click();
    const cubo = fila(page, /Cubo/);
    await cubo.click({ position: { x: 40, y: 12 } });
    expect(await seleccion(page)).toEqual([expect.stringMatching(/Cubo/)]);
    expect(await page.evaluate(() => (window as any).__s.getState().objects.every((o: any) => o.visible))).toBe(true);
    await page.screenshot({ path: `${SHOTS}/4-fila-${ancho}-${tema}.png` });
    expect(errs).toEqual([]);
  });
}

test('Mayús+clic agrega un rango y Ctrl+clic alterna un elemento', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await preparar(page);
  await fila(page, /Cubo/).click({ position: { x: 30, y: 10 } });
  await fila(page, /Esfera/).click({ position: { x: 30, y: 10 }, modifiers: ['Shift'] });
  expect((await seleccion(page)).length).toBe(3);
  await fila(page, /Cilindro/).click({ position: { x: 30, y: 10 }, modifiers: ['Control'] });
  const sel = await seleccion(page);
  expect(sel.length).toBe(2);
  expect(sel.some((n) => /Cilindro/.test(n))).toBe(false);
  await fila(page, /Cilindro/).click({ position: { x: 30, y: 10 }, modifiers: ['Control'] });
  expect((await seleccion(page)).length).toBe(3);
  expect(errs).toEqual([]);
});
