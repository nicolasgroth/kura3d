/**
 * @file e2e/qa8-pintura.spec.ts
 * @description QA8: el pincel no atraviesa una placa delgada (cara trasera sin pintar), ahuecar una esfera de 100 mm con
 * pared 2 deja la pared entre 1,95 y 2,1 mm. Usa el store del servidor de desarrollo (import dinámico de /src).
 * Requiere `@playwright/test` y la web en KURA_URL (por defecto http://127.0.0.1:5198).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5198/';

function stl(tris: number[][][]): Buffer {
  const buf = Buffer.alloc(84 + 50 * tris.length);
  buf.writeUInt32LE(tris.length, 80);
  tris.forEach((t, k) => { let o = 84 + 50 * k + 12; t.forEach((v) => v.forEach((c) => { buf.writeFloatLE(c, o); o += 4; })); });
  return buf;
}

function plate(W: number, D: number, T: number, n: number): Buffer {
  const tris: number[][][] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => { tris.push([a, b, c], [a, c, d]); };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = (W * i) / n, x1 = (W * (i + 1)) / n, y0 = (D * j) / n, y1 = (D * (j + 1)) / n;
    quad([x0, y0, T], [x1, y0, T], [x1, y1, T], [x0, y1, T]);
    quad([x0, y0, 0], [x0, y1, 0], [x1, y1, 0], [x1, y0, 0]);
  }
  quad([0, 0, 0], [W, 0, 0], [W, 0, T], [0, 0, T]); quad([W, 0, 0], [W, D, 0], [W, D, T], [W, 0, T]);
  quad([W, D, 0], [0, D, 0], [0, D, T], [W, D, T]); quad([0, D, 0], [0, 0, 0], [0, 0, T], [0, D, T]);
  return stl(tris);
}

function sphere(R: number, nu: number, nv: number): Buffer {
  const tris: number[][][] = [];
  const P = (i: number, j: number) => { const th = (Math.PI * i) / nv, ph = (2 * Math.PI * j) / nu; return [R * Math.sin(th) * Math.cos(ph), R * Math.sin(th) * Math.sin(ph), R * Math.cos(th) + R]; };
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    if (i !== 0) tris.push([a, b, d]);
    if (i !== nv - 1) tris.push([b, c, d]);
  }
  return stl(tris);
}

async function abrir(page: Page, name: string, buf: Buffer) {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as unknown as { __s: unknown }).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await page.evaluate(async ({ n, b64 }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], n));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { n: name, b64: buf.toString('base64') });
  await page.waitForFunction(() => (window as any).__s.getState().objects.length === 1, null, { timeout: 60000 });
}

test('el pincel no pinta la cara trasera de una placa de 1 mm', async ({ page }) => {
  // Nota: el motor es Y-up (la altura STL Z queda en Y de la malla local).
  await abrir(page, 'placa.stl', plate(60, 60, 1, 60));
  await page.getByRole('button', { name: 'Vista superior', exact: true }).filter({ hasText: /^Sup$/ }).click();
  await page.getByRole('button', { name: 'Pintar', exact: true }).first().click();
  await page.waitForTimeout(800);
  // El punto del trazo se calcula sobre la placa real (centro de su cara superior), no con coordenadas fijas:
  // el encuadre puede cambiar y un punto fijo de pantalla deja de caer sobre la pieza.
  const punto = await page.evaluate(async () => {
    const w = window as any;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    let st: any = null;
    for (const u of urls) { const m = await import(/* @vite-ignore */ u); if (m._roots) st = [...m._roots.values()][0].store.getState(); }
    const o = w.__s.getState().objects[0]; const P = o.mesh.positions as number[];
    let maxY = -1e9; for (let i = 1; i < P.length; i += 3) maxY = Math.max(maxY, P[i]);
    const cam = st.camera; cam.updateMatrixWorld();
    const v = new (cam.position.constructor)(o.position[0], o.position[1] + maxY * o.scale[1], o.position[2]).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [punto.x, punto.y])).toBe('CANVAS');
  await page.mouse.move(punto.x - 2, punto.y); await page.mouse.down(); await page.mouse.move(punto.x + 2, punto.y, { steps: 3 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const { bottom, painted } = await page.evaluate(() => {
    const o = (window as any).__s.getState().objects[0]; const fc: string[] = o.mesh.faceColors ?? [];
    const base = o.color.toLowerCase(); const P = o.mesh.positions, I = o.mesh.indices; let bot = 0, all = 0;
    for (let i = 0; i < fc.length; i++) {
      if (fc[i].toLowerCase() === base) continue;
      all++;
      const ys = [0, 1, 2].map((k) => P[3 * I[3 * i + k] + 1]);
      if (ys.every((y: number) => y < 0.1)) bot++;
    }
    return { bottom: bot, painted: all };
  });
  // El trazo sí pintó (la cara superior) y nada de la inferior.
  expect(painted).toBeGreaterThan(0);
  expect(bottom).toBe(0);
});

test('ahuecar una esfera de 100 mm con pared 2 deja la pared entre 1,95 y 2,1 mm', async ({ page }) => {
  await abrir(page, 'e100.stl', sphere(50, 96, 96));
  await page.evaluate(async () => { const s = (window as any).__s.getState(); await s.hollowObject(s.objects[0].id, { enabled: true, wallThickness: 2 }); });
  const r = await page.evaluate(() => {
    const P = (window as any).__s.getState().objects[0].mesh.positions as number[]; let min = 1e9, max = 0;
    for (let i = 0; i < P.length; i += 3) { const d = Math.hypot(P[i], P[i + 1] - 50, P[i + 2]); min = Math.min(min, d); max = Math.max(max, d); }
    return { min, max };
  });
  expect(r.max).toBeCloseTo(50, 1);
  expect(r.max - r.min).toBeGreaterThan(1.95);
  expect(r.max - r.min).toBeLessThan(2.1);
});
