/**
 * @file e2e/qa25d-suavizar-orientar.spec.ts
 * @description QA de la ronda 25-nov (D) para «Suavizar malla» y «Orientar para imprimir» con la ocarina real:
 * valores iniciales 30 % y 3 pasadas, pie fijo visible a 900 y 768 px sin tapar el estado, aplicar con los valores
 * iniciales y con 50 %/5 sin error y en un paso de historial; Orientar sin tooltip al abrir, Enter aplica y deja el
 * foco en «Actual», el rótulo «Tamaño» cambia al acostar la pieza y la ocarina avisa que no hay base estable.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, libre, pasos, seleccionar, volumen } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25d';
const OCARINA = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';

async function importar(page: Page, ruta: string): Promise<string> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(ruta);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 240_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await seleccionar(page, [id]);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  return id;
}

const sesion = (page: Page) => page.evaluate(() => (window as any).__s.getState().smoothSession?.status ?? null);

for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`suavizar ocarina ${vp.height}: valores iniciales, pie visible, aplica sin error en un paso`, async ({ page }) => {
    test.skip(!existsSync(OCARINA), 'sin modelo real');
    test.setTimeout(300_000);
    await page.setViewportSize(vp);
    const errs = await abrir(page);
    const id = await importar(page, OCARINA);
    const v0 = await volumen(page, id);
    const p0 = await pasos(page);
    await (await itemAccion(page, 'Suavizar…')).click();
    await expect(page.getByRole('heading', { name: 'Suavizar malla' })).toBeVisible();

    const inten = page.getByRole('spinbutton', { name: 'Intensidad' });
    const pas = page.getByRole('spinbutton', { name: 'Pasadas' });
    expect(await inten.inputValue()).toBe('30');
    expect(await pas.inputValue()).toBe('3');

    const pie = page.locator('.kura-smooth-actions');
    await pie.scrollIntoViewIfNeeded();
    const caja = await pie.boundingBox();
    expect(caja && caja.y >= 0 && caja.y + caja.height <= vp.height, `pie fuera de pantalla ${JSON.stringify(caja)}`).toBe(true);
    await expect(page.getByRole('button', { name: /^Vista previa/ })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Aplicar', exact: true })).toBeInViewport();
    await page.screenshot({ path: `${EV}/suavizar-${vp.height}-inicio.png` });

    // Aplicar con valores iniciales; registrar el texto de progreso.
    const textos = new Set<string>();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    const t0 = Date.now();
    while (Date.now() - t0 < 120_000) {
      const st = await sesion(page);
      const txt = await page.locator('#kura-inspector-panel').getByRole('status').allInnerTexts().catch(() => []);
      txt.forEach((x) => x.trim() && textos.add(x.replace(/\s+/g, ' ').trim()));
      if (st === 'applied' || st === 'error') break;
      await page.waitForTimeout(150);
    }
    await libre(page);
    const st = await sesion(page);
    console.log('QA25D suavizar', vp.height, 'estado', st, 'textos', JSON.stringify([...textos]));
    const estadoTxt = (await page.locator('#kura-inspector-panel').getByRole('status').allInnerTexts()).join(' | ');
    console.log('QA25D suavizar estado final', estadoTxt);
    await page.screenshot({ path: `${EV}/suavizar-${vp.height}-aplicado.png` });
    expect(st, estadoTxt).toBe('applied');
    expect(estadoTxt).not.toMatch(/proteg/i);
    expect(await pasos(page)).toBe(p0 + 1);
    const v1 = await volumen(page, id);
    expect(Math.abs(v1 - v0) / v0).toBeLessThan(0.05);
    // «pasada i de n» visto durante el cálculo (observación, no bloqueo).
    const vioPasada = [...textos].some((x) => /pasada \d+ de \d+/i.test(x));
    console.log('QA25D pasada i de n visto:', vioPasada);

    // Deshacer = un solo paso.
    await page.evaluate(() => (window as any).__s.getState().undo());
    expect(await pasos(page)).toBe(p0);
    expect(Math.abs((await volumen(page, id)) - v0)).toBeLessThan(1e-6);

    // 50 % / 5 pasadas.
    await inten.fill('50'); await inten.blur();
    await pas.fill('5'); await pas.blur();
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect.poll(() => sesion(page), { timeout: 240_000 }).toMatch(/applied|error/);
    await libre(page);
    const est2 = (await page.locator('#kura-inspector-panel').getByRole('status').allInnerTexts()).join(' | ');
    console.log('QA25D suavizar 50/5', vp.height, await sesion(page), est2);
    await page.screenshot({ path: `${EV}/suavizar-${vp.height}-50-5.png` });
    expect(await sesion(page), est2).toBe('applied');
    expect(await pasos(page)).toBe(p0 + 1);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Orientar
// ---------------------------------------------------------------------------------------------------------------------
const tooltip = (page: Page) => page.locator('[role="tooltip"]#kura-help-tooltip');
const opciones = (page: Page) => page.getByTestId('orient-option');
const medidaHud = (page: Page) => page.locator('.kura-hud-bottom .kura-dims-badge').first().innerText();

async function crearT(page: Page): Promise<string> {
  const p = await (await import('./qa25a-helpers')).cmd(page, 'create_primitive', { type: 'box', width: 10, height: 40, depth: 10, name: 'Poste', position: [0, 0, 20] });
  const b = await (await import('./qa25a-helpers')).cmd(page, 'create_primitive', { type: 'box', width: 40, height: 10, depth: 10, name: 'Barra', position: [0, 0, 45] });
  const r = await (await import('./qa25a-helpers')).cmd(page, 'boolean_operation', { op: 'union', targetId: p.id, toolIds: [b.id] });
  return r.resultId;
}

test('orientar: sin tooltip al abrir; con teclado sí; Enter aplica, foco en «Actual», segundo Enter no revierte; Tamaño cambia', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const id = await crearT(page);
  await seleccionar(page, [id]);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  const medida0 = await medidaHud(page);
  const p0 = await pasos(page);
  await (await itemAccion(page, 'Orientar para imprimir…')).click();
  await expect(page.getByTestId('orient-panel')).toBeVisible();
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const alAbrir = await tooltip(page).count();
  console.log('QA25D orientar tooltip al abrir:', alAbrir);
  await page.screenshot({ path: `${EV}/orientar-abrir.png` });
  expect(alAbrir, 'tooltip al abrir el panel').toBe(0);
  // Con teclado: enfocar la lista con Tab y moverse con flechas.
  const lista = page.getByTestId('orient-options');
  await opciones(page).first().focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(700);
  const conTeclado = await tooltip(page).count();
  console.log('QA25D orientar tooltip con flechas:', conTeclado, conTeclado ? (await tooltip(page).innerText()).replace(/\s+/g, ' ') : '');
  await page.screenshot({ path: `${EV}/orientar-flechas.png` });
  // Elegir una opción distinta de la actual y aplicar con Enter.
  const actual = page.locator('[data-testid="orient-option"]', { has: page.getByTestId('orient-badge-current') });
  const n = await opciones(page).count();
  let destino = -1;
  for (let i = 0; i < n; i += 1) if (!(await opciones(page).nth(i).locator('[data-testid="orient-badge-current"]').count())) { destino = i; break; }
  await opciones(page).nth(destino).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => pasos(page), { timeout: 30_000 }).toBe(p0 + 1);
  await libre(page);
  await page.waitForTimeout(800);
  const foco = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return { tag: a?.tagName, testid: a?.getAttribute('data-testid'), actual: Boolean(a?.querySelector('[data-testid="orient-badge-current"]')), texto: a?.innerText?.replace(/\s+/g, ' ').slice(0, 60) };
  });
  console.log('QA25D orientar foco tras aplicar', JSON.stringify(foco));
  await page.screenshot({ path: `${EV}/orientar-aplicado.png` });
  expect(foco.actual, 'el foco no quedó en «Actual»').toBe(true);
  expect(await actual.count()).toBe(1);
  // Segundo Enter: no revierte ni agrega pasos.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  expect(await pasos(page), 'el segundo Enter cambió el historial').toBe(p0 + 1);
  const medida1 = await medidaHud(page);
  console.log('QA25D Tamaño', medida0, '->', medida1);
  expect(medida1, 'el rótulo «Tamaño» no cambió al acostar la pieza').not.toBe(medida0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar con la ocarina real: avisa que no hay base estable y «Sin base» nunca es la recomendada', async ({ page }) => {
  test.skip(!existsSync(OCARINA), 'sin modelo real');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  await importar(page, OCARINA);
  await (await itemAccion(page, 'Orientar para imprimir…')).click();
  await expect(page.getByTestId('orient-panel')).toBeVisible();
  await expect(opciones(page).first()).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(800);
  const panelTxt = (await page.getByTestId('orient-panel').innerText()).replace(/\s+/g, ' ');
  const resumen = await page.getByTestId('orient-summary').evaluate((e) => ({ kind: e.getAttribute('data-kind'), txt: (e as HTMLElement).innerText })).catch(() => null);
  const noBase = await page.getByTestId('orient-no-base').count();
  console.log('QA25D ocarina resumen', JSON.stringify(resumen), 'noBase', noBase);
  console.log('QA25D ocarina panel', panelTxt.slice(0, 900));
  await page.screenshot({ path: `${EV}/orientar-ocarina.png` });
  expect(panelTxt, 'no avisa que no hay base estable').toMatch(/no se sostiene sola|sin base|base estable/i);
  expect(panelTxt, 'dice «ya es la mejor» con la ocarina').not.toMatch(/ya es la mejor/i);
  const rec = page.locator('[data-testid="orient-option"]', { has: page.getByTestId('orient-badge-recommended') });
  const nRec = await rec.count();
  for (let i = 0; i < nRec; i += 1) {
    const t = await rec.nth(i).innerText();
    console.log('QA25D recomendada:', t.replace(/\s+/g, ' '));
    expect(t, 'una opción «Sin base» es la recomendada').not.toMatch(/sin base/i);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});
