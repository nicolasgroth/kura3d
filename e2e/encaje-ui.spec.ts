/**
 * @file e2e/encaje-ui.spec.ts
 * @description «Comprobar encaje» en la web real (con el Worker del motor): una caja con un bolsillo negativo
 * y una placa de referencia que no cabe → choque con recomendación de agrandar; agrandar el bolsillo → el
 * panel avisa que la escena cambió y, al volver a comprobar, el par queda bien con su holgura; resaltado en
 * el visor desde la lista con teclado; Cancelar una comprobación en curso; disponibilidad con motivo en el
 * menú Acciones; y cero errores de consola.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5252/ npx playwright test e2e/encaje-ui.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir } from './ux-escena-helpers';

const cmd = async (page: Page, command: string, params: Record<string, unknown>) => {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `e2e-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 300)}`);
  return r.result;
};

/** Caja 40×40×20 con un bolsillo negativo de `pocket` mm en la cara de arriba y una placa de referencia de 22×22×4. */
async function escena(page: Page, pocket: number) {
  const caja = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 20, name: 'Caja', placement: 'free', position: [0, 0, 0] });
  const bolsillo = await cmd(page, 'create_primitive', { type: 'box', width: pocket, depth: pocket, height: 10, name: 'Bolsillo', role: 'negative', placement: 'free', position: [0, 0, 12] });
  const placa = await cmd(page, 'create_primitive', { type: 'box', width: 22, depth: 22, height: 4, name: 'Placa', role: 'reference', placement: 'free', position: [0, 0, 14] });
  return { caja: caja.id as string, bolsillo: bolsillo.id as string, placa: placa.id as string };
}

async function abrirEncaje(page: Page) {
  await (await itemAccion(page, 'Comprobar encaje…')).click();
  const panel = page.locator('#kura-inspector-panel');
  await expect(panel.getByRole('heading', { name: 'Comprobar encaje' })).toBeVisible();
  return panel;
}

test('encaje: choque con recomendación, agrandar el bolsillo, resaltado, cancelar y consola limpia', async ({ page }) => {
  test.setTimeout(180_000);
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await abrir(page);

  // Sin objetos, la acción está deshabilitada con su motivo.
  const item = await itemAccion(page, 'Comprobar encaje…');
  await expect(item).toBeDisabled();
  await expect(page.locator('.kura-actions-layer')).toContainText('Hacen falta dos objetos visibles');
  await page.keyboard.press('Escape');

  const ids = await escena(page, 20);
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: [], toasts: [] }));
  const panel = await abrirEncaje(page);
  await expect(panel.getByTestId('fit-check-scope')).toContainText('Se comprueban los 2 objetos visibles.');
  const huella = () => {
    const s = (window as any).__s.getState();
    return { past: s.past.length, objs: s.objects.map((o: any) => [o.id, o.role, o.mesh.indices.length, ...o.position, ...o.scale]) };
  };
  const antes = await page.evaluate(huella);

  // 1. Comprobar (Worker real): la placa no cabe en el bolsillo → choque y «Agranda el alojamiento».
  await panel.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(panel.getByTestId('fit-check-result')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId('fit-check-count-clashes')).toHaveText('1');
  const par = panel.getByRole('option').first();
  await expect(par).toHaveAttribute('data-status', 'interferes');
  await expect(par).toContainText('Choque');
  await expect(par).toContainText(/Choque de [\d.,]+ mm³/);
  await expect(par).toContainText('Agranda el alojamiento');
  // La escena no cambia: los mismos objetos (mismas referencias) y sin pasos de deshacer nuevos.
  expect(await page.evaluate(huella)).toEqual(antes);

  // 2. Resaltado con teclado: foco en el par, Enter lo resalta y encuadra.
  await par.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().fitCheckHighlight)).toEqual({ aId: ids.placa, bId: ids.caja });
  expect(await page.evaluate(() => (window as any).__s.getState().cameraRequest?.preset)).toBe('focus');

  // 3. Agrandar el bolsillo invalida el informe: el panel lo dice y ofrece volver a comprobar.
  await cmd(page, 'update_primitive_params', { id: ids.bolsillo, params: { width: 24, depth: 24 } });
  await expect(panel.getByTestId('fit-check-stale')).toContainText('La escena cambió');
  expect(await page.evaluate(() => (window as any).__s.getState().fitCheckHighlight)).toBeNull();
  await panel.getByRole('button', { name: 'Volver a comprobar' }).click();
  await expect(panel.getByTestId('fit-check-result')).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId('fit-check-count-clashes')).toHaveText('0');
  await expect(panel.getByTestId('fit-check-clean')).toContainText('Todo calza');
  const ok = panel.getByRole('option').first();
  await expect(ok).toHaveAttribute('data-status', 'ok');
  await expect(ok).toContainText('Holgura 1,00 mm');
  await ok.click();
  await expect(page.getByTestId('fit-check-gap-label')).toHaveText('1,00 mm');

  // 4. Volver limpia el resaltado.
  await panel.getByRole('button', { name: 'Volver', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__s.getState().fitCheckHighlight)).toBeNull();

  // 5. Cancelar: la comprobación en curso se detiene sin dejar informe nuevo.
  const p2 = await abrirEncaje(page);
  await page.evaluate(() => (window as any).__s.getState().clearFitCheck());
  await p2.getByRole('button', { name: 'Comprobar', exact: true }).click();
  // La comprobación de esta escena es corta: si terminó antes del clic, no hay nada que cancelar.
  const cancelado = await p2.getByRole('button', { name: 'Cancelar' }).click({ timeout: 2_000 }).then(() => true, () => false);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().fitCheckRunning)).toBeNull();
  await expect(p2.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
  if (cancelado) {
    await expect(p2.getByTestId('fit-check-result')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__s.getState().fitCheck)).toBeNull();
  }
  test.info().annotations.push({ type: 'cancelar', description: cancelado ? 'cancelada en curso' : 'terminó antes del clic' });

  expect(errores).toEqual([]);
});
