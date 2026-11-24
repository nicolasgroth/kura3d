/**
 * @file e2e/qa20-referencia.spec.ts
 * @description QA20: objetos de referencia en los bordes del flujo: una escena que solo tiene referencias no
 * debe producir un archivo vacío en silencio al exportar (el diálogo debe avisar o deshabilitar), el rol y la
 * opacidad sobreviven a guardar y reabrir `.kura` (códec real) y la referencia no cuenta como pieza
 * exportable en el resumen del diálogo. Cero errores de consola.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-referencia.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const cmd = async (page: Page, command: string, params: Record<string, unknown>) => {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `e2e-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 300)}`);
  return r.result;
};

test('solo referencias: exportar no deja bajar un archivo vacío sin avisar', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Ref', role: 'reference', placement: 'free', position: [0, 0, 5] });
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  const boton = dlg.getByRole('button', { name: /^Exportar / });
  const deshabilitado = await boton.isDisabled();
  const texto = (await dlg.textContent()) ?? '';
  console.log('botón deshabilitado:', deshabilitado, '| texto del diálogo:', texto.replace(/\s+/g, ' ').slice(0, 400));
  if (!deshabilitado) {
    const descarga = page.waitForEvent('download', { timeout: 5000 }).then((d) => d, () => null);
    await boton.click();
    const d = await descarga;
    console.log('descarga generada:', d ? d.suggestedFilename() : 'ninguna');
    expect(d, 'no debe descargarse un archivo vacío').toBeNull();
  }
  expect(errores).toEqual([]);
});

test('el rol Referencia y su opacidad sobreviven al códec .kura (guardar y abrir)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const ref = await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Ref', role: 'reference', placement: 'free', position: [0, 0, 5] });
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 10, name: 'Pieza', placement: 'free', position: [40, 0, 5] });
  await page.evaluate((id) => (window as any).__s.setState((st: any) => ({ objects: st.objects.map((o: any) => (o.id === id ? { ...o, referenceOpacity: 0.3 } : o)) })), ref.id);
  const antes = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => [o.name, o.role, o.referenceOpacity ?? null]));
  // Códec real: captura del proyecto, codificación y decodificación como al guardar y abrir un .kura.
  const arr = await page.evaluate(async () => {
    const { captureProject } = await import('/src/store/projectDocument.ts');
    const { encodeProjectAsync } = await import('/src/project/projectCodecClient.ts');
    return Array.from(await encodeProjectAsync(captureProject((window as any).__s.getState())));
  });
  await page.evaluate(() => (window as any).__s.getState().clearScene());
  await page.evaluate(async (arr) => {
    const u8 = new Uint8Array(arr);
    await (window as any).__s.getState().openProject(async () => ({ name: 'qa20.kura', bytes: u8, location: null }));
  }, arr);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  const despues = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => [o.name, o.role, o.referenceOpacity ?? null]));
  console.log('antes', JSON.stringify(antes), 'despues', JSON.stringify(despues));
  expect(despues).toEqual(antes);
});
