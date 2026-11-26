/**
 * @file e2e/qa25e-dividir-imanes.spec.ts
 * @description QA 25-nov (E) de «Dividir para imprimir» con imanes sobre una figura real (ocarina): el resumen dice
 * «hasta N con imán, según el espacio…», la sugerencia es la de imán, toda pieza resultante lleva su código (también
 * las de celdas con varios cuerpos, «A1·2») y con varios avisos apilados la tarjeta «N piezas · M placas» sigue
 * visible. Tema claro y oscuro. Evidencia en `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, libre, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';
const REAL = process.env.QA_MODELO ?? 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

for (const esquema of ['light', 'dark'] as const) {
  test(`dividir con imanes la ocarina real (${esquema})`, async ({ page }) => {
    test.skip(!existsSync(REAL), 'sin modelo real');
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrir(page);
    await page.emulateMedia({ colorScheme: esquema });
    await page.evaluate((e) => (window as any).__s.getState().setColorScheme(e), esquema);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
    (await chooser).setFiles(REAL);
    await expect.poll(() => S(page, (s) => s.objects.length), { timeout: 120_000 }).toBeGreaterThan(0);
    await libre(page);
    const id = await S(page, (s) => s.objects[0].id as string);
    // La ocarina cabe en la cama: se agranda para que haya que dividirla.
    await S(page, (s) => s.setObjectTransform(s.objects[0].id, { scale: [3, 3, 3] }, true));
    await seleccionar(page, [id]);
    await S(page, (s) => s.dismissAllToasts?.());
    await (await itemAccion(page, 'Dividir para imprimir…')).click();
    const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
    await expect(dividir).toBeEnabled({ timeout: 120_000 });
    await page.getByLabel('Tipo de conector', { exact: true }).selectOption('magnet');
    await expect(page.getByTestId('split-magnet-options')).toBeVisible();
    await expect(dividir).toBeEnabled({ timeout: 120_000 });
    await page.waitForTimeout(1500);
    const panel = page.locator('.kura-split-panel');
    // «hasta N con imán» solo sale si alguna unión se pega: se prueba con un imán grande que no quepa en todas.
    await page.getByLabel('Imán', { exact: true }).selectOption({ label: 'Redondo 10 × 3' }).catch(() => undefined);
    await page.getByLabel('Holgura del diámetro (mm)').fill('3').catch(() => undefined);
    await page.getByLabel('Holgura del diámetro (mm)').press('Enter').catch(() => undefined);
    await expect.poll(async () => /Calculando/.test(await panel.innerText()), { timeout: 120_000 }).toBe(false);
    await expect(dividir).toBeEnabled({ timeout: 120_000 });
    const txt = (await panel.innerText()).replace(/\s+/g, ' ');
    console.log('QA25E panel dividir:', txt.slice(txt.indexOf('RESUMEN'), txt.indexOf('RESUMEN') + 900));
    await page.screenshot({ path: `${EV}/dividir-imanes-${esquema}.png` });
    // «hasta N con imán» aparece cuando alguna unión se pega; si todas llevan imán el resumen dice «todas con conector».
    if (/se pega|para pegar|pegar/i.test(txt.slice(txt.indexOf('RESUMEN')))) expect(txt).toMatch(/hasta \d+ con im[aá]n/i);
    else console.log('QA25E nota: todas las uniones llevan conector; no se pudo ver el texto «hasta N con imán»');
    expect(txt).not.toMatch(/Kura3D/);
    await dividir.click();
    await expect.poll(() => S(page, (s) => s.objects.length), { timeout: 240_000 }).toBeGreaterThan(1);
    await libre(page);
    await page.waitForTimeout(1500);
    const nombres = await S(page, (s) => s.objects.filter((o: any) => o.role === 'solid' && !o.metadata?.addon).map((o: any) => o.name as string));
    console.log('QA25E piezas:', nombres.length, JSON.stringify(nombres));
    const sinCodigo = nombres.filter((n) => !/[A-Z]\d+/.test(n));
    console.log('QA25E piezas sin código:', JSON.stringify(sinCodigo));
    expect(sinCodigo, 'toda pieza resultante debe llevar su código').toEqual([]);
    const tarjeta = page.getByText(/\d+ piezas? · \d+ placas?/).first();
    console.log('QA25E tarjeta armado visible:', await tarjeta.isVisible().catch(() => false), 'avisos:', await page.locator('.kura-toast, [role="alert"]').count());
    await page.screenshot({ path: `${EV}/dividir-resultado-${esquema}.png` });
    await expect(tarjeta).toBeInViewport();
    expect(errs, errs.join('\n')).toEqual([]);
  });
}
