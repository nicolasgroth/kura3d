/**
 * @file e2e/ux3-forma-tactil.spec.ts
 * @description Medir con el dedo a 390 px: el botón Medir está en la barra compacta junto a Mover/Rotar/Escalar, la
 * ayuda no menciona clic derecho ni teclas y ofrece «Cancelar punto», el visor queda estable tras activar Medir y el
 * primer toque cercano a una esquina (hasta ~24 px) se pega al vértice.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crearCubo } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('Medir con el dedo: botón en la barra, ayuda táctil, visor estable e imán al vértice', async ({ page }) => {
  test.setTimeout(240000);
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await abrir(page, 'es');
  await crearCubo(page, 40);
  await page.screenshot({ path: `${SHOTS}/tactil-1-barra.png` });

  const barra = page.getByRole('toolbar', { name: 'Transformar el objeto' });
  const medir = barra.getByRole('button', { name: 'Medir' });
  await expect(medir).toBeVisible();
  const caja = (await medir.boundingBox())!;
  expect(caja.width).toBeGreaterThanOrEqual(44);
  expect(caja.height).toBeGreaterThanOrEqual(44);

  const altoVisor = () => page.evaluate(() => document.querySelector('canvas')!.getBoundingClientRect().height);
  await medir.tap();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('measure');
  // El visor se estabiliza enseguida y no vuelve a cambiar de altura.
  const serie: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    serie.push(await altoVisor());
    await page.waitForTimeout(100);
  }
  expect(new Set(serie.slice(5)).size, `alturas: ${serie.join(',')}`).toBe(1);
  const alto0 = await altoVisor();

  // La ayuda es táctil: sin clic derecho ni teclas; el botón de cancelar aparece con un punto pendiente.
  const panel = page.getByTestId('measure-panel');
  const ayuda = await panel.innerText();
  expect(ayuda).not.toMatch(/clic derecho|Esc\b|Alt\b|Mayús/i);
  expect(ayuda).toMatch(/Toca el primer punto/);

  // Esquina más cercana a la cámara y centro del cubo en pantalla.
  const info = await page.evaluate(() => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    let mejor: any = null;
    st.scene.traverse((n: any) => {
      if (!n.isMesh || !n.geometry?.attributes?.position || n.geometry.attributes.position.count < 8) return;
      const V = n.position.constructor;
      const min = new V(Infinity, Infinity, Infinity);
      const max = new V(-Infinity, -Infinity, -Infinity);
      const v = new V();
      const pos = n.geometry.attributes.position;
      n.updateWorldMatrix(true, false);
      for (let k = 0; k < pos.count; k += 1) {
        v.fromBufferAttribute(pos, k).applyMatrix4(n.matrixWorld);
        min.min(v);
        max.max(v);
      }
      const vol = (max.x - min.x) * (max.y - min.y) * (max.z - min.z);
      if (vol > 50000 && vol < 80000 && (!mejor || vol > mejor.vol)) mejor = { vol, min, max, V };
    });
    const { min, max, V } = mejor;
    const esquinas: any[] = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) esquinas.push(new V(x, y, z));
    esquinas.sort((a, b) => a.distanceTo(cam.position) - b.distanceTo(cam.position));
    const r = st.gl.domElement.getBoundingClientRect();
    const px = (p: any) => {
      const q = p.clone().project(cam);
      return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height };
    };
    const centro = new V((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    const e = esquinas[0];
    return { corner: [e.x, e.y, e.z], cornerPx: px(e), centerPx: px(centro) };
  });
  const dx = info.centerPx.x - info.cornerPx.x;
  const dy = info.centerPx.y - info.cornerPx.y;
  const norma = Math.hypot(dx, dy) || 1;
  // Toque a ~18 px de la esquina hacia dentro del cubo (dentro del imán táctil de 24 px, fuera del de ratón de 14 px).
  const toque = { x: info.cornerPx.x + (dx / norma) * 18, y: info.cornerPx.y + (dy / norma) * 18 };
  await page.touchscreen.tap(toque.x, toque.y);
  await page.waitForTimeout(500);
  const pendiente = await page.evaluate(() => (window as any).__m.getState().pending.map((p: any) => p.point));
  expect(pendiente.length).toBe(1);
  const d = Math.hypot(pendiente[0][0] - info.corner[0], pendiente[0][1] - info.corner[1], pendiente[0][2] - info.corner[2]);
  expect(d, `distancia al vértice ${d.toFixed(2)} mm`).toBeLessThan(1);
  expect(await altoVisor()).toBe(alto0);

  await expect(panel.getByRole('button', { name: 'Cancelar punto' })).toBeVisible();
  expect(await panel.innerText()).not.toMatch(/clic derecho|Esc\b/i);
  await page.screenshot({ path: `${SHOTS}/tactil-2-punto.png` });
  await panel.getByRole('button', { name: 'Cancelar punto' }).tap();
  expect(await page.evaluate(() => (window as any).__m.getState().pending.length)).toBe(0);
  expect(errs).toEqual([]);
});
