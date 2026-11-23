/**
 * @file e2e/ux-movil-recorrido.spec.ts
 * @description Recorrido completo a 390 px con pantalla táctil: crear un cubo desde Formas, moverlo con el
 * manipulador (arrastre táctil), escalarlo por el inspector, medir dos puntos y exportar STL (descarga
 * recibida). Falla si algún paso no se puede completar con el dedo. Capturas en .eval-tmp/ux-movil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, aPixel, arrastreTactil, SHOTS } from './ux-movil-helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('crear cubo, mover con el manipulador, escalar, medir y exportar STL a 390 px', async ({ page }) => {
  test.setTimeout(300000);
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await abrir(page);
  const store = <T,>(path: string) =>
    page.evaluate((p) => p.split(/[.[\]]+/).filter(Boolean).reduce((o: any, k) => o?.[k], (window as any).__s.getState()), path) as Promise<T>;

  // 1. Crear un cubo desde la hoja Formas.
  await page.getByRole('button', { name: 'Formas', exact: true }).tap();
  await page.locator('#kura-shapes-panel, .kura-sidebar-left').getByRole('button', { name: 'Cubo', exact: true }).first().tap();
  await expect.poll(() => store<number>('objects.length')).toBe(1);
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/recorrido-1-cubo.png` });

  // 2. Mover con el manipulador: arrastre táctil sobre la flecha del eje X.
  await page.getByRole('toolbar', { name: 'Transformar el objeto' }).getByRole('button', { name: /Mover/ }).tap();
  const pos0 = await store<number[]>('objects[0].position');
  const o = await aPixel(page, pos0 as [number, number, number]);
  const ex = await aPixel(page, [pos0[0] + 10, pos0[1], pos0[2]]);
  const len = Math.hypot(ex.x - o.x, ex.y - o.y) || 1;
  const dir = { x: (ex.x - o.x) / len, y: (ex.y - o.y) / len };
  const start = { x: o.x + dir.x * 20, y: o.y + dir.y * 20 };
  await arrastreTactil(page, start, { x: start.x + dir.x * 60, y: start.y + dir.y * 60 });
  await page.waitForTimeout(400);
  const pos1 = await store<number[]>('objects[0].position');
  expect(Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1], pos1[2] - pos0[2])).toBeGreaterThan(0.5);
  await page.screenshot({ path: `${SHOTS}/recorrido-2-movido.png` });

  // 3. Escalar por el inspector.
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  const campoX = page.locator('#kura-precision-scale input').first();
  await campoX.scrollIntoViewIfNeeded();
  await campoX.tap();
  await campoX.fill('2');
  await campoX.press('Enter');
  await expect.poll(() => store<number>('objects[0].scale[0]')).toBeCloseTo(2, 1);
  await page.screenshot({ path: `${SHOTS}/recorrido-3-escalado.png` });

  // 4. Medir dos puntos (Medir está en "Más" en pantallas estrechas).
  await page.getByRole('button', { name: 'Más', exact: true }).tap();
  await page.getByRole('menuitemradio', { name: /Medir/ }).tap();
  await expect.poll(() => store<string>('activeTool')).toBe('measure');
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
  // Dos puntos sobre la cara superior visible del cubo, tomados de su caja real en la escena 3D (el eje
  // vertical de la escena no es el del store: se lee de la geometría, no se supone).
  const caja = await page.evaluate(() => {
    const st = (window as any).__r3f.getState();
    let mejor: any = null;
    st.scene.traverse((n: any) => {
      if (!n.isMesh || !n.geometry?.attributes?.position || n.geometry.attributes.position.count < 8) return;
      const THREE = n.position.constructor;
      const min = new THREE(Infinity, Infinity, Infinity);
      const max = new THREE(-Infinity, -Infinity, -Infinity);
      const v = new THREE();
      const pos = n.geometry.attributes.position;
      n.updateWorldMatrix(true, false);
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(n.matrixWorld);
        min.min(v);
        max.max(v);
      }
      const vol = (max.x - min.x) * (max.y - min.y) * (max.z - min.z);
      if (vol > 1000 && (!mejor || vol > mejor.vol)) mejor = { vol, min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] };
    });
    return mejor as { min: number[]; max: number[] };
  });
  const c = [0, 1, 2].map((k) => (caja.min[k] + caja.max[k]) / 2);
  const d = [0, 1, 2].map((k) => (caja.max[k] - caja.min[k]) * 0.25);
  const a = await aPixel(page, [c[0] - d[0], caja.max[1], c[2]] as [number, number, number]);
  const b = await aPixel(page, [c[0] + d[0], caja.max[1], c[2]] as [number, number, number]);
  const altoVisor = () => page.evaluate(() => document.querySelector('canvas')!.getBoundingClientRect().height);
  const alto0 = await altoVisor();
  await page.touchscreen.tap(a.x, a.y);
  await page.waitForTimeout(400);
  // Con un punto pendiente la hoja de Medir no se pliega: el visor conserva su tamaño entre los dos toques.
  expect(await page.evaluate(() => (window as any).__m.getState().pending.length)).toBe(1);
  expect(await altoVisor()).toBe(alto0);
  await page.touchscreen.tap(b.x, b.y);
  await page.waitForTimeout(500);
  const medidas = await page.evaluate(() => (window as any).__m.getState().measurements?.length ?? 0);
  expect(medidas).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: `${SHOTS}/recorrido-4-medido.png` });

  // 5. Exportar STL desde el acceso directo de la barra principal.
  await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().tap();
  const dialogo = page.getByRole('dialog').last();
  await expect(dialogo).toBeVisible();
  const stl = dialogo.getByRole('radio', { name: /STL/ });
  if (await stl.count()) await stl.first().check();
  await page.screenshot({ path: `${SHOTS}/recorrido-5-exportar.png` });
  const descarga = page.waitForEvent('download', { timeout: 30000 });
  await dialogo.locator('button[type="submit"]').tap();
  const archivo = await descarga;
  expect(archivo.suggestedFilename().toLowerCase()).toMatch(/\.stl$/);
  expect(errs).toEqual([]);
});
