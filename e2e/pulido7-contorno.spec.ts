/**
 * @file e2e/pulido7-contorno.spec.ts
 * @description El contorno de selección rodea la pieza con un margen fijo en mm de mundo (~0,4 mm por lado), también con la
 * pieza escalada ×100: se compara la caja del contorno con la de la malla en coordenadas de mundo y se pasa a píxeles.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './qa12-helpers';
import { stlCubes, importarStl } from './ux-escena-helpers';

test.use({ viewport: { width: 1280, height: 800 } });

/** Caja de mundo del contorno y de la malla seleccionada, y px por mm en el centro de la pieza. */
async function medir(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const st = (window as any).__r3f.getState();
    st.scene.updateMatrixWorld(true);
    const V = st.camera.position.constructor;
    const caja = (o: any) => {
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const p = new V(x, y, z).applyMatrix4(o.matrixWorld);
        mn[0] = Math.min(mn[0], p.x); mn[1] = Math.min(mn[1], p.y); mn[2] = Math.min(mn[2], p.z);
        mx[0] = Math.max(mx[0], p.x); mx[1] = Math.max(mx[1], p.y); mx[2] = Math.max(mx[2], p.z);
      }
      return { mn, mx };
    };
    let contorno: any = null, malla: any = null;
    st.scene.traverse((o: any) => {
      if (o.isLineSegments && o.geometry?.attributes?.position?.count === 24 && o.parent?.isGroup && o.material?.color?.getHexString?.() === '38bdf8') contorno = o;
      if (o.isMesh && o.castShadow && o.geometry?.attributes?.position?.count > 3 && o.parent?.isGroup && o.parent.scale.x > 0) malla = malla ?? o;
    });
    if (!contorno || !malla) return null;
    const c = caja(contorno), m = caja(malla);
    const centro = new V((m.mn[0] + m.mx[0]) / 2, (m.mn[1] + m.mx[1]) / 2, (m.mn[2] + m.mx[2]) / 2);
    const cam = st.camera;
    const a = centro.clone().project(cam);
    const b = new V(centro.x + 1, centro.y, centro.z).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    const pxPorMm = Math.hypot(((b.x - a.x) / 2) * r.width, ((b.y - a.y) / 2) * r.height);
    return { exceso: [0, 1, 2].map((i) => [m.mn[i] - c.mn[i], c.mx[i] - m.mx[i]]).flat(), pxPorMm };
  });
}

for (const escala of [1, 100]) {
  test(`contorno de selección con la pieza a escala ×${escala}: no sobra más de ~1 px`, async ({ page }) => {
    await abrir(page);
    await importarStl(page, 'cubo.stl', stlCubes([[0, 0, 0]], 0.9));
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(1);
    await page.evaluate((k) => {
      const s = (window as any).__s.getState();
      s.setObjectTransform(s.objects[0].id, { scale: [k, k, k] });
      s.selectObject(s.objects[0].id);
    }, escala);
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
    await page.waitForTimeout(1200);
    const r = await medir(page);
    expect(r, 'contorno y malla encontrados').not.toBeNull();
    const px = r!.exceso.map((mm) => mm * r!.pxPorMm);
    await page.screenshot({ path: `G:/proyectos/kura3d/.eval-tmp/pulido7/contorno-x${escala}.png` });
    // Margen nominal 0,4 mm por lado (mínimo 0,5 mm de caja) y nunca más de 2 px de holgura sobre ello
    for (const mm of r!.exceso) expect(mm, `exceso en mm de mundo (${r!.exceso.map((v) => v.toFixed(3))})`).toBeLessThan(0.45 + 2 / r!.pxPorMm);
    for (const v of px) expect(v).toBeGreaterThan(-0.5);
  });
}
