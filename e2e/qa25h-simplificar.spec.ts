/**
 * @file e2e/qa25h-simplificar.spec.ts
 * @description QA 25-h de Simplificar con versión segura, vista previa y túneles finos: esfera por defecto al 50 %
 * (se aplica lo pedido con aviso, regla de dos niveles del 26-nov), placa a 12 triángulos (segura + «Aplicar de todos
 * modos» en un paso), vista previa sin tocar pieza ni historial (se descarta al
 * cambiar un campo o la selección), pieza descentrada que no salta de lugar, botones visibles a 1280×720 y modelo real
 * (frierenmw, 478 mil triángulos) al 50 % con aviso de agujeros finos y cancelación de la vista previa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, clavesCrudas, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25h';
const REAL = 'G:/proyectos/kura3d/.eval-tmp/modelos/frierenmw.stl';
const tris = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);

async function abrirPanel(page: Page) {
  await (await itemAccion(page, 'Simplificar…')).click();
  await expect(page.locator('.kura-simplify-section')).toBeVisible();
}
const sec = (page: Page) => page.locator('.kura-simplify-section');
const modo = (page: Page, v: 'lossless' | 'tolerance' | 'target') => sec(page).locator('select').first().selectOption(v);
const simplificar = (page: Page) => sec(page).getByRole('button', { name: /^Simplificar/ });
const vistaPrevia = (page: Page) => page.getByTestId('simplify-preview');

async function pedir50(page: Page) {
  await abrirPanel(page);
  await modo(page, 'target');
  const pct = sec(page).getByRole('spinbutton', { name: 'Conservar (%)' });
  await pct.fill('50');
  await pct.blur();
  await simplificar(page).click();
  await libre(page);
}

for (const tema of ['light', 'dark'] as const) {
  test(`esfera por defecto al 50 % por cantidad: se aplica lo pedido con aviso, sin bloqueo, en un paso (${tema})`, async ({ page }) => {
    // Regla de dos niveles (26-nov): −5,4 % de volumen y 1,7 mm de desviación (3,4 % del lado menor) es AVISO: se aplica
    // lo pedido (~248 triángulos), sin «versión segura» ni «Aplicar de todos modos».
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const errs = await abrir(page);
    await page.emulateMedia({ colorScheme: tema });
    const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
    await seleccionar(page, [s.id]);
    const t0 = await tris(page, s.id);
    const p0 = await pasos(page);
    await pedir50(page);
    const t1 = await tris(page, s.id);
    expect(Math.abs(t1 / t0 - 0.5)).toBeLessThan(0.15);
    expect(await pasos(page)).toBe(p0 + 1);
    await expect(page.getByTestId('simplify-notice')).toBeVisible();
    await expect(page.getByTestId('simplify-blocked')).toHaveCount(0);
    await expect(page.getByTestId('simplify-safe-applied')).toHaveCount(0);
    await expect(page.getByTestId('simplify-apply-anyway')).toHaveCount(0);
    // Un solo juego de límites: los avisos dicen «se avisa desde», nunca los topes de bloqueo ni los de 0,5 % / 0,1 mm.
    const avisos = await page.getByTestId('simplify-report-warnings').innerText();
    expect(avisos).toContain('se avisa desde 5,0 %');
    expect(avisos).not.toMatch(/0,5 %|0,1 mm|tope/);
    await page.screenshot({ path: `${EV}/simp-esfera-aviso-${tema}.png` });
    expect(await clavesCrudas(page, '.kura-simplify-section')).toEqual([]);
    await page.keyboard.press('Control+z');
    expect(await tris(page, s.id)).toBe(t0);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`placa con 3 agujeros a 12 triángulos: segura aplicada con aviso, botones a la vista a 1280×720, «de todos modos» en un paso (${tema})`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const errs = await abrir(page);
    await page.emulateMedia({ colorScheme: tema });
    const placa = await cmd(page, 'create_primitive', { type: 'box', width: 60, depth: 40, height: 3, name: 'Placa' });
    const taladros: string[] = [];
    for (const x of [-18, 0, 18]) taladros.push((await cmd(page, 'create_primitive', { type: 'cylinder', radius: 4, height: 10, name: `T${x}`, position: [x, 1.5, 0] })).id);
    await cmd(page, 'boolean_operation', { op: 'subtract', targetId: placa.id, toolIds: taladros });
    const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
    await seleccionar(page, [id]);
    const t0 = await tris(page, id);
    await abrirPanel(page);
    await modo(page, 'target');
    await sec(page).getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
    const campo = sec(page).getByRole('spinbutton', { name: /Triángulos finales/ });
    await campo.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('12');
    const p0 = await pasos(page);
    // Enter lanza la vista previa; aplicar exige el botón «Simplificar».
    await page.getByTestId('simplify-run').click();
    await libre(page);
    const t1 = await tris(page, id);
    expect(t1).toBeLessThan(t0);
    expect(await pasos(page)).toBe(p0 + 1);
    const texto = await page.getByTestId('simplify-safe-applied-text').innerText();
    console.log('QA25H aviso placa:', texto.replace(/\s+/g, ' '));
    expect(texto).toMatch(/Se aplicó la versión segura: [\d.]+ triángulos\. Lo pedido dejaba [\d.]+ y cambiaba demasiado la forma\./);
    await expect(page.getByTestId('simplify-apply-anyway')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${EV}/simp-placa-segura-${tema}.png` });
    expect(await clavesCrudas(page, '.kura-simplify-section')).toEqual([]);
    await page.getByTestId('simplify-apply-anyway').click();
    await libre(page);
    const t2 = await tris(page, id);
    console.log('QA25H placa', t0, '->', t1, '->', t2);
    expect(t2).toBeLessThan(t1);
    expect(await pasos(page)).toBe(p0 + 1);
    await page.keyboard.press('Control+z');
    expect(await tris(page, id)).toBe(t0);
    expect(await pasos(page)).toBe(p0);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('vista previa: no toca pieza ni historial, Simplificar posterior es inmediato, se descarta al cambiar campo o selección', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 10, name: 'Esfera' });
  const o = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 10, height: 30, name: 'Cil', position: [80, 0, 0] });
  await seleccionar(page, [s.id]);
  const t0 = await tris(page, s.id);
  const p0 = await pasos(page);
  await abrirPanel(page);
  await modo(page, 'target');
  const pct = sec(page).getByRole('spinbutton', { name: 'Conservar (%)' });
  await pct.fill('50');
  await pct.blur();
  await vistaPrevia(page).click();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  await libre(page);
  expect(await tris(page, s.id)).toBe(t0);
  expect(await pasos(page)).toBe(p0);
  const informe = (await page.getByTestId('simplify-report').innerText()).replace(/\s+/g, ' ');
  console.log('QA25H vista previa:', informe.slice(0, 400));
  await page.screenshot({ path: `${EV}/simp-vistaprevia.png` });
  // Simplificar con los mismos valores: inmediato (reutiliza el cálculo).
  const t = Date.now();
  await simplificar(page).click();
  await libre(page);
  const ms = Date.now() - t;
  console.log('QA25H simplificar tras vista previa ms', ms);
  expect(await pasos(page)).toBe(p0 + 1);
  expect(await tris(page, s.id)).toBeLessThan(t0);
  expect(ms).toBeLessThan(3000);
  await page.keyboard.press('Control+z');
  expect(await pasos(page)).toBe(p0);
  // Cambiar un campo borra la vista previa.
  await vistaPrevia(page).click();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  await pct.fill('40');
  await pct.blur();
  await expect(page.getByTestId('simplify-report')).toHaveCount(0);
  // Cambiar la selección borra la vista previa.
  await vistaPrevia(page).click();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  await seleccionar(page, [o.id]);
  await expect(page.getByTestId('simplify-report')).toHaveCount(0);
  // Al cambiar la selección el panel se cierra; al volver a la esfera no queda vista previa vieja.
  await seleccionar(page, [s.id]);
  if (!(await sec(page).count())) await abrirPanel(page);
  await expect(page.getByTestId('simplify-report')).toHaveCount(0);
  expect(await clavesCrudas(page, '.kura-simplify-section')).toEqual([]);
  expect(await pasos(page)).toBe(p0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('pieza descentrada, girada y escalada no salta de lugar al simplificar', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = await abrir(page);
  const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
  await page.evaluate((id) => (window as any).__s.getState().setObjectTransform(id, { position: [180, 40, -120], rotation: [0.5, 0.8, 0.3], scale: [1.5, 0.8, 1.2] }, true), s.id);
  await seleccionar(page, [s.id]);
  const caja = () => page.evaluate(async (id) => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === id);
    const b = worldBox(o)!;
    return { min: b.min.toArray(), max: b.max.toArray(), pos: o.position, rot: o.rotation, sc: o.scale };
  }, s.id);
  const a = await caja();
  await abrirPanel(page);
  for (const m of ['tolerance', 'target'] as const) {
    await modo(page, m);
    if (m === 'target') await sec(page).getByRole('spinbutton', { name: 'Conservar (%)' }).fill('60');
    await simplificar(page).click();
    await libre(page);
    const d = await caja();
    console.log('QA25H descentrada', m, JSON.stringify(a.min), '->', JSON.stringify(d.min));
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(d.min[i] - a.min[i])).toBeLessThan(3);
      expect(Math.abs(d.max[i] - a.max[i])).toBeLessThan(3);
    }
    expect(d.pos).toEqual(a.pos);
    expect(d.rot).toEqual(a.rot);
    expect(d.sc).toEqual(a.sc);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('frierenmw (478 mil triángulos) al 50 %: se aplica con aviso de agujeros finos; cancelar la vista previa', async ({ page }) => {
  test.skip(!existsSync(REAL), 'sin modelo');
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(REAL);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 180_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await seleccionar(page, [id]);
  const t0 = await tris(page, id);
  const p0 = await pasos(page);
  console.log('QA25H frieren tris', t0);
  await abrirPanel(page);
  await modo(page, 'target');
  const pct = sec(page).getByRole('spinbutton', { name: 'Conservar (%)' });
  await pct.fill('50');
  await pct.blur();
  // Cancelar durante el cálculo de la vista previa.
  await vistaPrevia(page).click();
  await expect(page.getByTestId('simplify-preview-computing')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('simplify-preview-cancel').click();
  await expect(page.getByTestId('simplify-preview-computing')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('simplify-report')).toHaveCount(0);
  expect(await tris(page, id)).toBe(t0);
  expect(await pasos(page)).toBe(p0);
  await page.screenshot({ path: `${EV}/frieren-cancelada.png` });
  // Simplificar de verdad al 50 %.
  const t = Date.now();
  await simplificar(page).click();
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 300_000 });
  await libre(page);
  console.log('QA25H frieren ms', Date.now() - t);
  const t1 = await tris(page, id);
  const informe = (await sec(page).innerText()).replace(/\s+/g, ' ');
  console.log('QA25H frieren', t0, '->', t1, informe.slice(0, 700));
  expect(t1).toBeLessThan(t0);
  expect(await pasos(page)).toBe(p0 + 1);
  expect(informe).toMatch(/agujeros? muy finos?/);
  await page.screenshot({ path: `${EV}/frieren-50.png` });
  await page.keyboard.press('Control+z');
  expect(await tris(page, id)).toBe(t0);
  expect(errs, errs.join('\n')).toEqual([]);
});
