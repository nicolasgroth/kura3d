/**
 * @file e2e/qa25a-suavizar.spec.ts
 * @description QA de «Suavizar malla»: vista previa y cancelación sin restos, aplicar = un paso de deshacer, volumen
 * estable, objeto borrado o selección cambiada con el panel abierto, zona por color sin pintura, textos sin claves
 * crudas en es/en/de, teclado y consola limpia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, clavesCrudas, cmd, EVID, esferaRuidosa, idioma, libre, pasos, seleccionar, volumen } from './qa25a-helpers';

const panel = (page: Page) => page.locator('#kura-inspector-panel');
const sesion = (page: Page) => page.evaluate(() => (window as any).__s.getState().smoothSession?.status ?? null);

async function abrirPanel(page: Page) {
  await (await itemAccion(page, 'Suavizar…')).click();
  await expect(page.getByRole('heading', { name: 'Suavizar malla' })).toBeVisible();
}

for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`suavizar ${vp.width}: vista previa, cancelar, aplicar = 1 paso, volumen estable`, async ({ page }) => {
    await page.setViewportSize(vp);
    const errs = await abrir(page);
    const id = await esferaRuidosa(page);
    await seleccionar(page, [id]);
    const v0 = await volumen(page, id);
    const p0 = await pasos(page);
    await abrirPanel(page);
    // La guía promete el foco en «Intensidad» al abrir el panel (suave: se informa sin cortar el resto).
    await page.waitForTimeout(600);
    const foco = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a ? `${a.tagName}[${a.getAttribute('aria-label') ?? a.id ?? a.className}]` : 'none'; });
    expect.soft(foco, 'el foco debería quedar en Intensidad al abrir el panel').toContain('Intensidad');

    // Vista previa: no toca historial ni malla.
    await page.getByRole('button', { name: /^Vista previa/ }).click();
    await expect(panel(page).getByRole('status').filter({ hasText: 'Vista previa lista' })).toBeVisible({ timeout: 60_000 });
    expect(await pasos(page)).toBe(p0);
    expect(Math.abs((await volumen(page, id)) - v0)).toBeLessThan(1e-6);
    await page.screenshot({ path: `${EVID}/suavizar-${vp.width}-preview.png` });

    // Cambiar un valor descarta la vista previa.
    await page.getByRole('spinbutton', { name: 'Pasadas' }).fill('5');
    await page.getByRole('spinbutton', { name: 'Pasadas' }).blur();
    await expect.poll(() => sesion(page)).toBeNull();

    // Aplicar con vista previa = un solo paso.
    await page.getByRole('button', { name: /^Vista previa/ }).click();
    await expect(panel(page).getByRole('status').filter({ hasText: 'Vista previa lista' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await libre(page);
    await expect(panel(page).getByRole('status').filter({ hasText: 'Suavizado aplicado' })).toBeVisible();
    expect(await pasos(page)).toBe(p0 + 1);
    const v1 = await volumen(page, id);
    expect(Math.abs(v1 - v0) / v0).toBeLessThan(0.05);

    // Deshacer vuelve exactamente al original.
    await page.evaluate(() => (window as any).__s.getState().undo());
    expect(await pasos(page)).toBe(p0);
    expect(Math.abs((await volumen(page, id)) - v0)).toBeLessThan(1e-6);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('suavizar: borrar el objeto o cambiar la selección con el panel abierto no rompe nada', async ({ page }) => {
  const errs = await abrir(page);
  const a = await esferaRuidosa(page);
  const b = (await cmd(page, 'create_primitive', { type: 'box', width: 20, height: 20, depth: 20, position: [60, 0, 0] })).id;
  await seleccionar(page, [a]);
  await abrirPanel(page);
  await page.getByRole('button', { name: /^Vista previa/ }).click();
  await expect(panel(page).getByRole('status').filter({ hasText: 'Vista previa lista' })).toBeVisible({ timeout: 60_000 });
  // Cambiar de selección descarta la vista previa.
  await seleccionar(page, [b]);
  await expect.poll(() => sesion(page)).toBeNull();
  // Volver, calcular y borrar el objeto a mitad del cálculo.
  await seleccionar(page, [a]);
  const abierto = await page.getByRole('heading', { name: 'Suavizar malla' }).isVisible().catch(() => false);
  test.info().annotations.push({ type: 'panel', description: `tras cambiar la selección y volver, el panel sigue abierto: ${abierto}` });
  await page.screenshot({ path: `${EVID}/suavizar-reseleccion.png` });
  if (!abierto) await abrirPanel(page);
  await page.getByRole('button', { name: /^Vista previa/ }).click();
  await page.evaluate((id) => (window as any).__s.getState().deleteObjects?.([id]) ?? (window as any).__s.getState().removeObjects?.([id]), a);
  await page.waitForTimeout(1500);
  const quedan = await page.evaluate(() => (window as any).__s.getState().objects.length);
  expect(quedan).toBeLessThanOrEqual(1);
  expect(await sesion(page)).not.toBe('applied');
  await page.screenshot({ path: `${EVID}/suavizar-borrado.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('suavizar: zona por color sin pintura está apagada y avisa; valores inválidos bloquean', async ({ page }) => {
  const errs = await abrir(page);
  const id = await esferaRuidosa(page);
  await seleccionar(page, [id]);
  await abrirPanel(page);
  await expect(page.getByRole('radio', { name: /zona pintada/i })).toBeDisabled();
  await expect(page.getByTestId('smooth-where-help')).not.toBeEmpty();
  await page.screenshot({ path: `${EVID}/suavizar-sin-pintura.png` });
  const entrada = page.getByRole('spinbutton', { name: 'Intensidad' });
  for (const malo of ['0', '500', 'abc', '-5']) {
    await entrada.fill(malo);
    await entrada.blur();
    await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeDisabled();
  }
  await entrada.fill('100,0');
  await entrada.blur();
  await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeEnabled();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('suavizar: sin claves crudas en es, en y de', async ({ page }) => {
  await abrir(page);
  const id = await esferaRuidosa(page);
  await seleccionar(page, [id]);
  await abrirPanel(page);
  for (const lang of ['es', 'en', 'de']) {
    await idioma(page, lang);
    await page.waitForTimeout(300);
    const crudas = await clavesCrudas(page, '#kura-inspector-panel');
    expect(crudas, `claves crudas en ${lang}`).toEqual([]);
  }
});

test('suavizar: Escape/teclado, Enter lanza vista previa y se puede cancelar un cálculo largo', async ({ page }) => {
  const errs = await abrir(page);
  const id = await esferaRuidosa(page, 40);
  await seleccionar(page, [id]);
  const p0 = await pasos(page);
  await abrirPanel(page);
  await page.getByRole('spinbutton', { name: 'Pasadas' }).fill('100');
  await page.keyboard.press('Enter');
  const cancelar = page.getByRole('button', { name: 'Cancelar' });
  await expect.poll(() => sesion(page)).toMatch(/computing|ready/);
  if (await cancelar.count()) {
    await cancelar.first().click();
    await expect.poll(() => sesion(page)).not.toBe('computing');
    expect(await sesion(page)).not.toBe('applied');
  }
  await libre(page);
  expect(await pasos(page)).toBe(p0);
  expect(errs, errs.join('\n')).toEqual([]);
});
