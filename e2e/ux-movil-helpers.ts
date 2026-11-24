/**
 * @file e2e/ux-movil-helpers.ts
 * @description Utilidades de los specs de UX móvil: abre la web (KURA_URL), expone el store, crea un cubo,
 * proyecta puntos del mundo a píxeles y arrastra con el dedo (eventos táctiles reales por CDP).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import type { Page } from '@playwright/test';
import { enlazarStores } from './store-link';

export const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5218/';
export const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-movil';

export async function abrir(page: Page, lang = 'es'): Promise<void> {
  await page.addInitScript((l) => {
    try {
      if (l) localStorage.setItem('kura3d-language', l);
    } catch { /* sin almacenamiento */ }
  }, lang);
  await page.goto(URL);
  await page.locator('.kura-app').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => /Manifold/i.test(document.body.innerText), undefined, { timeout: 60000 });
  await enlazarStores(page, { medicion: true });
  await page.evaluate(async (l) => {
    const w = window as any;
    if (l) w.__s.getState().setLanguage(l);
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  }, lang);
}

export async function crearCubo(page: Page, lado = 40): Promise<void> {
  await page.evaluate(async (n) => {
    await (window as any).__s.getState().createPrimitive('box', { width: n, height: n, depth: n }, {});
  }, lado);
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
}

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

/** Arrastre con un dedo (eventos táctiles reales). */
export async function arrastreTactil(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pasos = 12,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const punto = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(from.x, from.y) });
  for (let i = 1; i <= pasos; i += 1) {
    const f = i / pasos;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: punto(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f),
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

export const rect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, selector);
