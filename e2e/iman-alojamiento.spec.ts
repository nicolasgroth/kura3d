/**
 * @file e2e/iman-alojamiento.spec.ts
 * @description Alojamiento de imán con ratón real: abrir desde Insertar, colocar en la cara superior y en una lateral
 * (vista previa al pasar el cursor), un arrastre que orbita no coloca, deshacer en un paso, aplicar restas y medir el
 * volumen removido; sin pieza sólida avisa; un preajuste propio sobrevive a recargar la página y se puede eliminar.
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
    objects: s.objects.map((o: any) => ({ id: o.id, name: o.name, role: o.role, addon: o.metadata?.addon ?? null, volume: o.stats.volumeMm3, manifold: o.stats.isManifold })),
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

/** Espera a que el visor dibuje `n` cuadros (el ratón y la cámara se asientan sin un tiempo fijo). */
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

async function abrirPanel(page: Page) {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toBeVisible();
}

async function clic(page: Page, p: P3) {
  const a = await aPixel(page, p);
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.mouse.down();
  await page.mouse.up();
}

/** Pieza bajo el cursor según el panel (la vista previa se dibuja ahí). */
const hover = (page: Page) => page.evaluate(async () => {
  const { useMagnetPanel } = await import('/src/store/magnetPanel.ts');
  return useMagnetPanel.getState().hover?.hostId ?? null;
});

const esperarLibre = (page: Page) => expect.poll(async () => (await st(page)).busy, { timeout: 15_000 }).toBeNull();

test('colocar en cara superior y lateral, orbitar no coloca, deshacer y aplicar restas', async ({ page }) => {
  await abrir(page);
  // Sin pieza sólida: avisa y no abre.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  await expect(page.getByText(/necesitas al menos una pieza sólida/)).toBeVisible();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);

  const host = await cubo(page);
  await vista(page, [70, 80, 90]);
  await abrirPanel(page);
  await expect(page.getByTestId('magnet-summary')).toHaveText('Hueco: Ø 5,2 × 2,2 mm');

  // Vista previa al pasar el cursor por la cara superior.
  const top = await aPixel(page, [0, 30, 0]);
  await page.mouse.move(top.x - 6, top.y - 6);
  await page.mouse.move(top.x, top.y, { steps: 4 });
  await expect.poll(() => hover(page)).toBe(host);
  await expect(page.locator('canvas').first()).toHaveCSS('cursor', 'crosshair');
  const before = (await st(page)).past;

  // Un arrastre (orbitar) sobre la pieza no coloca.
  await page.mouse.down();
  await page.mouse.move(top.x + 60, top.y + 20, { steps: 8 });
  await page.mouse.up();
  await cuadros(page);
  await esperarLibre(page);
  expect((await st(page)).objects).toHaveLength(1);
  await vista(page, [70, 80, 90]);

  // Clic en la cara superior: un negativo «Imán 5 × 2» con metadatos.
  await clic(page, [0, 30, 0]);
  await esperarLibre(page);
  await expect.poll(async () => (await st(page)).objects.length).toBe(2);
  let s = await st(page);
  const neg = s.objects.find((o: any) => o.role === 'negative');
  expect(neg.name).toBe('Imán 5 × 2');
  expect(neg.addon).toMatchObject({ kind: 'magnet_pocket', hostId: host, params: { shape: 'round', sizeMm: 5, heightMm: 2 } });
  expect(s.past).toBe(before + 1);
  await expect(page.getByTestId('magnet-wall')).toContainText('pared mínima');

  // Clic en la cara lateral +X (vista desde el costado).
  await vista(page, [120, 25, 10]);
  await clic(page, [15, 15, 3]);
  await esperarLibre(page);
  await expect.poll(async () => (await st(page)).objects.length).toBe(3);
  s = await st(page);
  expect(s.past).toBe(before + 2);

  // Deshacer quita solo el último.
  await page.keyboard.press('Escape');
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);
  await page.locator('canvas').first().click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await st(page)).objects.length).toBe(2);
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await st(page)).objects.length).toBe(3);

  // Aplicar restas: el cubo queda cerrado y pierde dos huecos (5,2 × 2,2 cada uno, polígono de 64 lados).
  const vol0 = (await st(page)).objects.find((o: any) => o.id === host).volume;
  await page.evaluate(async () => {
    const x = (window as any).__s.getState();
    x.setSelection([]);
    await x.applyHolesOnSolids();
  });
  await esperarLibre(page);
  s = await st(page);
  expect(s.objects.filter((o: any) => o.role === 'negative')).toHaveLength(0);
  const after = s.objects.find((o: any) => o.id === host);
  expect(after.manifold).toBe(true);
  const hole = 64 * 2.6 * 2.6 * Math.tan(Math.PI / 64) * 2.2;
  const removed = vol0 - after.volume;
  expect(Math.abs(removed - 2 * hole) / (2 * hole)).toBeLessThan(0.01);
});

test('preajuste propio sobrevive a recargar y se elimina', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => localStorage.removeItem('kura3d-presets-magnet'));
  await cubo(page);
  await abrirPanel(page);
  await page.getByTestId('magnet-shape-square').click();
  const lado = page.getByLabel('Lado del imán (mm)');
  await lado.fill('6,5');
  await lado.press('Tab');
  await expect(page.getByTestId('magnet-summary')).toHaveText('Hueco: 6,7 × 6,7 × 2,2 mm');
  await page.getByTestId('magnet-preset-name').fill('Cuadrado tapa');
  await page.getByTestId('magnet-preset-save').click();
  await expect(page.getByTestId('magnet-preset')).toHaveValue(/^user-/);

  await page.reload();
  await abrir(page);
  await cubo(page);
  await abrirPanel(page);
  const opt = page.getByTestId('magnet-preset').locator('option', { hasText: 'Cuadrado tapa' });
  await expect(opt).toHaveCount(1);
  await page.getByTestId('magnet-preset').selectOption({ label: 'Cuadrado tapa' });
  await expect(page.getByTestId('magnet-summary')).toHaveText('Hueco: 6,7 × 6,7 × 2,2 mm');
  await page.getByTestId('magnet-preset-delete').click();
  await expect(opt).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('kura3d-presets-magnet'))).toBeNull();
});
