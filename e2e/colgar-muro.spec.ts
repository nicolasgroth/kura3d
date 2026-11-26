/**
 * @file e2e/colgar-muro.spec.ts
 * @description Ojo de cerradura con ratón real: abrir desde Insertar, vista previa al pasar el cursor por la cara
 * posterior de una placa, colocar dos a la misma altura (la selección no cambia, un paso de deshacer cada uno),
 * aviso de altura distinta con un tercero, aplicar restas (un solo objeto cerrado con menos volumen) y deshacer;
 * Escape cierra y el clic derecho › Más lo ofrece. Escrito sin ejecutar en este lote; lo corre el orquestador.
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
    toasts: s.toasts.map((x: any) => x.text) as string[],
  };
});

async function placa(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const s = () => (window as any).__s.getState();
    const o = await s().createPrimitive('box', { width: 60, height: 60, depth: 10 }, { position: [0, 0, 0] });
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
  const { useKeyholePanel } = await import('/src/store/keyholePanel.ts');
  return useKeyholePanel.getState().hover?.hostId ?? null;
});

const esperarLibre = (page: Page) => expect.poll(async () => (await st(page)).busy, { timeout: 15_000 }).toBeNull();
const ojos = async (page: Page) => (await st(page)).objects.filter((o: any) => o.addon?.kind === 'keyhole');

test('dos ojos a la misma altura, aviso de altura, aplicar restas y deshacer', async ({ page }) => {
  await abrir(page);
  const hostId = await placa(page);
  await page.evaluate((id) => (window as any).__s.getState().setSelection([id]), hostId);
  await vista(page, [30, 40, 110]);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Colgar en el muro/ }).click();
  await expect(page.locator('.kura-keyhole-panel')).toBeVisible();
  await expect(page.getByTestId('keyhole-summary')).toContainText('Entrada Ø 8,5 mm');

  const a = await aPixel(page, [-18, 30, 5]);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await expect.poll(() => hover(page)).toBe(hostId);
  const before = await st(page);
  await clic(page, [-18, 30, 5]);
  await esperarLibre(page);
  expect((await ojos(page)).map((o: any) => o.role)).toEqual(['negative']);
  expect((await st(page)).past).toBe(before.past + 1);
  expect((await st(page)).selectedIds).toEqual([hostId]);
  await clic(page, [18, 30, 5]);
  await esperarLibre(page);
  expect(await ojos(page)).toHaveLength(2);

  // Un tercero bastante más arriba avisa que la pieza colgaría torcida.
  await clic(page, [0, 45, 5]);
  await esperarLibre(page);
  await expect(page.getByTestId('keyhole-warn-level')).toBeVisible();
  await page.keyboard.press('Control+z');
  expect(await ojos(page)).toHaveLength(2);
  await page.getByTestId('panel-back').click();
  await expect(page.locator('.kura-keyhole-panel')).toHaveCount(0);

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
  // Cada ojo quita al menos la cámara (8,5 × 10 × 3 ≈ 255 mm³) y menos que su caja envolvente.
  const removed = plateVolume - s.objects[0].volume;
  expect(removed).toBeGreaterThan(2 * 255);
  expect(removed).toBeLessThan(2 * 8.5 * 18.5 * 4.5);
  await page.keyboard.press('Control+z');
  expect(await ojos(page)).toHaveLength(2);
});

test('Escape cierra el panel y el clic derecho › Más ofrece colgar en el muro', async ({ page }) => {
  await abrir(page);
  await placa(page);
  await vista(page, [30, 40, 110]);
  const c = await aPixel(page, [0, 30, 5]);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /^Más/ }).click();
  await page.getByRole('menuitem', { name: /^Colgar en el muro/ }).click();
  await expect(page.locator('.kura-keyhole-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-keyhole-panel')).toHaveCount(0);
});
