/**
 * @file e2e/dividir-manual.spec.ts
 * @description Recorrido de «Dividir para imprimir» con cortes a mano sobre una barra creada en la app: «Editar estos
 * cortes a mano» copia la rejilla, se agrega un plano, se inclina otro (20° hacia Z), el conmutador «Solo las piezas»
 * oculta los planos, se divide y las piezas quedan con su código (A1, B1…) y la unión inclinada con su normal. Luego
 * «Volver al automático» restablece la rejilla. A 1024 px de ancho la lista cabe en el panel (sin desborde horizontal).
 * Evidencia en `.eval-tmp/dividir-manual/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, libre, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/dividir-manual';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

test('dividir con cortes a mano: editar desde el automático, inclinar, ver solo piezas y dividir', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const barra = await cmd(page, 'create_primitive', { type: 'box', width: 420, height: 60, depth: 60, name: 'Barra', position: [0, 0, 0] });
  await libre(page);
  await seleccionar(page, [barra.id]);
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  const panel = page.locator('.kura-split-panel');
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });

  // Partir de la rejilla automática
  await page.getByRole('button', { name: 'Editar estos cortes a mano' }).click();
  await expect(page.getByRole('radio', { name: 'A mano' })).toBeChecked();
  const filas = panel.locator('.kura-split-cuts > li');
  const antes = await filas.count();
  expect(antes).toBeGreaterThan(0);

  // Agregar un plano y luego inclinar el primero 20° hacia Z
  await page.getByRole('button', { name: 'Agregar plano' }).click();
  await expect(filas).toHaveCount(antes + 1);
  const inclinacion = page.getByRole('spinbutton', { name: 'Inclinación del plano 1 hacia Z (grados)', exact: true });
  await inclinacion.fill('20');
  await inclinacion.press('Enter');
  await expect(panel.locator('.kura-split-cuts > li').first()).toContainText('inclinado');
  await expect.poll(async () => /Calculando/.test(await panel.innerText()), { timeout: 60_000 }).toBe(false);
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  const plan = await S(page, (s) => s.splitPlanPreview.plan);
  expect(plan.manual).toBe(true);
  expect(plan.planes.some((p: any) => Array.isArray(p.normal))).toBe(true);

  // «Ver» resalta el plano; «Solo las piezas» oculta los planos
  await page.getByRole('button', { name: 'Resaltar el plano 1 en el visor' }).click();
  await expect.poll(() => S(page, (s) => s.splitActivePlane)).not.toBeNull();
  await page.screenshot({ path: `${EV}/cortes-a-mano.png` });
  await page.getByRole('radio', { name: 'Solo las piezas' }).click();
  expect(await S(page, (s) => s.splitShowCuts)).toBe(false);
  await page.screenshot({ path: `${EV}/solo-piezas.png` });
  await page.getByRole('radio', { name: 'Mostrar cortes' }).click();

  // A 1024 px el panel no desborda en horizontal
  const desborde = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(desborde).toBeLessThanOrEqual(1);

  // Dividir: piezas con código y la unión inclinada con su normal
  await dividir.click();
  await expect.poll(() => S(page, (s) => s.objects.filter((o: any) => o.metadata?.split).length), { timeout: 180_000 }).toBeGreaterThan(1);
  const codigos = await S(page, (s) => s.objects.filter((o: any) => o.metadata?.split).map((o: any) => o.metadata.split.code as string));
  expect(codigos).toContain('A1');
  expect(codigos).toContain('B1');
  const inclinadas = await S(page, (s) => s.objects.flatMap((o: any) => o.metadata?.split?.joints ?? []).filter((j: any) => Array.isArray(j.normal)).length);
  expect(inclinadas).toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('dividir con cortes a mano: volver al automático restablece la rejilla', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const barra = await cmd(page, 'create_primitive', { type: 'box', width: 420, height: 60, depth: 60, name: 'Barra', position: [0, 0, 0] });
  await seleccionar(page, [barra.id]);
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('radio', { name: 'A mano' }).check();
  await page.getByRole('button', { name: 'Quitar el plano 1' }).click();
  await page.getByRole('button', { name: 'Volver al automático' }).click();
  await expect(page.getByRole('radio', { name: 'Automático' })).toBeChecked();
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  expect(await S(page, (s) => Boolean(s.splitPlanPreview.plan?.manual))).toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});
