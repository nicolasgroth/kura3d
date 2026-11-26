/**
 * @file e2e/ux3-forma-encuadre.spec.ts
 * @description Encuadre al crear: la primera primitiva ocupa ~40–50 % del visor (margen generoso), una segunda que ya
 * queda a la vista no mueve la cámara, y con `prefers-reduced-motion` la cámara llega sin transición.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const pose = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__r3f.getState().camera;
    return [c.position.x, c.position.y, c.position.z];
  });

/** Fracción del lienzo que ocupa (en ancho y alto) el cuadro de pantalla de la caja del objeto con ese tamaño. */
const ocupacion = (page: Page, lado: number) =>
  page.evaluate((side) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const r = st.gl.domElement.getBoundingClientRect();
    let res: any = null;
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
      const sz = max.clone().sub(min);
      if (Math.abs(sz.x - side) > 1 || Math.abs(sz.y - side) > 1 || Math.abs(sz.z - side) > 1) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const q = new V(x, y, z).project(cam);
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      res = { w: ((x1 - x0) / 2), h: ((y1 - y0) / 2), cw: r.width, ch: r.height };
    });
    return res as { w: number; h: number; cw: number; ch: number } | null;
  }, lado);

test('la primera primitiva se encuadra con margen generoso (~40–50 % del visor)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 40, height: 40, depth: 40 }, {});
  });
  await page.waitForTimeout(1500);
  const o = (await ocupacion(page, 40))!;
  expect(o).not.toBeNull();
  const frac = Math.max(o.w, o.h);
  expect(frac, `ocupa ${(frac * 100).toFixed(0)} %`).toBeGreaterThan(0.3);
  expect(frac).toBeLessThan(0.62);
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/ux3-forma/encuadre-primera.png' });
  // Una segunda pieza que ya queda a la vista no mueve la cámara.
  const antes = await pose(page);
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 10, height: 10, depth: 10 }, {});
  });
  await page.waitForTimeout(1500);
  (await pose(page)).forEach((v, i) => expect(Math.abs(v - antes[i])).toBeLessThan(0.01));
});

test('con movimiento reducido la cámara llega de inmediato', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await abrir(page, 'es');
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 40, height: 40, depth: 40 }, {});
  });
  await page.waitForTimeout(500);
  const pronto = await pose(page);
  await page.waitForTimeout(1200);
  const tarde = await pose(page);
  tarde.forEach((v, i) => expect(Math.abs(v - pronto[i])).toBeLessThan(0.01));
});
