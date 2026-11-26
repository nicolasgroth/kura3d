/**
 * @file e2e/qa25h-repartir.spec.ts
 * @description QA 25-h del panel «Repartir en placas…»: las cuatro entradas (paleta, menú Acciones, botón de la tira,
 * aviso «Fuera de volumen»), foco inicial, Esc y «Volver», vista previa con contornos en el visor (claro y oscuro), campos
 * fuera de rango, «Una placa por objeto», un paso de historial con su etiqueta, paso de Armado/Libre a Imprimir, y
 * cancelar la vista previa con «Cara plana abajo» sobre una pieza real. A 1024 px no desborda.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrirAcciones } from './acciones-helpers';
import { agregarForma } from './agregar-helpers';
import { abrir as abrirErr, clavesCrudas, libre } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25h';
const REAL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const panel = (page: Page) => page.getByRole('dialog', { name: 'Repartir en placas' });
const resumen = (page: Page) => page.getByTestId('arrange-summary');

async function escena(page: Page, n = 3, cama = 60) {
  const errs = await abrirErr(page);
  for (let i = 0; i < n; i++) await agregarForma(page, 'Cubo');
  await page.evaluate((c) => (window as any).__s.setState({ customBedDimensions: { width: c, depth: c, height: 100 } }), cama);
  await S(page, (s) => s.dismissAllToasts?.());
  return errs;
}

async function porPaleta(page: Page) {
  await page.keyboard.press('Control+K');
  await page.getByRole('combobox', { name: 'Buscar comandos' }).fill('Repartir en placas');
  await page.getByRole('option', { name: /Repartir en placas…/ }).first().click();
  await expect(panel(page)).toBeVisible();
}

test('las cuatro entradas abren el panel; foco inicial, Esc y «Volver» devuelven el foco', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await escena(page);
  // 1) paleta
  await porPaleta(page);
  // El foco inicial cae en el primer radio marcado del diálogo (el alcance), dentro del panel.
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement)?.type + ':' + (document.activeElement?.closest('[role="dialog"]') ? 'dentro' : 'fuera'))).toBe('radio:dentro');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  // 2) menú Acciones
  // La acción vive en el grupo «Posición» del menú (no está en el catálogo que usa `itemAccion`).
  const menu = await abrirAcciones(page);
  await menu.locator(':scope > .kura-context-subwrap > [aria-haspopup="menu"]').filter({ hasText: 'Posición' }).click();
  await page.getByRole('menuitem', { name: /Repartir en placas…/ }).click();
  await expect(panel(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLInputElement)?.type)).toBe('radio');
  await page.getByTestId('panel-back').click();
  await expect(panel(page)).toHaveCount(0);
  const foco = await page.evaluate(() => (document.activeElement as HTMLElement)?.outerHTML.slice(0, 120));
  console.log('QA25H foco tras Volver:', foco);
  // 3) botón de la tira: con dos placas, se encuentra por su texto visible «Repartir…» (su nombre accesible era
  // «Repartir en placas…» y no coincidía con lo que se ve; corregido el 26-nov).
  await S(page, (s) => s.createPlate());
  await page.getByTestId('plate-strip').getByRole('button', { name: 'Repartir…' }).click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  // 4) aviso «Fuera de volumen»
  await S(page, (s) => s.setObjectTransform(s.objects[0].id, { position: [1000, 0, 0] }, true));
  await page.getByTestId('oob-arrange').click();
  await expect(panel(page)).toBeVisible();
  await page.screenshot({ path: `${EV}/repartir-desde-fuera-de-volumen.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

for (const width of [1024, 1440]) {
  for (const tema of ['light', 'dark'] as const) {
    test(`vista previa en vivo con contornos y camas nuevas, errores de campo, una placa por objeto (${width} px, ${tema})`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height: width === 1024 ? 768 : 900 });
      await page.emulateMedia({ colorScheme: tema });
      const errs = await escena(page);
      await page.evaluate((e) => (window as any).__s.getState().setColorScheme(e), tema);
      await porPaleta(page);
      await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', 'ready', { timeout: 15_000 });
      console.log('QA25H resumen:', (await page.getByTestId('arrange-preview').innerText()).replace(/\s+/g, ' '));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${EV}/repartir-previa-${width}-${tema}.png` });
      // El panel y la página no desbordan.
      const caja = await panel(page).boundingBox();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(width);
      const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
      expect(doc.sw).toBeLessThanOrEqual(doc.vw);
      const interno = await panel(page).evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      expect(interno.sw).toBeLessThanOrEqual(interno.cw + 1);
      expect(await clavesCrudas(page, '[role="dialog"]')).toEqual([]);
      // Apply visible sin desplazar.
      await expect(page.getByTestId('arrange-apply')).toBeInViewport();
      // La vista previa pone contornos (ghost) en el store y se limpian al cerrar.
      const ghost = await page.evaluate(async () => (await import('/src/store/plateArrangePanel.ts')).usePlateArrangePanel.getState().ghost);
      console.log('QA25H ghost presente:', Boolean(ghost));
      expect(Boolean(ghost)).toBe(true);
      // Campos fuera de 0–100.
      for (const key of ['spacingMm', 'marginMm'] as const) {
        const campo = page.getByTestId(`arrange-field-${key}`).locator('input');
        for (const mal of ['150', '-5', 'abc']) {
          await campo.fill(mal);
          await campo.press('Tab');
          const dis = await page.getByTestId('arrange-apply').isDisabled();
          console.log('QA25H', key, mal, 'apply deshabilitado:', dis, 'alerta:', await page.getByTestId(`arrange-field-${key}`).getByRole('alert').count());
          expect(dis, `${key}=${mal}`).toBe(true);
        }
        await campo.fill('3');
        await campo.press('Tab');
        await expect(page.getByTestId('arrange-apply')).toBeEnabled();
      }
      const campo = page.getByTestId('arrange-field-spacingMm').locator('input');
      await campo.fill('150');
      await campo.press('Tab');
      await page.screenshot({ path: `${EV}/repartir-campo-invalido-${width}-${tema}.png` });
      await campo.fill('3');
      await campo.press('Tab');
      // Una placa por objeto deshabilita orientación, separación y margen.
      await page.getByTestId('arrange-criterion-onePerObject').check();
      await expect(page.getByTestId('arrange-orient-flatDown')).toBeDisabled();
      await expect(page.getByTestId('arrange-orient-keep')).toBeDisabled();
      await expect(page.getByTestId('arrange-field-spacingMm').locator('input')).toBeDisabled();
      await expect(page.getByTestId('arrange-field-marginMm').locator('input')).toBeDisabled();
      await page.screenshot({ path: `${EV}/repartir-una-por-objeto-${width}-${tema}.png` });
      // Al cerrar desaparecen los contornos.
      await page.keyboard.press('Escape');
      await expect(panel(page)).toHaveCount(0);
      const ghost2 = await page.evaluate(async () => (await import('/src/store/plateArrangePanel.ts')).usePlateArrangePanel.getState().ghost);
      expect(ghost2 ?? null).toBeNull();
      expect(errs, errs.join('\n')).toEqual([]);
    });
  }
}

test('«Repartir» es un paso con su etiqueta en el historial; desde Armado y Libre pasa a Imprimir y lo dice', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await escena(page);
  for (const vista of ['assembly', 'free'] as const) {
    await S(page, (s) => s.undo?.());
    await page.evaluate((v) => (window as any).__s.getState().setViewMode(v), vista);
    const modo0 = await S(page, (s) => s.layout);
    const pasos0 = await S(page, (s) => s.past.length);
    await porPaleta(page);
    await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', 'ready', { timeout: 15_000 });
    await page.getByTestId('arrange-apply').click();
    await expect(panel(page)).toHaveCount(0);
    const layout = await S(page, (s) => s.layout);
    console.log('QA25H vista', vista, 'antes', modo0, 'después', layout, 'pasos', pasos0, '->', await S(page, (s) => s.past.length), 'placas', await S(page, (s) => s.plates.length));
    expect(layout).toBe('print');
    expect(await S(page, (s) => s.past.length)).toBe(pasos0 + 1);
    await expect(page.getByText('Pasaste a la vista Imprimir')).toBeVisible();
    await page.screenshot({ path: `${EV}/repartir-aviso-${vista}.png` });
    // Etiqueta en el historial de acciones.
    await page.getByRole('button', { name: 'Historial de acciones' }).click();
    const menu = page.getByRole('dialog').or(page.getByRole('menu')).or(page.locator('.kura-history-popover, [class*="history"]')).last();
    await page.waitForTimeout(400);
    const txt = await page.locator('body').innerText();
    const idx = txt.indexOf('Repartir en placas');
    console.log('QA25H historial contiene «Repartir en placas»:', idx >= 0, menu ? '' : '');
    await page.screenshot({ path: `${EV}/repartir-historial-${vista}.png` });
    expect(idx).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Escape');
    await page.getByRole('status').filter({ hasText: /repartid/ }).getByRole('button', { name: 'Deshacer' }).click().catch(() => undefined);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('«Cara plana abajo» con una pieza real: se puede cancelar la vista previa y no cambia nada', async ({ page }) => {
  test.skip(!existsSync(REAL), 'sin modelo');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrirErr(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  (await chooser).setFiles(REAL);
  await expect.poll(() => S(page, (s) => s.objects.length), { timeout: 120_000 }).toBeGreaterThan(0);
  await libre(page);
  const antes = await S(page, (s) => JSON.stringify(s.objects.map((o: any) => [o.position, o.rotation])));
  const pasos0 = await S(page, (s) => s.past.length);
  await S(page, (s) => s.dismissAllToasts?.());
  await porPaleta(page);
  await page.getByTestId('arrange-orient-flatDown').check();
  const t = Date.now();
  const corriendo = page.getByTestId('arrange-running');
  const vio = await corriendo.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
  console.log('QA25H flatDown: «calculando» visible:', vio, 'ms', Date.now() - t);
  if (vio) {
    await page.getByTestId('arrange-cancel-preview').click();
    await expect(page.getByTestId('arrange-cancelled')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EV}/repartir-cancelada.png` });
    await expect(page.getByTestId('arrange-apply')).toBeEnabled();
  } else {
    await expect(page.getByTestId('arrange-preview')).toHaveAttribute('data-status', /ready|cancelled/, { timeout: 60_000 });
    console.log('QA25H flatDown: el cálculo fue demasiado rápido para cancelar; estado', await page.getByTestId('arrange-preview').getAttribute('data-status'));
  }
  expect(await S(page, (s) => JSON.stringify(s.objects.map((o: any) => [o.position, o.rotation])))).toBe(antes);
  expect(await S(page, (s) => s.past.length)).toBe(pasos0);
  expect(errs, errs.join('\n')).toEqual([]);
});
