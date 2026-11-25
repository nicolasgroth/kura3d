/**
 * @file e2e/qa25e-ajustes-panel.spec.ts
 * @description QA 25-nov (E) de los paneles de la usabilidad C: Simplificar (Enter en «Triángulos finales» ejecuta, miles
 * en el objetivo y editable, título del panel), Suavizar (resultado y «Toda la pieza» no quedan bajo el pie fijo, a 1440 y
 * 1024, claro y oscuro) y Agregados (el selector «Cara» se ve como los demás campos). Evidencia en `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, esferaRuidosa, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const esquemaDe = async (page: Page, e: 'light' | 'dark') => {
  await page.emulateMedia({ colorScheme: e });
  await page.evaluate((x) => (window as any).__s.getState().setColorScheme(x), e);
};

test('Simplificar: Enter en «Triángulos finales» ejecuta; 500.000 con separador y editable; título claro', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const id = await esferaRuidosa(page, 25, 0.5);
  await seleccionar(page, [id]);
  await S(page, (s) => s.dismissAllToasts?.());
  const tris = () => S(page, (s) => s.objects[0].mesh.indices.length / 3);
  const t0 = await tris();
  await page.getByTestId('simplify-entry').click();
  const sec = page.locator('.kura-simplify-section');
  await expect(sec).toBeVisible();
  const titulo = (await page.locator('#kura-inspector-panel').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  console.log('QA25E simplificar encabezado:', titulo);
  await sec.locator('select').first().selectOption('target');
  await sec.getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
  const campo = sec.getByRole('spinbutton', { name: /Triángulos finales/ });
  await expect(campo).toBeVisible();
  // Miles: escribir 500000 y salir del campo.
  await campo.fill('500000');
  await campo.blur();
  const v1 = await campo.inputValue();
  console.log('QA25E objetivo tras 500000:', JSON.stringify(v1));
  expect(v1).toMatch(/500[.\u00a0 ]000/);
  await page.screenshot({ path: `${EV}/simplificar-miles.png` });
  // Editable sin romperse: volver a enfocar, borrar un dígito, escribir otro.
  await campo.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('7');
  await campo.blur();
  const v2 = await campo.inputValue();
  console.log('QA25E objetivo editado:', JSON.stringify(v2));
  expect(v2.replace(/\D/g, ''), 'End, Backspace y «7» sobre 500.000 deben dar 500.007').toBe('500007');
  expect(v2).not.toMatch(/NaN/);
  // Enter ejecuta.
  const p0 = await pasos(page);
  // Teclado real (clic, Ctrl+A, escribir): un usuario nunca usa «fill» sobre un campo ya formateado con miles.
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type(String(Math.max(40, Math.floor(t0 / 2))));
  console.log('QA25E valor antes de Enter:', JSON.stringify(await campo.inputValue()));
  await page.keyboard.press('Enter');
  await expect.poll(() => pasos(page), { timeout: 60_000 }).toBe(p0 + 1);
  await libre(page);
  const t1 = await tris();
  console.log('QA25E simplificar tris', t0, '->', t1);
  expect(t1).toBeLessThan(t0);
  await page.screenshot({ path: `${EV}/simplificar-enter.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

for (const [alto, ancho, e] of [[900, 1440, 'light'], [768, 1024, 'dark'], [768, 1024, 'light']] as const) {
  test(`Suavizar ${ancho} ${e}: «Toda la pieza» y el resultado quedan por encima del pie fijo`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: ancho, height: alto });
    const errs = await abrir(page);
    await esquemaDe(page, e);
    const id = await esferaRuidosa(page, 25, 0.8);
    await seleccionar(page, [id]);
    await S(page, (s) => s.dismissAllToasts?.());
    await (await itemAccion(page, 'Suavizar…')).click();
    await expect(page.getByRole('heading', { name: 'Suavizar malla' })).toBeVisible();
    const pie = page.locator('.kura-smooth-actions');
    const cajaPie = async () => (await pie.boundingBox())!;
    const todaLaPieza = page.getByText(/Toda la pieza/).first();
    await todaLaPieza.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const t = (await todaLaPieza.boundingBox())!;
    const p = await cajaPie();
    console.log('QA25E suavizar toda la pieza', JSON.stringify(t), 'pie', JSON.stringify(p));
    expect(t.y + t.height, '«Toda la pieza» bajo el pie').toBeLessThanOrEqual(p.y + 1);
    await page.screenshot({ path: `${EV}/suavizar-${ancho}-${e}-inicio.png` });
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect.poll(() => S(page, (s) => s.busyOperation), { timeout: 90_000 }).toBeNull();
    await page.waitForTimeout(1200);
    const estado = page.locator('#kura-inspector-panel').getByRole('status').last();
    const txtEstado = (await page.locator('#kura-inspector-panel').getByRole('status').allInnerTexts()).join(' | ');
    console.log('QA25E suavizar estado', txtEstado);
    const eb = await estado.boundingBox();
    const pb = await cajaPie();
    if (eb) {
      console.log('QA25E suavizar resultado', JSON.stringify(eb), 'pie', JSON.stringify(pb));
      expect(eb.y + eb.height, 'el resultado quedó bajo el pie fijo').toBeLessThanOrEqual(pb.y + 1);
    }
    await page.screenshot({ path: `${EV}/suavizar-${ancho}-${e}-resultado.png` });
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('Agregados: el selector «Cara» tiene el mismo aspecto que los demás campos', async ({ page }) => {
  const errs = await abrir(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const c = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 40, name: 'Caja' });
  await seleccionar(page, [c.id]);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  const panel = page.getByTestId('placement-panel').or(page.locator('.kura-op-panel, .kura-placement-panel')).first();
  await expect(panel).toBeVisible();
  const cara = page.getByLabel('Cara', { exact: true }).first();
  await expect(cara).toBeVisible();
  const medir = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { h: Math.round(el.getBoundingClientRect().height), borde: cs.borderTopColor + cs.borderTopWidth, radio: cs.borderTopLeftRadius, fondo: cs.backgroundColor, fuente: cs.fontSize };
  });
  const aCara = await medir(cara);
  const otros = await panel.locator('select, input[type=number], input.kura-input').evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    return { id: (el as HTMLElement).getAttribute('aria-label') ?? (el as HTMLElement).id, h: Math.round(el.getBoundingClientRect().height), borde: cs.borderTopColor + cs.borderTopWidth, radio: cs.borderTopLeftRadius, fondo: cs.backgroundColor, fuente: cs.fontSize };
  }));
  console.log('QA25E cara', JSON.stringify(aCara), 'otros', JSON.stringify(otros));
  await page.screenshot({ path: `${EV}/agregados-cara-claro.png` });
  const ref = otros.find((o) => o.id !== 'Cara' && o.h > 0);
  if (ref) {
    expect(aCara.borde).toBe(ref.borde);
    expect(aCara.radio).toBe(ref.radio);
    expect(aCara.fondo).toBe(ref.fondo);
  }
  await esquemaDe(page, 'dark');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${EV}/agregados-cara-oscuro.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});
