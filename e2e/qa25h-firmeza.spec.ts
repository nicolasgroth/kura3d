/**
 * @file e2e/qa25h-firmeza.spec.ts
 * @description QA 25-h de la firmeza de las uniones de Dividir: barra larga de sección amplia («N uniones: N firmes» y
 * detalle por unión plegable), sección fina («Para pegar» con su motivo y «Usar solape de borde»), tamaño manual
 * chico con «Dimensionar según cada unión» apagado (uniones débiles y botones de recomendación) y el inspector tras
 * dividir (conteo, nivel de cada unión, resalte con color y trazo al pasar o enfocar, flechas/Inicio/Fin).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir as abrirErr, clavesCrudas, cmd, libre, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25h';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

async function barra(page: Page, w: number, d: number, largo: number) {
  const b = await cmd(page, 'create_primitive', { type: 'box', width: largo, depth: d, height: w, name: 'Barra' });
  await seleccionar(page, [b.id]);
  await S(page, (s) => s.dismissAllToasts?.());
  return b.id as string;
}

async function abrirDividir(page: Page) {
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  await expect(page.locator('.kura-split-panel')).toBeVisible();
}
const panel = (page: Page) => page.locator('.kura-split-panel');
const textoPanel = async (page: Page) => (await panel(page).innerText()).replace(/\s+/g, ' ');
/** Abre «Detalle por unión» y la primera fila (ahí viven medidas, motivo y botones de recomendación). */
async function abrirDetalle(page: Page) {
  const det = panel(page).locator('details.kura-firmness-detail');
  await det.locator(':scope > summary').click();
  const fila = det.locator('.kura-firmness-row-summary').first();
  await fila.click();
  return det;
}
const esperarCalculo = async (page: Page) => {
  await expect.poll(async () => /Calculando/.test(await panel(page).innerText()), { timeout: 90_000 }).toBe(false);
};

