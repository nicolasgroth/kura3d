/**
 * @file e2e/torreta.spec.ts
 * @description Torreta para tornillo con ratón real: abrir desde Insertar, colocar en la cara superior y en una
 * lateral (vista previa al pasar el cursor), la selección no cambia, deshacer en un paso, aplicar restas (el poste se
 * une a la pieza: queda un solo objeto cerrado con más volumen que el cubo) y deshacer la resta. Escrito sin
 * ejecutar en este lote; lo corre el orquestador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];

const st = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  return {
    objects: s.objects.map((o: any) => ({
      id: o.id, name: o.name, role: o.role, addon: o.metadata?.addon ?? null, volume: o.stats.volumeMm3, manifold: o.stats.isManifold,
    })),
    selectedIds: s.selectedIds as string[],
    past: s.past.length as number,
    busy: s.busyOperation as string | null,
  };
});

async function cubo(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = () => (window as any).__s.getState();
    const o = await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 0, 0] });
    s().setSelection([]);
    s().dismissAllToasts?.();
    return o.id as string;
  });
}

const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);

async function vista(page: Page, cam: P3) {
  await page.evaluate((c) => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(c[0], c[1], c[2]);
    r.camera.lookAt(0, 15, 0);
    r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(0, 15, 0);
    r.controls?.update?.();
  }, cam);
  await cuadros(page);
}

async function clic(page: Page, p: P3) {
  const a = await aPixel(page, p);
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.mouse.down();
  await page.mouse.up();
}

const hover = (page: Page) => page.evaluate(async () => {
  const { useScrewBossPanel } = await import('/src/store/screwBossPanel.ts');
  return useScrewBossPanel.getState().hover?.hostId ?? null;
});

const esperarLibre = (page: Page) => expect.poll(async () => (await st(page)).busy, { timeout: 15_000 }).toBeNull();
const torretas = async (page: Page) => (await st(page)).objects.filter((o: any) => o.addon?.kind === 'screw_boss');

test('colocar en cara superior y lateral, deshacer, aplicar restas y deshacer', async ({ page }) => {
  await abrir(page);
  const hostId = await cubo(page);
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), hostId);
  await vista(page, [60, 70, 80]);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Torreta para tornillo/ }).click();
  await expect(page.locator('.kura-turret-panel')).toBeVisible();
  await expect(page.getByTestId('turret-summary')).toHaveText('Poste Ø 7,5 × 10 mm, agujero Ø 2,5 × 8 mm');

  // Vista previa al pasar el cursor y clic en la cara superior.
  const top = await aPixel(page, [0, 30, 0]);
  await page.mouse.move(top.x, top.y, { steps: 3 });
  await expect.poll(() => hover(page)).toBe(hostId);
  const before = await st(page);
  await clic(page, [0, 30, 0]);
  await esperarLibre(page);
  let s = await st(page);
  expect((await torretas(page)).map((o: any) => [o.role, o.addon.part])).toEqual([['solid', 'post'], ['negative', 'hole']]);
  expect(s.past).toBe(before.past + 1);
  expect(s.selectedIds).toEqual([hostId]);

  // Cara lateral (+X).
  await vista(page, [110, 30, 20]);
  await clic(page, [15, 15, 0]);
  await esperarLibre(page);
  expect(await torretas(page)).toHaveLength(4);

  // Deshacer quita solo la última.
  await page.keyboard.press('Control+z');
  expect(await torretas(page)).toHaveLength(2);
  await page.getByTestId('turret-done').click();
  await expect(page.locator('.kura-turret-panel')).toHaveCount(0);

  // Aplicar restas: el poste se une al cubo y el agujero lo corta; queda un solo objeto cerrado.
  const cubeVolume = (await st(page)).objects.find((o: any) => o.id === hostId).volume as number;
  await page.evaluate(async () => {
    const x = (window as any).__s.getState();
    x.setSelection([]);
    await x.applyHolesOnSolids();
  });
  await esperarLibre(page);
  s = await st(page);
  expect(s.objects).toHaveLength(1);
  expect(s.objects[0].manifold).toBe(true);
  // Poste Ø 7,5 × 10 (≈ 441 mm³) menos agujero Ø 2,5 × 8 (≈ 40 mm³).
  expect(s.objects[0].volume - cubeVolume).toBeGreaterThan(390);
  expect(s.objects[0].volume - cubeVolume).toBeLessThan(410);

  // Deshacer la resta devuelve el cubo, el poste y el agujero.
  await page.keyboard.press('Control+z');
  expect(await torretas(page)).toHaveLength(2);
});

test('Escape cierra el panel y el clic derecho › Más ofrece la torreta', async ({ page }) => {
  await abrir(page);
  await cubo(page);
  await vista(page, [60, 70, 80]);
  const c = await aPixel(page, [0, 15, 15]);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /^Más/ }).click();
  await page.getByRole('menuitem', { name: /^Torreta para tornillo/ }).click();
  await expect(page.locator('.kura-turret-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-turret-panel')).toHaveCount(0);
});
