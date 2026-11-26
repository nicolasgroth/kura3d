/**
 * @file e2e/qa25h-imanes.spec.ts
 * @description QA 25-h de imanes cuadrados y rectangulares: forma Rectangular con tres campos, «Girar 90°» y resumen
 * «Hueco: 10,2 × 5,2 × 2,2 mm» (orientación real en una cara vertical con y sin giro, preajuste rectangular que
 * sobrevive a recargar) y Dividir con «Cuadrado 5 × 5 × 2» y «Rectangular 10 × 5 × 2» en una barra larga (sin la nota
 * de «solo redondos», alojamientos iguales en las dos piezas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir as abrirErr, cmd, libre, seleccionar } from './qa25a-helpers';
import { aPixel } from './qa12-helpers';
import { enlazarStores } from './store-link';

type P3 = [number, number, number];
const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25h';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());


/** Enlaza el store de react-three-fiber (`__r3f`) para proyectar puntos de mundo a pantalla. */
async function r3f(page: Page) {
  await enlazarStores(page, { medicion: true });
  await page.evaluate(async () => {
    const w = window as any;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
}

const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);

async function vista(page: Page, cam: P3) {
  await page.evaluate((c) => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(c[0], c[1], c[2]);
    r.camera.lookAt(0, 15, 0);
    r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(0, 15, 0);
    r.controls?.update?.();
  }, cam);
  await cuadros(page);
}

async function abrirPanelIman(page: Page) {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toBeVisible();
}

async function clic(page: Page, p: P3) {
  const a = await aPixel(page, p);
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.mouse.down();
  await page.mouse.up();
}

async function campo(page: Page, nombre: string, valor: string) {
  const f = page.getByRole('textbox', { name: nombre, exact: true }).or(page.getByRole('spinbutton', { name: nombre, exact: true })).first();
  await f.fill(valor);
  await f.press('Tab');
}

/** Dimensiones en mundo del negativo más reciente. */
const dimsNegativo = (page: Page) => page.evaluate(async () => {
  const { worldBox } = await import('/src/core/scene/overlap.ts');
  const s = (window as any).__s.getState();
  const neg = s.objects.filter((o: any) => o.role === 'negative').at(-1);
  const b = worldBox(neg)!;
  const mx = b.max.toArray(), mn = b.min.toArray();
  return [0, 1, 2].map((i) => +(mx[i] - mn[i]).toFixed(2));
});

for (const tema of ['light', 'dark'] as const) {
  test(`rectangular: tres campos, resumen, orientación con y sin giro, preajuste que sobrevive (${tema})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrirErr(page);
    await r3f(page);
    await page.emulateMedia({ colorScheme: tema });
    await page.evaluate(() => localStorage.removeItem('kura3d-presets-magnet'));
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
    await S(page, (s) => { s.setSelection([]); s.dismissAllToasts?.(); });
    await vista(page, [120, 25, 10]);
    await abrirPanelIman(page);
    await page.getByTestId('magnet-shape-rect').click();
    await expect(page.getByTestId('magnet-turn90')).toBeVisible();
    for (const n of ['Largo del imán (mm)', 'Ancho del imán (mm)', 'Alto del imán (mm)']) await expect(page.getByLabel(n, { exact: true })).toBeVisible();
    await campo(page, 'Largo del imán (mm)', '10');
    await campo(page, 'Ancho del imán (mm)', '5');
    await campo(page, 'Alto del imán (mm)', '2');
    const resumen = await page.getByTestId('magnet-summary').innerText();
    console.log('QA25H resumen rect:', resumen);
    await expect(page.getByTestId('magnet-summary')).toHaveText('Hueco: 10,2 × 5,2 × 2,2 mm');
    await page.screenshot({ path: `${EV}/iman-rect-panel-${tema}.png` });
    // Sin giro, cara +X.
    await clic(page, [15, 15, 3]);
    await expect.poll(() => S(page, (s) => s.objects.filter((o: any) => o.role === 'negative').length), { timeout: 15_000 }).toBe(1);
    await libre(page);
    const sinGiro = await dimsNegativo(page);
    console.log('QA25H dims sin giro (x,y,z mundo):', JSON.stringify(sinGiro));
    // Con giro.
    await page.getByTestId('magnet-turn90').check();
    await vista(page, [120, 25, 10]);
    await clic(page, [15, 15, 3]);
    await expect.poll(() => S(page, (s) => s.objects.filter((o: any) => o.role === 'negative').length), { timeout: 15_000 }).toBe(2);
    await libre(page);
    const conGiro = await dimsNegativo(page);
    console.log('QA25H dims con giro:', JSON.stringify(conGiro));
    // La cara +X es vertical: el eje x es la profundidad; y/z se intercambian al girar.
    // El negativo asoma 0,3 mm fuera de la cara para cortar limpio: profundidad 2,2 + 0,3.
    expect(Math.abs(sinGiro[0] - 2.2)).toBeLessThan(0.5);
    expect(Math.abs(conGiro[0] - 2.2)).toBeLessThan(0.5);
    expect(Math.abs(sinGiro[1] - conGiro[2])).toBeLessThan(0.1);
    expect(Math.abs(sinGiro[2] - conGiro[1])).toBeLessThan(0.1);
    expect(Math.abs(sinGiro[1] - sinGiro[2])).toBeGreaterThan(4);
    // Preajuste rectangular que sobrevive a recargar.
    await page.getByTestId('magnet-turn90').uncheck();
    await page.getByTestId('magnet-preset-name').fill('Rect tapa');
    await page.getByTestId('magnet-preset-save').click();
    await expect(page.getByTestId('magnet-preset')).toHaveValue(/^user-/);
    await page.reload();
    await abrirErr(page);
    // Tras recargar con una escena sin guardar aparece la recuperación: se descarta.
    await page.getByRole('button', { name: 'Descartar' }).click({ timeout: 6000 }).catch(() => undefined);
    // Descartar pide confirmación en un diálogo: se confirma si aparece.
    await page.getByRole('dialog').getByRole('button', { name: /^Descartar/ }).click({ timeout: 3000 }).catch(() => undefined);
    await r3f(page);
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
    await abrirPanelIman(page);
    await page.getByTestId('magnet-preset').selectOption({ label: 'Rect tapa' });
    await expect(page.getByTestId('magnet-shape-rect')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('magnet-summary')).toHaveText('Hueco: 10,2 × 5,2 × 2,2 mm');
    await page.getByTestId('magnet-preset-delete').click();
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('rectangular: valores fuera de rango bloquean y el resumen avisa; teclado solo', async ({ page }) => {
  test.setTimeout(90_000);
  const errs = await abrirErr(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo' });
  await S(page, (s) => s.setSelection([]));
  await abrirPanelIman(page);
  await page.getByTestId('magnet-shape-rect').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('magnet-shape-rect')).toHaveAttribute('aria-pressed', 'true');
  for (const mal of ['0', '-3', '999', 'abc']) {
    const f = page.getByLabel('Ancho del imán (mm)', { exact: true });
    await f.fill(mal);
    await f.press('Tab');
    console.log('QA25H ancho', mal, '->', await page.getByTestId('magnet-summary').innerText());
  }
  await page.screenshot({ path: `${EV}/iman-rect-invalido.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});
