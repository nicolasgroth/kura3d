/**
 * @file e2e/qa25d-varios.spec.ts
 * @description QA de la ronda 25-nov (D): «Dividir» con imanes (resumen sin «mínimo de 0 mm», código A1/B1 completo
 * en la lista de escena, corte oblicuo con varios imanes), «Acerca de» (abre arriba, zona desplazable con teclado,
 * frase distinta entre aperturas) y tooltips globales (aparecen con Tab en la barra superior y la de herramientas,
 * no por foco automático), sin «Kura3D» en pantalla.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25d';
const tooltip = (page: Page) => page.locator('[role="tooltip"]#kura-help-tooltip');

async function dividirConImanes(page: Page, id: string) {
  await seleccionar(page, [id]);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await expect(page.locator('.kura-split-label-layer .kura-split-plane-tag').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('select[id$="-kind"]').selectOption('magnet');
  await expect(page.getByTestId('split-magnet-options')).toBeVisible();
  await page.waitForTimeout(1500);
}
async function ejecutarDividir(page: Page) {
  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 180_000 }).toBeGreaterThan(1);
  await libre(page);
  await page.waitForTimeout(800);
}

test('dividir con imanes: resumen sin «mínimo de 0 mm» y códigos completos en la lista de escena', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const c = await cmd(page, 'create_primitive', { type: 'box', width: 400, height: 60, depth: 60, name: 'Barra larga con nombre bastante largo' });
  await dividirConImanes(page, c.id);
  const resumen = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const malo = resumen.match(/m[ií]nimo de 0[,.]?0? ?mm/i);
  console.log('QA25D resumen «mínimo de 0 mm»:', malo ? malo[0] : 'no aparece', '| fragmentos:', resumen.match(/.{40}m[ií]nimo.{40}/gi)?.slice(0, 3));
  await page.screenshot({ path: `${EV}/dividir-resumen.png` });
  expect(malo, 'dice «mínimo de 0 mm»').toBeNull();
  await ejecutarDividir(page);
  const codigos = await page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).map((o: any) => ({ code: o.metadata.split.code, name: o.name })));
  console.log('QA25D piezas', JSON.stringify(codigos));
  const lista = page.locator('.kura-sidebar-left');
  const txt = (await lista.innerText()).replace(/\s+/g, ' ');
  for (const { code } of codigos) {
    expect(txt, `el código ${code} no se ve completo en la lista de escena`).toContain(code);
  }
  // Además, ninguna fila lo corta con puntos suspensivos en el código.
  const filas = await lista.locator('li, [role="treeitem"], [role="option"]').allInnerTexts();
  console.log('QA25D filas', JSON.stringify(filas.slice(0, 8)));
  await page.screenshot({ path: `${EV}/dividir-lista.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('dividir con imanes en un corte oblicuo: se colocan varios imanes', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const c = await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 400, depth: 80, name: 'Torre' });
  await page.evaluate((id) => (window as any).__s.getState().setObjectTransform(id, { rotation: [Math.PI / 6, 0, 0] }, true), c.id);
  await dividirConImanes(page, c.id);
  await page.screenshot({ path: `${EV}/dividir-oblicuo-plan.png` });
  await ejecutarDividir(page);
  const j = await page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).map((o: any) => ({ c: o.metadata.split.code, n: o.metadata.split.joints?.[0]?.connectorCenters?.length ?? null, k: o.metadata.split.joints?.[0]?.kind, fuerza: o.metadata.split.joints?.[0]?.strength?.level })));
  console.log('QA25D oblicuo', JSON.stringify(j));
  await page.screenshot({ path: `${EV}/dividir-oblicuo-resultado.png` });
  expect(Math.max(...j.map((x: any) => x.n ?? 0)), 'solo un imán o ninguno en el corte oblicuo').toBeGreaterThan(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Acerca de: abre arriba tras desplazar, zona desplazable por teclado, frase cambia, sin «Kura3D»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const abrirAcerca = async () => {
    const b = page.getByRole('button', { name: /Acerca de/ }).first();
    if (await b.count()) await b.click();
    else await page.evaluate(() => (window as any).__s.getState().setActiveDialog('about'));
    await expect(page.locator('.kura-about')).toBeVisible();
  };
  const frases = new Set<string>();
  await abrirAcerca();
  const reg = page.locator('.kura-about');
  frases.add((await page.locator('.kura-about-quote').innerText()).trim());
  await expect(reg).toHaveAttribute('role', 'region');
  // Desplazar con el teclado (la región es enfocable).
  await reg.focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(300);
  const st = await reg.evaluate((el) => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
  console.log('QA25D acerca scroll', JSON.stringify(st));
  expect(st.max).toBeGreaterThan(0);
  expect(st.top, 'End no desplazó la zona').toBeGreaterThan(0);
  await page.keyboard.press('PageUp');
  await page.waitForTimeout(200);
  const st2 = await reg.evaluate((el) => el.scrollTop);
  expect(st2, 'PageUp no desplazó').toBeLessThan(st.top);
  await page.keyboard.press('End');
  await page.screenshot({ path: `${EV}/acerca-abajo.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-about')).toBeHidden();
  for (let i = 0; i < 5; i += 1) {
    await abrirAcerca();
    const top = await page.locator('.kura-about').evaluate((el) => el.scrollTop);
    expect(top, `reabrir ${i}: no abre arriba`).toBe(0);
    await expect(page.locator('.kura-about-logo')).toBeInViewport();
    frases.add((await page.locator('.kura-about-quote').innerText()).trim());
    await page.locator('.kura-about').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(page.locator('.kura-about')).toBeHidden();
  }
  console.log('QA25D frases distintas:', frases.size, JSON.stringify([...frases]));
  expect(frases.size, 'la frase no cambia entre aperturas').toBeGreaterThan(1);
  await abrirAcerca();
  await page.screenshot({ path: `${EV}/acerca-arriba.png` });
  expect(await page.locator('body').innerText()).not.toMatch(/Kura3D/);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('tooltips: con Tab aparecen en la barra superior y la de herramientas; no por foco automático', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  await page.waitForTimeout(800);
  expect(await tooltip(page).count(), 'tooltip al cargar sin interacción').toBe(0);
  // Barra superior: Tab desde el primer control.
  const top = page.locator('.kura-topbar').getByRole('button').first();
  await top.focus();
  const vistos: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const foco = await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return `${a?.tagName}:${a?.getAttribute('aria-label') ?? a?.textContent?.trim().slice(0, 20)}:${a?.closest('.kura-topbar') ? 'topbar' : 'otro'}`; });
    const hay = await tooltip(page).count();
    vistos.push(`${foco}=>${hay ? (await tooltip(page).innerText()).replace(/\s+/g, ' ').slice(0, 50) : 'sin tooltip'}`);
  }
  console.log('QA25D tooltips topbar', JSON.stringify(vistos, null, 1));
  await page.screenshot({ path: `${EV}/tooltip-topbar.png` });
  expect(vistos.filter((v) => !v.endsWith('sin tooltip')).length, 'ningún tooltip con Tab en la barra superior').toBeGreaterThan(0);
  // Barra de herramientas.
  const rail = page.locator('#kura-tool-rail').getByRole('button').first();
  await rail.focus();
  const vistosRail: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    const hay = await tooltip(page).count();
    vistosRail.push(hay ? (await tooltip(page).innerText()).replace(/\s+/g, ' ').slice(0, 50) : 'sin tooltip');
  }
  console.log('QA25D tooltips rail', JSON.stringify(vistosRail));
  await page.screenshot({ path: `${EV}/tooltip-rail.png` });
  expect(vistosRail.filter((v) => v !== 'sin tooltip').length, 'ningún tooltip con flechas en la barra de herramientas').toBeGreaterThan(0);
  // Foco automático: abrir un panel con foco inicial no debe mostrar tooltip.
  await page.keyboard.press('Escape');
  const id = (await cmd(page, 'create_primitive', { type: 'sphere', radius: 20, name: 'Esfera' })).id as string;
  await seleccionar(page, [id]);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();
  await page.waitForTimeout(1200);
  const auto = await tooltip(page).count();
  console.log('QA25D tooltip tras foco automático (Dividir):', auto);
  await page.screenshot({ path: `${EV}/tooltip-foco-auto.png` });
  expect(auto, 'tooltip por foco automático').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});
