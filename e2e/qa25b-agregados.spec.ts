/**
 * @file e2e/qa25b-agregados.spec.ts
 * @description QA de «Colgar en el muro» (ojo de cerradura) y «Paso de cable»: avisos de pared delgada y de borde, el
 * agregado sigue a la pieza al moverla y girarla, preajustes propios (guardar y eliminar, solo en `localStorage`),
 * cara curva, Escape sin restos, textos sin claves crudas en es/en/de y sin el nombre antiguo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir as abrirBase, aPixel } from './qa12-helpers';

type P3 = [number, number, number];
const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25b';

async function abrir(page: Page): Promise<string[]> {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console.error: ${m.text()}`); });
  await abrirBase(page);
  return errs;
}
const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);
const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
const addons = (page: Page, kind: string) => page.evaluate((k) =>
  (window as any).__s.getState().objects.filter((o: any) => o.metadata?.addon?.kind === k).map((o: any) => ({ id: o.id, pos: o.position, role: o.role })), kind);
const nObjs = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.length as number);

async function crear(page: Page, type: string, params: any, opts: any = {}): Promise<string> {
  return page.evaluate(async ({ type, params, opts }) => {
    const s = () => (window as any).__s.getState();
    const o = await s().createPrimitive(type, params, opts);
    s().setSelection([o.id]);
    s().dismissAllToasts?.();
    return o.id as string;
  }, { type, params, opts });
}
async function vista(page: Page, cam: P3, mira: P3 = [0, 30, 0]) {
  await page.evaluate(({ cam, mira }) => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(cam[0], cam[1], cam[2]); r.camera.lookAt(mira[0], mira[1], mira[2]); r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(mira[0], mira[1], mira[2]); r.controls?.update?.();
  }, { cam, mira });
  await cuadros(page, 3);
}
async function clic(page: Page, p: P3) {
  const a = await aPixel(page, p);
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.mouse.down();
  await page.mouse.up();
}
const abrirInsertar = async (page: Page, nombre: RegExp) => {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: nombre }).click();
};

test('ojo de cerradura: aviso de pared delgada y de borde, y sigue a la pieza al moverla y girarla', async ({ page }) => {
  test.setTimeout(150_000);
  const errs = await abrir(page);
  const host = await crear(page, 'box', { width: 60, height: 60, depth: 3 }, { position: [0, 0, 0], name: 'Placa fina' });
  await vista(page, [30, 40, 110]);
  await abrirInsertar(page, /^Colgar en el muro/);
  await expect(page.locator('.kura-keyhole-panel')).toBeVisible();
  await clic(page, [0, 30, 1.5]);
  await libre(page);
  await page.waitForTimeout(500);
  const avisos = await page.locator('[data-testid^="keyhole-warn-"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')}: ${e.textContent}`));
  console.log('QA25B keyhole avisos pared delgada', JSON.stringify(avisos), 'addons=', JSON.stringify(await addons(page, 'keyhole')));
  await page.screenshot({ path: `${EV}/keyhole-pared-delgada.png` });
  await clic(page, [-27, 5, 1.5]);
  await libre(page);
  await page.waitForTimeout(500);
  const avisos2 = await page.locator('[data-testid^="keyhole-warn-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  console.log('QA25B keyhole avisos borde', JSON.stringify(avisos2));
  expect(avisos2.join()).toMatch(/edge/);
  await page.getByTestId('panel-back').click();
  const antes = await addons(page, 'keyhole');
  expect(antes.length).toBe(2);
  await page.evaluate((id) => (window as any).__s.getState().setObjectTransform(id, { position: [50, 0, 20], rotation: [0, Math.PI / 2, 0] }, true), host);
  await page.waitForTimeout(500);
  const despues = await addons(page, 'keyhole');
  console.log('QA25B keyhole seguir', JSON.stringify(antes.map((a: any) => a.pos)), '->', JSON.stringify(despues.map((a: any) => a.pos)));
  expect(JSON.stringify(despues.map((a: any) => a.pos))).not.toEqual(JSON.stringify(antes.map((a: any) => a.pos)));
  await page.screenshot({ path: `${EV}/keyhole-mover-girar.png` });
  expect(errs, errs.join(' / ')).toEqual([]);
});

test('Escape durante la vista previa no deja objetos; preajustes propios se guardan y eliminan', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = await abrir(page);
  await crear(page, 'box', { width: 60, height: 60, depth: 10 }, { position: [0, 0, 0], name: 'Placa' });
  await vista(page, [30, 40, 110]);
  const n0 = await nObjs(page);
  for (const [nombre, panel, testid] of [[/^Colgar en el muro/, '.kura-keyhole-panel', 'keyhole'], [/^Paso de cable/, '.kura-cable-panel', 'cable']] as const) {
    await abrirInsertar(page, nombre);
    await expect(page.locator(panel).first()).toBeVisible();
    const a = await aPixel(page, [0, 30, 5]);
    await page.mouse.move(a.x, a.y, { steps: 3 });
    await cuadros(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).toHaveCount(0);
    expect(await nObjs(page)).toBe(n0);
    await abrirInsertar(page, nombre);
    const sel = page.getByTestId(`${testid}-preset`);
    await page.getByTestId(`${testid}-preset-name`).fill(`Mi preajuste QA ${testid}`);
    await page.getByTestId(`${testid}-preset-save`).click();
    const guardado = await page.evaluate(() => Object.keys(localStorage).filter((k) => /preset/i.test(k)).map((k) => `${k}=${(localStorage.getItem(k) ?? '').slice(0, 120)}`));
    console.log('QA25B preajuste', testid, JSON.stringify(guardado));
    await expect(sel.locator('optgroup option').filter({ hasText: `Mi preajuste QA ${testid}` })).toHaveCount(1);
    await sel.selectOption({ label: `Mi preajuste QA ${testid}` });
    await page.getByTestId(`${testid}-preset-delete`).click();
    await expect(sel.locator('option').filter({ hasText: `Mi preajuste QA ${testid}` })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).toHaveCount(0);
  }
  expect(errs, errs.join(' / ')).toEqual([]);
});

test('paso de cable: cara curva; idiomas sin claves crudas ni nombre antiguo', async ({ page }) => {
  test.setTimeout(150_000);
  const errs = await abrir(page);
  await crear(page, 'cylinder', { radius: 25, height: 40 }, { position: [0, 25, 0], name: 'Cilindro', rotation: [Math.PI / 2, 0, 0] });
  await vista(page, [70, 60, 90], [0, 25, 0]);
  await abrirInsertar(page, /^Paso de cable/);
  await expect(page.locator('.kura-cable-panel')).toBeVisible();
  const a = await aPixel(page, [0, 50, 0]);
  await page.mouse.move(a.x - 3, a.y - 3);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${EV}/cable-curva-hover.png` });
  await page.mouse.down();
  await page.mouse.up();
  await libre(page);
  await page.waitForTimeout(500);
  const cur = await addons(page, 'cable_pass');
  const avisos = await page.locator('[data-testid^="cable-warn-"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')}: ${e.textContent}`));
  console.log('QA25B cable curva', JSON.stringify(cur), JSON.stringify(avisos));
  await page.screenshot({ path: `${EV}/cable-curva.png` });
  for (const lang of ['es', 'en', 'de']) {
    await page.evaluate((l) => (window as any).__s.getState().setLanguage?.(l), lang);
    await page.waitForTimeout(200);
    const txt = await page.locator('.kura-cable-panel').innerText();
    const crudas = txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){2,}\b/g) ?? [];
    console.log('QA25B cable idioma', lang, JSON.stringify(crudas));
    expect(crudas, lang).toEqual([]);
    expect(await page.locator('body').innerText()).not.toMatch(/Kura3D(?![\w.])/);
  }
  expect(errs, errs.join(' / ')).toEqual([]);
});
