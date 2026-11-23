/**
 * @file e2e/qa16-reverificacion.spec.ts
 * @description QA16: re-verificación de los generadores corregidos. Separar por colores tras pintar (cilindro y
 * esfera: sólidos cerrados, volumen conservado, un solo paso de deshacer), proyectar dos veces el mismo texto
 * (queda cerrado), agujero roscado en la cara superior de un cubo y largos por defecto de la rosca según diámetro.
 * Usa el store del servidor de desarrollo (import dinámico de /src). Requiere la web en KURA_URL.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5229/';

async function abrir(page: Page) {
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => {
    const w = window as any;
    w.__s = (await import('/src/store/useKuraStore.ts')).useKuraStore;
    w.__an = (o: any) => {
      const p = o.mesh.positions, ix = o.mesh.indices, key = new Map<string, number>();
      const id = (i: number) => { const k = [0, 1, 2].map((a) => Math.round(p[3 * i + a] * 1e4)).join(','); if (!key.has(k)) key.set(k, key.size); return key.get(k)!; };
      const bal = new Map<string, number>(), cnt = new Map<string, number>(); let vol = 0;
      for (let t = 0; t < ix.length / 3; t++) {
        const a = ix[3 * t], b = ix[3 * t + 1], c = ix[3 * t + 2], ids = [id(a), id(b), id(c)];
        const A = [p[3 * a], p[3 * a + 1], p[3 * a + 2]], B = [p[3 * b], p[3 * b + 1], p[3 * b + 2]], C = [p[3 * c], p[3 * c + 1], p[3 * c + 2]];
        vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
        if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
        for (let k = 0; k < 3; k++) {
          const u = ids[k], v = ids[(k + 1) % 3], kk = u < v ? `${u}_${v}` : `${v}_${u}`;
          bal.set(kk, (bal.get(kk) ?? 0) + (u < v ? 1 : -1)); cnt.set(kk, (cnt.get(kk) ?? 0) + 1);
        }
      }
      return { name: o.name, vol, open: [...bal.values()].filter((v) => v !== 0).length + [...cnt.values()].filter((v) => v !== 2).length };
    };
    w.__all = () => w.__s.getState().objects.map((o: any) => w.__an(o));
  });
}

/** Pinta un trazo irregular sobre la pieza (acepta el aviso de "pintar quita los parámetros" si sale). */
async function pintarTrazo(page: Page) {
  await page.getByRole('button', { name: 'Pintar' }).first().click();
  const aviso = page.getByRole('button', { name: /Pintar igual/ }).first();
  const trazo = async () => {
    // El trazo se dibuja alrededor del centro real de la pieza en pantalla (no en píxeles fijos): el encuadre
    // cambia cuando cambian los paneles del visor y un punto fijo deja de caer sobre una esfera.
    const c = await page.evaluate(async () => {
      const w = window as any;
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
      let st: any = null;
      for (const u of urls) { const m = await import(/* @vite-ignore */ u); if (m._roots) st = [...m._roots.values()][0].store.getState(); }
      const o = w.__s.getState().objects[0]; const P = o.mesh.positions as number[];
      let minY = 1e9, maxY = -1e9; for (let i = 1; i < P.length; i += 3) { minY = Math.min(minY, P[i]); maxY = Math.max(maxY, P[i]); }
      const cam = st.camera; cam.updateMatrixWorld();
      const V = cam.position.constructor;
      const mid = o.position[1] + ((minY + maxY) / 2) * o.scale[1];
      const a = new V(o.position[0], mid, o.position[2]).project(cam);
      const b = new V(o.position[0], o.position[1] + maxY * o.scale[1], o.position[2]).project(cam);
      const r = st.gl.domElement.getBoundingClientRect();
      const px = (v: any) => ({ x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height });
      const pa = px(a), pb = px(b);
      return { x: pa.x, y: pa.y, radio: Math.abs(pa.y - pb.y) };
    });
    const k = Math.min(1, (c.radio * 0.45) / 50);
    const base = [[-25, -50], [-10, -30], [5, -45], [20, -10], [25, 20], [15, 50], [-5, 40], [-20, 10]];
    const pts = base.map(([dx, dy]) => [c.x + dx * k, c.y + dy * k]);
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 6 });
    await page.mouse.up();
  };
  await trazo();
  await page.waitForTimeout(800);
  if (await aviso.isVisible().catch(() => false)) { await aviso.click(); await page.waitForTimeout(1500); await trazo(); }
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Seleccionar' }).first().click();
}

