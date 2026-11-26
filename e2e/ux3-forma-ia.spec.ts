/**
 * @file e2e/ux3-forma-ia.spec.ts
 * @description Panel de IA en escritorio (1440 px, tema claro y oscuro): al abrirlo no cubre el inspector ni los
 * controles del visor y la cámara no se mueve; si el objeto seleccionado queda tapado, el encuadre lo recupera.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

const pose = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__r3f.getState().camera;
    return [c.position.x, c.position.y, c.position.z];
  });

const solapa = (a: DOMRect | { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;


/** Desplaza la vista para que el objeto quede a la derecha (k>0) o a la izquierda (k<0) del lienzo. */
const desplazar = (page: Page, k: number) =>
  page.evaluate((f) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    const ctl = st.controls;
    cam.updateMatrixWorld();
    const V = cam.position.constructor;
    const right = new V().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    const d = cam.position.distanceTo(ctl.target);
    const wx = d * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
    const shift = right.multiplyScalar(-f * wx);
    cam.position.add(shift);
    ctl.target.add(shift);
    ctl.update();
  }, k);

for (const esquema of ['light', 'dark'] as const) {
  test(`el panel de IA no cubre controles ni inspector y no mueve la cámara (${esquema})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: esquema });
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await abrir(page, 'es');
    await page.evaluate(async () => {
      await (window as any).__s.getState().createPrimitive('box', { width: 40, height: 40, depth: 40 }, {});
    });
    await page.waitForTimeout(1200);
    // El objeto queda en la mitad izquierda del lienzo: el panel no lo tapa y la cámara no debe moverse.
    await desplazar(page, -0.45);
    await page.waitForTimeout(400);
    const antes = await pose(page);
    const canvasAntes = await page.evaluate(() => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return [r.width, r.height];
    });
    await page.screenshot({ path: `${SHOTS}/ia-cerrado-${esquema}.png` });

    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
    await page.waitForTimeout(1500);
    const drawer = page.getByRole('complementary', { name: /Asistente IA/ });
    await expect(drawer).toBeVisible();
    const d = (await drawer.boundingBox())!;
    // No cubre el inspector ni ningún control del visor ni el cubo de vistas.
    const inspector = (await page.locator('.kura-sidebar-right').boundingBox())!;
    expect(inspector.width).toBeGreaterThan(100);
    expect(solapa(d, inspector), 'el panel cubre el inspector').toBe(false);
    const controles = await page.evaluate(() => {
      const out: Array<{ n: string; x: number; y: number; width: number; height: number }> = [];
      document.querySelectorAll('.kura-hud-top-bar button, .kura-hud-top-bar select, .kura-hud-bottom button, .kura-protip-wrap button, .kura-sidebar-right button').forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push({ n: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), x: r.x, y: r.y, width: r.width, height: r.height });
      });
      return out;
    });
    expect(controles.length).toBeGreaterThan(5);
    const tapados = controles.filter((c) => solapa(d, c)).map((c) => c.n);
    expect(tapados, `controles tapados: ${tapados.join(', ')}`).toEqual([]);
    const botonMover = page.getByRole('button', { name: /Mover/ }).first();
    if (await botonMover.count()) expect(solapa(d, (await botonMover.boundingBox())!)).toBe(false);
    // El cubo de vistas (esquina superior derecha del lienzo) queda libre: el panel empieza bajo él.
    const lienzo = (await page.locator('canvas').boundingBox())!;
    expect(d.y).toBeGreaterThanOrEqual(lienzo.y + 140);
    // El lienzo conserva su tamaño y la cámara no se mueve al abrir ni al cerrar.
    const canvasAbierto = await page.evaluate(() => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return [r.width, r.height];
    });
    expect(canvasAbierto).toEqual(canvasAntes);
    const abierto = await pose(page);
    abierto.forEach((v, i) => expect(Math.abs(v - antes[i])).toBeLessThan(0.01));
    await page.screenshot({ path: `${SHOTS}/ia-abierto-${esquema}.png` });
    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(false));
    await page.waitForTimeout(800);
    (await pose(page)).forEach((v, i) => expect(Math.abs(v - antes[i])).toBeLessThan(0.01));
    expect(errs).toEqual([]);
  });
}

test('si el objeto seleccionado queda bajo el panel de IA, el encuadre lo recupera', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 40, height: 40, depth: 40 }, {});
  });
  await page.waitForTimeout(1200);
  await desplazar(page, 0.8);
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
  await page.waitForTimeout(1800);
  const drawer = (await page.getByRole('complementary', { name: /Asistente IA/ }).boundingBox())!;
  const px = await page.evaluate(() => {
    const st = (window as any).__r3f.getState();
    const o = (window as any).__s.getState().objects[0];
    const V = st.camera.position.constructor;
    // Centro de la malla en la escena: se lee de la caja del mayor mesh del tamaño del cubo.
    let c: any = null;
    st.scene.traverse((n: any) => {
      if (!n.isMesh || !n.geometry?.boundingBox && !n.geometry?.computeBoundingBox) return;
      n.geometry.computeBoundingBox();
      const s = n.geometry.boundingBox.getSize(new V());
      if (s.x > 35 && s.x < 45 && s.y > 35 && s.y < 45) c = n.localToWorld(n.geometry.boundingBox.getCenter(new V()));
    });
    if (!c || !o) return null;
    const q = c.clone().project(st.camera);
    const r = st.gl.domElement.getBoundingClientRect();
    return r.left + ((q.x + 1) / 2) * r.width;
  });
  expect(px).not.toBeNull();
  expect(px as number).toBeLessThan(drawer.x);
});
