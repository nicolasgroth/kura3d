/**
 * @file e2e/ux6-medir.spec.ts
 * @description Panel de Medir en escritorio: angosto (≤ 232 px), plegable y acoplable a un borde del visor
 * (botón con nombre y tooltip); al abrirlo, plegarlo o moverlo la cámara deja el modelo fuera del área del
 * panel; la pista del clic en el vacío dice «Haz clic…» con ratón y «Toca…» con dedo.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/ux6-medir.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux6';

async function conR3f(page: Page) {
  await page.evaluate(async () => {
    const w = window as any;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
}

/** Rectángulo en pantalla (px de página) de la caja del primer objeto proyectada. */
const rectObjeto = (page: Page) =>
  page.evaluate(async () => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const s = (window as any).__s.getState();
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const c = st.gl.domElement.getBoundingClientRect();
    const b = worldBox(s.objects[0])!;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const v = cam.position.clone().set(x, y, z).project(cam);
      const px = c.left + ((v.x + 1) / 2) * c.width;
      const py = c.top + ((1 - v.y) / 2) * c.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0, y0, x1, y1 };
  });

const solapa = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x0 < b.x + b.width && a.x1 > b.x && a.y0 < b.y + b.height && a.y1 > b.y;

test('Medir: panel angosto y acoplable que no tapa el modelo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await conR3f(page);
  // Pieza grande corrida a la izquierda: con el panel a la izquierda quedaría detrás.
  await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('box', { width: 120, height: 60, depth: 120 }, { placement: 'free' });
  });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('top'));
  await page.waitForTimeout(600);
  await page.keyboard.press('d');
  const panel = page.getByTestId('measure-panel');
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(233);
  await page.waitForTimeout(800);
  expect(solapa(await rectObjeto(page), (await panel.boundingBox())!)).toBe(false);
  await page.screenshot({ path: `${SHOTS}/medir-izquierda-1440.png` });

  const dock = page.getByTestId('measure-dock');
  await expect(dock).toHaveAccessibleName('Mover el panel al borde derecho');
  await expect(dock).toHaveAttribute('title', 'Mover el panel al borde derecho');
  await dock.click();
  await expect(panel).toHaveClass(/is-right/);
  const right = (await panel.boundingBox())!;
  expect(right.x).toBeGreaterThan(1440 / 2);
  await page.waitForTimeout(800);
  expect(solapa(await rectObjeto(page), (await panel.boundingBox())!)).toBe(false);
  await expect(dock).toHaveAccessibleName('Mover el panel al borde izquierdo');
  await page.screenshot({ path: `${SHOTS}/medir-derecha-1440.png` });

  // Plegado: solo la cabecera.
  await panel.getByRole('button', { name: 'Plegar el panel de medición' }).click();
  await expect(panel.locator('button[aria-expanded]')).toHaveAttribute('aria-expanded', 'false');
  expect((await panel.boundingBox())!.height).toBeLessThan(60);
  // El borde elegido se conserva al cerrar y reabrir Medir.
  await page.keyboard.press('d');
  await page.keyboard.press('d');
  await expect(page.getByTestId('measure-panel')).toHaveClass(/is-right/);
});

test('Medir: la pista del vacío depende del puntero (ratón «Haz clic», dedo «Toca»)', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 }, locale: 'es-CL' });
  const page = await ctx.newPage();
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
  const canvas = page.locator('canvas').first();
  const b = (await canvas.boundingBox())!;
  const hint = page.getByTestId('measure-miss-hint');
  await page.mouse.click(b.x + b.width * 0.55, b.y + b.height * 0.2);
  await expect(hint).toHaveText('Haz clic en un punto de la pieza');
  await page.waitForTimeout(1800);
  await page.touchscreen.tap(b.x + b.width * 0.6, b.y + b.height * 0.25);
  await expect(hint).toHaveText('Toca un punto de la pieza');
  await ctx.close();
});