for (const forma of ['Cilindro', 'Esfera']) {
  test(`separar por colores tras pintar (${forma}): piezas cerradas, volumen conservado y deshacer en un paso`, async ({ page }) => {
    await abrir(page);
    await page.getByRole('button', { name: forma, exact: true }).click();
    await page.waitForTimeout(800);
    await pintarTrazo(page);
    const antes = await page.evaluate(() => (window as any).__an((window as any).__s.getState().objects[0]));
    const sep = page.getByRole('button', { name: /Separar por colores/ }).first();
    await sep.scrollIntoViewIfNeeded();
    const t0 = Date.now();
    await sep.click();
    await page.waitForFunction(() => (window as any).__s.getState().objects.length > 1, null, { timeout: 30000 });
    expect(Date.now() - t0).toBeLessThan(15000);
    const piezas: { vol: number; open: number }[] = await page.evaluate(() => (window as any).__all());
    expect(piezas.length).toBe(2);
    for (const p of piezas) expect(p.open).toBe(0);
    expect(piezas.reduce((s, p) => s + p.vol, 0)).toBeCloseTo(antes.vol, 0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  });
}

test('separar por colores sin pintar da un mensaje guía y no crea piezas', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Esfera', exact: true }).click();
  const sep = page.getByRole('button', { name: /Separar por colores/ }).first();
  await sep.scrollIntoViewIfNeeded();
  await sep.click();
  await expect(page.getByText(/Aún no hay zonas pintadas/).first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
});

test('proyectar dos veces el mismo texto sobre un cubo de 30 mm deja la malla cerrada', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Cubo', exact: true }).click();
  for (const n of ['Ancho', 'Fondo', 'Alto']) { const t = page.getByRole('spinbutton', { name: n, exact: true }).first(); await t.fill('30'); await t.press('Enter'); }
  for (let i = 0; i < 2; i++) {
    const b = page.getByRole('button', { name: /Proyectar Texto\/SVG/ });
    await b.scrollIntoViewIfNeeded();
    await b.click();
    const w = page.getByRole('spinbutton', { name: /Ancho proyectado/ });
    await w.fill('20'); await w.press('Tab');
    await page.getByRole('button', { name: /Proyectar sobre Modelo/ }).click();
    await expect(page.getByRole('button', { name: /Proyectar sobre Modelo/ })).toBeHidden({ timeout: 20000 });
    const r: { open: number }[] = await page.evaluate(() => (window as any).__all());
    expect(r[0].open).toBe(0);
  }
});

test('agujero roscado con un cubo seleccionado: centrado arriba, agrupado y "Aplicar restas" lo deja en el cubo', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Cubo', exact: true }).click();
  await page.getByRole('button', { name: /Rosca ISO/ }).click();
  const slot = page.locator('.kura-op-slot').first();
  await slot.locator('select').first().selectOption('hole');
  const largo = slot.getByRole('spinbutton').nth(2);
  await largo.fill('10'); await largo.press('Tab');
  await page.getByRole('button', { name: /Crear Rosca/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 20000 }).toBe(2);
  const g = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => [o.groupRef, o.role === 'negative', o.position]));
  expect(g[0][0]).toBeTruthy();
  expect(g[0][0]).toBe(g[1][0]);
  expect(g[1][1]).toBe(true);
  await page.locator('button.kura-boolean-fab').click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 20000 }).toBe(1);
  const r = await page.evaluate(() => (window as any).__all());
  expect(r[0].vol).toBeLessThan(27000 - 300);
  expect(r[0].open).toBe(0);
});

test('rosca: el largo por defecto sigue al diámetro (perno ≈ 2,5·d, tuerca ≈ 0,8·d)', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: /Rosca ISO/ }).click();
  const slot = page.locator('.kura-op-slot').first();
  const largo = async () => Number((await slot.getByRole('spinbutton').nth(2).inputValue()).replace(',', '.'));
  await slot.locator('select').first().selectOption('bolt');
  await slot.getByRole('radio', { name: /^M3 / }).click();
  expect(await largo()).toBeCloseTo(7.5, 1);
  await slot.getByRole('radio', { name: /^M20 / }).click();
  expect(await largo()).toBeCloseTo(50, 1);
  await slot.locator('select').first().selectOption('nut');
  await slot.getByRole('radio', { name: /^M20 / }).click();
  expect(await largo()).toBeCloseTo(16, 1);
});