for (const tema of ['light', 'dark'] as const) {
  test(`barra larga de sección amplia: «N uniones: N firmes», detalle por unión, inspector y resalte (${tema})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrirErr(page);
    await page.emulateMedia({ colorScheme: tema });
    await page.evaluate((e) => (window as any).__s.getState().setColorScheme(e), tema);
    await barra(page, 40, 40, 700);
    await abrirDividir(page);
    await esperarCalculo(page);
    const antes = await textoPanel(page);
    console.log('QA25H panel barra ancha:', antes.slice(0, 1500));
    await page.screenshot({ path: `${EV}/firmeza-barra-ancha-${tema}.png` });
    const resumen = page.getByTestId('split-firmness');
    await expect(resumen).toBeVisible({ timeout: 30_000 });
    const rt = (await resumen.innerText()).replace(/\s+/g, ' ');
    console.log('QA25H firmeza resumen:', rt);
    expect(rt).toMatch(/(\d+) uniones?: \1 firmes?/);
    expect(await clavesCrudas(page, '.kura-split-panel')).toEqual([]);
    // Detalle plegable por unión.
    const det = await abrirDetalle(page);
    console.log('QA25H detalle:', (await det.innerText()).replace(/\s+/g, ' ').slice(0, 600));
    await page.screenshot({ path: `${EV}/firmeza-detalle-${tema}.png` });
    // Sin desbordar a 1024.
    await page.setViewportSize({ width: 1024, height: 768 });
    const desborde = await panel(page).evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
    console.log('QA25H desborde 1024:', JSON.stringify(desborde));
    expect(desborde.doc).toBeLessThanOrEqual(desborde.vw);
    expect(desborde.sw).toBeLessThanOrEqual(desborde.cw + 1);
    await page.screenshot({ path: `${EV}/firmeza-1024-${tema}.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Dividir y revisar el inspector.
    await page.getByRole('button', { name: 'Dividir', exact: true }).click();
    await expect.poll(() => S(page, (s) => s.objects.filter((o: any) => o.metadata?.split).length), { timeout: 180_000 }).toBeGreaterThan(1);
    await libre(page);
    const piezas = await S(page, (s) => s.objects.filter((o: any) => o.metadata?.split && o.role === 'solid').map((o: any) => ({ id: o.id, code: o.metadata.split.code })));
    console.log('QA25H piezas', JSON.stringify(piezas));
    await seleccionar(page, [piezas[0].id]);
    const sec = page.locator('.kura-split-joints-section');
    await expect(sec).toBeVisible({ timeout: 15_000 });
    await sec.scrollIntoViewIfNeeded();
    const linea = await page.getByTestId('split-joints-firmness').innerText();
    console.log('QA25H inspector conteo:', linea);
    expect(linea).toMatch(/uniones?:/);
    const items = sec.locator('.kura-split-joint');
    const n = await items.count();
    console.log('QA25H uniones listadas', n);
    expect(n).toBeGreaterThan(0);
    await page.screenshot({ path: `${EV}/firmeza-inspector-${tema}.png` });
    // Cada unión muestra nivel con texto.
    for (let i = 0; i < n; i++) expect((await items.nth(i).innerText()), `unión ${i}`).toMatch(/Firme|Regular|Débil|Para pegar/);
    // Resalte al pasar el cursor.
    const btn = items.first().locator('button').first();
    await btn.hover();
    const foco = await S(page, (s) => s.splitJointFocus);
    console.log('QA25H foco al hover', JSON.stringify(foco));
    expect(foco).not.toBeNull();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${EV}/firmeza-resalte-hover-${tema}.png` });
    await page.mouse.move(5, 5);
    await expect.poll(() => S(page, (s) => s.splitJointFocus)).toBeNull();
    // Resalte al enfocar con teclado.
    await btn.focus();
    expect(await S(page, (s) => s.splitJointFocus)).not.toBeNull();
    // Flechas / Inicio / Fin en la lista.
    if (n > 1) {
      await page.keyboard.press('End');
      const ult = await S(page, (s) => s.splitJointFocus?.label);
      await page.keyboard.press('Home');
      const prim = await S(page, (s) => s.splitJointFocus?.label);
      await page.keyboard.press('ArrowDown');
      const seg = await S(page, (s) => s.splitJointFocus?.label);
      console.log('QA25H teclas End/Home/ArrowDown ->', ult, prim, seg);
      expect(ult).not.toBe(prim);
      expect(seg).not.toBe(prim);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('sección fina (~4 mm): «Para pegar» con motivo y «Usar solape de borde» recalcula', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrirErr(page);
  await barra(page, 4, 4, 600);
  await abrirDividir(page);
  await esperarCalculo(page);
  const t = await textoPanel(page);
  console.log('QA25H panel fina:', t.slice(0, 1600));
  await page.screenshot({ path: `${EV}/firmeza-fina.png` });
  const resumen = page.getByTestId('split-firmness');
  await expect(resumen).toBeVisible({ timeout: 30_000 });
  const rt = (await resumen.innerText()).replace(/\s+/g, ' ');
  console.log('QA25H fina resumen:', rt);
  expect(rt).toMatch(/para pegar/);
  const det = await abrirDetalle(page);
  const dt = (await det.innerText()).replace(/\s+/g, ' ');
  console.log('QA25H fina detalle:', dt.slice(0, 600));
  // Nombres accesibles distintos: el general dice «en todas las uniones» y cada unión el suyo («… la unión N …»).
  const lapNames = await page.getByRole('button', { name: /^Usar solape de borde/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim()));
  console.log('QA25H nombres solape:', lapNames);
  expect(new Set(lapNames).size).toBe(lapNames.length);
  expect(dt).toMatch(/tiene 4 mm de ancho útil/);
  const lap = page.getByRole('button', { name: /^Usar solape de borde/ }).first();
  await expect(lap).toBeVisible();
  await lap.click();
  await esperarCalculo(page);
  const t2 = await textoPanel(page);
  console.log('QA25H tras solape:', t2.slice(0, 1200));
  await page.screenshot({ path: `${EV}/firmeza-fina-solape.png` });
  console.log('QA25H solape cambió resumen:', (await resumen.innerText().catch(() => '(sin resumen)')).replace(/\s+/g, ' '));
  expect(await clavesCrudas(page, '.kura-split-panel')).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('tamaño manual chico con automático apagado: uniones débiles y botones de recomendación', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrirErr(page);
  await barra(page, 30, 30, 600);
  await abrirDividir(page);
  await esperarCalculo(page);
  const auto = page.getByLabel(/Dimensionar los conectores según cada unión/);
  await expect(auto).toBeVisible();
  await auto.uncheck();
  const dia = page.getByLabel(/Diámetro del conector/).first();
  await dia.fill('2');
  await dia.press('Enter');
  await esperarCalculo(page);
  const t = await textoPanel(page);
  console.log('QA25H manual chico:', t.slice(0, 1800));
  await page.screenshot({ path: `${EV}/firmeza-manual-chico.png` });
  const resumen = page.getByTestId('split-firmness');
  const rt = (await resumen.innerText().catch(() => '')).replace(/\s+/g, ' ');
  console.log('QA25H manual resumen:', rt);
  expect(rt).toMatch(/d[ée]biles?/);
  await abrirDetalle(page);
  const acciones = await panel(page).getByRole('button', { name: /Dimensionar según cada unión|Reforzar las uniones débiles|Usar solape de borde/ }).allInnerTexts();
  console.log('QA25H botones recomendación:', JSON.stringify(acciones));
  const dimens = page.getByRole('button', { name: 'Dimensionar según cada unión' });
  await expect(dimens).toBeVisible();
  await dimens.click();
  await esperarCalculo(page);
  const rt2 = (await resumen.innerText().catch(() => '')).replace(/\s+/g, ' ');
  console.log('QA25H tras dimensionar:', rt2);
  expect(rt2).not.toMatch(/d[ée]biles?/);
  expect(errs, errs.join('\n')).toEqual([]);
});
