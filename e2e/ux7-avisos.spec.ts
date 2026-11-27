/**
 * @file e2e/ux7-avisos.spec.ts
 * @description Avisos con acción que no se pierden: «Escalar ×100 / Otra unidad…» sigue a la vista pasados 6 s (un
 * mensaje con acción vigente no caduca), el usuario lo cierra con «Cerrar» y pasa al histórico del centro de
 * mensajes (icono de información), donde su acción sigue operable; tras aplicarla, el botón queda
 * deshabilitado con el motivo; si el objeto ya no existe, también. «Deshacer» en el histórico vale solo mientras no
 * haya otro cambio. El panel queda dentro de la ventana, con el texto ajustado, a 1440 y 1024 px.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/ux7-avisos.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';
import { SHOTS } from './ux7-helpers';

const mayor = (page: Page) =>
  page.evaluate(async () => {
    const { maxDimension } = await import('/src/store/unitRescale.ts');
    return maxDimension((window as any).__s.getState().objects);
  });

const historial = (page: Page) => page.getByRole('dialog', { name: 'Información' });

async function abrirHistorial(page: Page) {
  if (await historial(page).count()) return;
  await page.getByRole('button', { name: /mensajes? informativos?$/ }).click();
  await expect(historial(page)).toBeVisible();
}

test('el aviso de unidades no caduca solo; al cerrarlo pasa al histórico y su acción sigue operable hasta aplicarse', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
  const aviso = page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first();
  await expect(aviso).toBeVisible({ timeout: 30000 });
  // Con acción vigente no caduca: pasados 6 s (con el cursor apartado) sigue a la vista.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(7000);
  await expect(aviso).toBeVisible();
  // El usuario lo cierra y queda en el histórico.
  await aviso.getByRole('button', { name: 'Cerrar' }).click();
  await expect(aviso).toBeHidden();
  await abrirHistorial(page);
  const entrada = historial(page).locator('li', { hasText: 'mide 0,9 mm' });
  await expect(entrada.getByRole('button', { name: 'Escalar ×100' })).toBeEnabled();
  await expect(entrada.getByRole('button', { name: 'Otra unidad…' })).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/avisos-historial-1440.png` });
  await entrada.getByRole('button', { name: 'Escalar ×100' }).click();
  await expect.poll(() => mayor(page)).toBeCloseTo(90, 0);

  // Ya aplicada: deshabilitada y con el motivo a la vista.
  await abrirHistorial(page);
  const tras = historial(page).locator('li', { hasText: 'mide 0,9 mm' });
  await expect(tras.getByRole('button', { name: 'Escalar ×100' })).toBeDisabled();
  await expect(tras.getByText('Ya se aplicó')).toBeVisible();
});

test('si el objeto ya no existe, el botón del historial queda deshabilitado con el motivo', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const obj = await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    s.addToast('Aviso con arreglo', 'info', { label: 'Arreglar', run: () => undefined, targetIds: [obj.id] });
  });
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    s.deleteObjects(s.objects.map((o: any) => o.id));
  });
  // Sin objeto la acción ya no aplica.
  await abrirHistorial(page);
  const entrada = historial(page).locator('li', { hasText: 'Aviso con arreglo' });
  await expect(entrada.getByRole('button', { name: 'Arreglar' })).toBeDisabled();
  await expect(entrada.getByText('El objeto ya no existe')).toBeVisible();
});

test('«Deshacer» en el histórico vale solo hasta el siguiente cambio', async ({ page }) => {
  await abrir(page);
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    const st = (window as any).__s.getState();
    st.setSelection(st.objects.map((o: any) => o.id));
    st.groupObjects();
  });
  const aviso = page.locator('.kura-toast', { hasText: /agrupad/i }).first();
  await expect(aviso).toBeVisible();
  await abrirHistorial(page);
  await expect(historial(page).locator('li', { hasText: /agrupad/i }).getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('sphere', { radius: 8 }, {});
  });
  await abrirHistorial(page);
  const entrada = historial(page).locator('li', { hasText: /agrupad/i });
  await expect(entrada.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  await expect(entrada.getByText('Ya no aplica: la escena cambió')).toBeVisible();
});

for (const width of [1440, 1024]) {
  test(`el panel del histórico queda dentro de la ventana con el texto ajustado a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await abrir(page);
    await page.evaluate(() => {
      const s = (window as any).__s.getState();
      s.addToast('«busto_personal_fernando_con_un_nombre_de_archivo_muy_largo.stl» mide 0,95 mm en su lado mayor: puede que el archivo esté en otra unidad.', 'info', { label: 'Escalar ×100', run: () => undefined });
      s.addToast('Importado obj_1_OcarinaDeluxe.stl: 1 pieza · 38.144 triángulos', 'success');
    });
    await abrirHistorial(page);
    const panel = historial(page);
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const sinScroll = await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(sinScroll).toBe(true);
    // El texto largo ocupa varias líneas en vez de cortarse.
    const alto = await panel.locator('li', { hasText: 'busto_personal' }).locator('.kura-toast-center-text').evaluate((el) => el.getBoundingClientRect().height);
    expect(alto).toBeGreaterThan(24);
    await page.screenshot({ path: `${SHOTS}/avisos-panel-${width}.png` });
  });
}
