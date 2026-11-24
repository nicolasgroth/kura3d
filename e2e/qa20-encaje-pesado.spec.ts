/**
 * @file e2e/qa20-encaje-pesado.spec.ts
 * @description QA20: «Comprobar encaje» con un modelo real pesado (solo lectura desde `QA20_MODELOS`, por
 * defecto `.eval-tmp/modelos`): la interfaz sigue respondiendo (sin bloqueos del hilo principal mayores de
 * 1 s), se puede cancelar y la escena queda intacta (sin pasos de deshacer nuevos). Se omite si falta el archivo.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-encaje-pesado.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir } from './ux-escena-helpers';

const DIR = process.env.QA20_MODELOS ?? 'G:/proyectos/kura3d/.eval-tmp/modelos';
const MODELO = `${DIR}/${process.env.QA20_MODELO ?? 'frierenmw.stl'}`;

const cmd = async (page: Page, command: string, params: Record<string, unknown>) => {
  const r = await page.evaluate(
    async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `e2e-${Math.random()}`, command: c, params: p }),
    [command, params] as const,
  );
  if (!r.ok) throw new Error(`${command}: ${JSON.stringify(r).slice(0, 300)}`);
  return r.result;
};

test('encaje con un modelo real pesado: la interfaz responde, se cancela y la escena no cambia', async ({ page }) => {
  test.skip(!existsSync(MODELO), `falta ${MODELO}`);
  test.setTimeout(600_000);
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(MODELO);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 240_000 }).toBeGreaterThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busy ?? false), { timeout: 240_000 }).toBeFalsy();
  const tris = await page.evaluate(() => (window as any).__s.getState().objects[0].mesh.indices.length / 3);
  console.log('triángulos importados', tris);
  // Una pieza de referencia que cruza el modelo, para tener un par que comprobar.
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Placa', role: 'reference', placement: 'free', position: [0, 0, 20] });
  await page.evaluate(() => (window as any).__s.setState({ selectedIds: [], toasts: [] }));

  // Medidor de bloqueos del hilo principal.
  await page.evaluate(() => {
    const w = window as any;
    w.__gap = 0;
    let last = performance.now();
    const tick = () => {
      const n = performance.now();
      w.__gap = Math.max(w.__gap, n - last);
      last = n;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const huella = () => {
    const s = (window as any).__s.getState();
    return { past: s.past.length, objs: s.objects.map((o: any) => [o.id, o.role, o.mesh.indices.length, ...o.position, ...o.scale]) };
  };
  const antes = await page.evaluate(huella);

  // «Comprobar encaje…» vive en el submenú «Analizar» del menú Acciones.
  await (await itemAccion(page, 'Comprobar encaje…')).click();
  const panel = page.locator('#kura-inspector-panel');
  await page.evaluate(() => ((window as any).__gap = 0));
  const t0 = Date.now();
  await panel.getByRole('button', { name: 'Comprobar', exact: true }).click();
  // 1) cancelar a mitad
  await expect(panel.getByRole('button', { name: 'Cancelar' })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const tClick = Date.now();
  await panel.getByRole('button', { name: 'Cancelar' }).click({ timeout: 120_000 });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().fitCheckRunning), { timeout: 30_000 }).toBeNull();
  console.log('latencia de cancelar ms', Date.now() - tClick, 'desde Comprobar', Date.now() - t0, 'bloqueo máx ms', await page.evaluate(() => (window as any).__gap));
  expect(await page.evaluate(huella)).toEqual(antes);

  // 2) comprobar completo
  await page.evaluate(() => ((window as any).__gap = 0));
  const t1 = Date.now();
  await panel.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(panel.getByTestId('fit-check-result')).toBeVisible({ timeout: 300_000 });
  const gap = await page.evaluate(() => (window as any).__gap);
  console.log('comprobación completa ms', Date.now() - t1, 'bloqueo máx ms', gap);
  expect(gap, 'el hilo principal no debe congelarse más de 1 s').toBeLessThan(1000);
  expect(await page.evaluate(huella)).toEqual(antes);
  expect(errores).toEqual([]);
});
