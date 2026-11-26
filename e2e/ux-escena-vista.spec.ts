/**
 * @file e2e/ux-escena-vista.spec.ts
 * @description Vista e inspector: con un cubo de 440 mm, Iso (tecla 3), Sup y Frente dejan la cámara fuera
 * del objeto y lo encuadran; el inspector vuelve arriba al cambiar de objeto y no al reseleccionar el
 * mismo; arrastrar el gizmo muestra la lectura ΔX/ΔY/ΔZ. Ejecuta con `npm run test:e2e`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';

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

/** true si la cámara está fuera de la caja del objeto y sus 8 esquinas caen dentro del lienzo. */
const encuadrado = (page: Page) =>
  page.evaluate(async () => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const s = (window as any).__s.getState();
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const b = worldBox(s.objects[0])!;
    const p = cam.position;
    const inside = p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z;
    let visible = true;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      const v = p.clone().set(x, y, z).project(cam);
      if (Math.abs(v.x) > 1.001 || Math.abs(v.y) > 1.001 || v.z > 1) visible = false;
    }
    return !inside && visible && cam.far > p.length();
  });

test('vistas con un cubo de 440 mm: la cámara queda fuera y el cubo entero a la vista', async ({ page }) => {
  await abrir(page);
  await conR3f(page);
  await page.evaluate(() => (window as any).__s.getState().createPrimitive('box', { width: 440, height: 440, depth: 440 }, { placement: 'free' }));
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Cada vista (los mismos pedidos que hacen los botones Iso/Sup/Frente/Der de la barra del visor).
  for (const preset of ['iso', 'top', 'front', 'right']) {
    await page.evaluate((p) => (window as any).__s.getState().requestCameraPreset(p), preset);
    await expect.poll(() => encuadrado(page), { timeout: 5000 }).toBe(true);
  }
  await page.keyboard.press('3');
  await expect.poll(() => encuadrado(page), { timeout: 5000 }).toBe(true);
});

test('inspector: vuelve arriba al cambiar de objeto, no al reseleccionar el mismo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await abrir(page);
  await agregarForma(page, 'Cubo');
  await agregarForma(page, 'Cilindro');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(2);
  const area = page.locator('#kura-inspector-panel .kura-scroll-area');
  const scroll = (top?: number) => area.evaluate((el, t) => { if (t !== undefined) el.scrollTop = t; return el.scrollTop; }, top);
  await scroll(400);
  expect(await scroll()).toBeGreaterThan(100);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.selectObject(s.selectedIds[0]); });
  expect(await scroll()).toBeGreaterThan(100);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.selectObject(s.objects[0].id); });
  await expect.poll(() => scroll()).toBe(0);
  await expect(page.locator('#kura-inspector-panel').getByLabel('Nombre').first()).toBeInViewport();
});

test('arrastrar el gizmo muestra ΔX/ΔY/ΔZ junto al cursor', async ({ page }) => {
  await abrir(page);
  await conR3f(page);
  await agregarForma(page, 'Cubo');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  // Empieza el arrastre por el store del gizmo (el mismo que usa TransformControls al pulsar).
  await page.evaluate(async () => {
    const { useGizmoDragStore } = await import('/src/store/gizmoDragStore.ts');
    useGizmoDragStore.getState().begin();
    const s = (window as any).__s.getState();
    const o = s.objects[0];
    s.setObjectTransform(o.id, { position: [o.position[0] + 12, o.position[1] + 5, o.position[2] - 8] });
  });
  const readout = page.getByTestId('gizmo-drag-readout');
  await expect(readout).toHaveText('ΔX +12 · ΔY +8 · ΔZ +5 mm');
  await page.evaluate(async () => {
    const { useGizmoDragStore } = await import('/src/store/gizmoDragStore.ts');
    useGizmoDragStore.getState().end();
    (window as any).__s.getState().commitTransformSnapshot();
  });
  await expect(readout).toHaveCount(0);
});
