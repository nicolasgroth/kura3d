/**
 * @file e2e/qa12-helpers.ts
 * @description Utilidades de QA12: abre la web, expone los stores (`__s` Kura, `__m` Medir) y la cámara del visor
 * (`__r3f`, vía el módulo `_roots` de react-three-fiber), proyecta puntos de mundo a píxeles y hace clic real
 * sobre ellos. Convención: malla interna Y-arriba; el usuario ve Z como altura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import type { Page } from '@playwright/test';

export const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5213/';
export const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/qa12';

export async function abrir(page: Page): Promise<void> {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => {
    const w = window as any;
    w.__s = (await import('/src/store/useKuraStore.ts')).useKuraStore;
    w.__m = (await import('/src/store/measureStore.ts')).useMeasureStore;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
}

/** Proyecta un punto de mundo (x,y,z Y-arriba) a coordenadas de página. */
export async function aPixel(page: Page, p: [number, number, number]): Promise<{ x: number; y: number }> {
  return page.evaluate((pt) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const v = new (cam.position.constructor)(pt[0], pt[1], pt[2]).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, p);
}

export async function clicMundo(page: Page, p: [number, number, number], opts: { alt?: boolean; shift?: boolean } = {}): Promise<{ x: number; y: number }> {
  const px = await aPixel(page, p);
  const mods: ('Alt' | 'Shift')[] = [];
  if (opts.alt) mods.push('Alt');
  if (opts.shift) mods.push('Shift');
  await page.mouse.move(px.x - 3, px.y - 3);
  await page.mouse.move(px.x, px.y, { steps: 3 });
  await page.waitForTimeout(80);
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  await page.waitForTimeout(120);
  return px;
}

export async function mover(page: Page, p: [number, number, number], alt = false): Promise<void> {
  const px = await aPixel(page, p);
  await page.mouse.move(px.x - 2, px.y - 2);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.move(px.x, px.y, { steps: 2 });
  await page.waitForTimeout(100);
  if (alt) await page.keyboard.up('Alt');
}

/** Esquinas de la caja de mundo del objeto (Y-arriba). */
export async function cajaMundo(page: Page, id?: string): Promise<{ min: number[]; max: number[] }> {
  return page.evaluate((oid) => {
    const s = (window as any).__s.getState();
    const o = s.objects.find((x: any) => x.id === (oid ?? s.selectedIds[0]));
    const P = o.mesh.positions;
    const E = o.rotation, S = o.scale, T = o.position;
    // Usa la utilidad de Three vía la cámara (misma instancia).
    const V = (window as any).__r3f.getState().camera.position.constructor;
    const Eu = (window as any).__r3f.getState().camera.rotation.constructor;
    const Q = (window as any).__r3f.getState().camera.quaternion.constructor;
    const q = new Q().setFromEuler(new Eu(E[0], E[1], E[2]));
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < P.length; i += 3) {
      const v = new V(P[i] * S[0], P[i + 1] * S[1], P[i + 2] * S[2]).applyQuaternion(q);
      const w = [v.x + T[0], v.y + T[1], v.z + T[2]];
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
    }
    return { min: mn, max: mx };
  }, id);
}

export const medidas = (page: Page) =>
  page.evaluate(() => (window as any).__m.getState().measurements.map((m: any) => ({ kind: m.kind, mm: m.distanceMm, deg: m.deg, area: m.areaMm2, delta: m.deltaUser, regions: m.regions })));
