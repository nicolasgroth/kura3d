/**
 * @file e2e/ux7-helpers.ts
 * @description Utilidades de los specs `ux7-*`: encuadre real de la cámara sobre unos objetos (fracción del
 * lienzo que ocupan, cámara fuera de su caja, plano cercano por delante) y capturas en `.eval-tmp/ux7`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import type { Page } from '@playwright/test';

export const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux7';

/** Expone el store de react-three-fiber en `window.__r3f` (cámara y lienzo). */
export async function exponerR3f(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as any;
    if (w.__r3f) return;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
}

export interface Encuadre {
  /** Fracción del lienzo (0–1) que ocupa la caja en su lado mayor de pantalla. */
  frac: number;
  /** Centro de la caja en coordenadas normalizadas (−1…1). */
  cx: number;
  cy: number;
  /** La cámara está dentro de la caja de los objetos. */
  inside: boolean;
  /** Todas las esquinas quedan delante de la cámara y dentro del lienzo. */
  inView: boolean;
  near: number;
  distance: number;
}

/** Encuadre de la cámara sobre los objetos `ids` (o todos). */
export function encuadre(page: Page, ids?: string[]): Promise<Encuadre> {
  return page.evaluate(async (wanted) => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const objs = (window as any).__s.getState().objects.filter((o: any) => !wanted || wanted.includes(o.id));
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    for (const o of objs) {
      const b = worldBox(o);
      if (!b) continue;
      min = min.map((v, i) => Math.min(v, b.min.toArray()[i]));
      max = max.map((v, i) => Math.max(v, b.max.toArray()[i]));
    }
    const V = cam.position.constructor;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    let inView = true;
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const p = new V(x, y, z);
      const local = p.clone().applyMatrix4(cam.matrixWorldInverse);
      if (local.z > -cam.near) inView = false;
      const q = p.project(cam);
      if (Math.abs(q.x) > 1 || Math.abs(q.y) > 1) inView = false;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const c = cam.position;
    const inside = c.x >= min[0] && c.x <= max[0] && c.y >= min[1] && c.y <= max[1] && c.z >= min[2] && c.z <= max[2];
    const center = new V((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return {
      frac: Math.max((x1 - x0) / 2, (y1 - y0) / 2),
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2,
      inside,
      inView,
      near: cam.near,
      distance: c.distanceTo(center),
    };
  }, ids ?? null);
}

/** Espera a que la cámara termine su transición (dos lecturas iguales). */
export async function camaraQuieta(page: Page): Promise<void> {
  let last = '';
  for (let i = 0; i < 30; i += 1) {
    const now = await page.evaluate(() => {
      const c = (window as any).__r3f.getState().camera.position;
      return `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)}`;
    });
    if (now === last) return;
    last = now;
    await page.waitForTimeout(200);
  }
}
