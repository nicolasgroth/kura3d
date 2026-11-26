/**
 * @file e2e/paso-cable.spec.ts
 * @description Paso de cable con ratón real: abrir desde Insertar, vista previa al pasar el cursor por la pared de una
 * placa de 4 mm, colocar un redondo y una ranura (la selección no cambia, un paso de deshacer cada uno, largo medido
 * = espesor), aplicar restas (un solo objeto cerrado con menos volumen) y deshacer; Escape cierra y el clic derecho ›
 * Más lo ofrece. Escrito sin ejecutar en este lote; lo corre el orquestador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];

const st = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  return {
    objects: s.objects.map((o: any) => ({ id: o.id, role: o.role, addon: o.metadata?.addon ?? null, volume: o.stats.volumeMm3, manifold: o.stats.isManifold })),
    selectedIds: s.selectedIds as string[],
    past: s.past.length as number,
    busy: s.busyOperation as string | null,
  };
});

async function placa(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = () => (window as any).__s.getState();
    const o = await s().createPrimitive('box', { width: 60, height: 60, depth: 4 }, { position: [0, 0, 0] });
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
    r.camera.lookAt(0, 30, 0);
    r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(0, 30, 0);
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
  const { useCablePassPanel } = await import('/src/store/cablePassPanel.ts');
  return useCablePassPanel.getState().hover?.hostId ?? null;
});

const esperarLibre = (page: Page) => expect.poll(async () => (await st(page)).busy, { timeout: 15_000 }).toBeNull();
const pasos = async (page: Page) => (await st(page)).objects.filter((o: any) => o.addon?.kind === 'cable_pass');

test('redondo y ranura, aplicar restas y deshacer', async ({ page }) => {
  await abrir(page);
  const hostId = await placa(page);
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), hostId);
  await vista(page, [30, 40, 110]);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Paso de cable/ }).click();
  await expect(page.locator('.kura-cable-panel')).toBeVisible();
  await expect(page.getByTestId('cable-summary')).toHaveText('Agujero Ø 5 mm con chaflán de 0,5 mm; atraviesa la pared.');

  const a = await aPixel(page, [-15, 30, 2]);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await expect.poll(() => hover(page)).toBe(hostId);
  const before = await st(page);
  await clic(page, [-15, 30, 2]);
  await esperarLibre(page);
  const [first] = await pasos(page);
  expect(first.role).toBe('negative');
  expect(first.addon.boreMm).toBeCloseTo(4, 2);
  expect((await st(page)).past).toBe(before.past + 1);
  expect((await st(page)).selectedIds).toEqual([hostId]);

  await page.getByTestId('cable-shape-slot').click();
  await clic(page, [15, 30, 2]);
  await esperarLibre(page);
  expect(await pasos(page)).toHaveLength(2);
  await page.getByTestId('panel-back').click();
  await expect(page.locator('.kura-cable-panel')).toHaveCount(0);

  const plateVolume = (await st(page)).objects.find((o: any) => o.id === hostId).volume as number;
  await page.evaluate(async () => {
    const x = (window as any).__s.getState();
    x.setSelection([]);
    await x.applyHolesOnSolids();
  });
  await esperarLibre(page);
  const s = await st(page);
  expect(s.objects).toHaveLength(1);
  expect(s.objects[0].manifold).toBe(true);
  // Ø 5 × 4 (≈ 79 mm³) + ranura 8 × 4 × 4 (≈ 114 mm³), más los chaflanes.
  const removed = plateVolume - s.objects[0].volume;
  expect(removed).toBeGreaterThan(190);
  expect(removed).toBeLessThan(260);
  await page.keyboard.press('Control+z');
  expect(await pasos(page)).toHaveLength(2);
});

test('Escape cierra el panel y el clic derecho › Más ofrece el paso de cable', async ({ page }) => {
  await abrir(page);
  await placa(page);
  await vista(page, [30, 40, 110]);
  const c = await aPixel(page, [0, 30, 2]);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /^Más/ }).click();
  await page.getByRole('menuitem', { name: /^Paso de cable/ }).click();
  await expect(page.locator('.kura-cable-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-cable-panel')).toHaveCount(0);
});
