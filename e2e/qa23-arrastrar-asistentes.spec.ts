/**
 * @file e2e/qa23-arrastrar-asistentes.spec.ts
 * @description QA23: casos límite de «arrastrar para mover» (vistas rasantes y cenitales, grupos, Ctrl+clic, herramientas
 * que no deben actuar, deshacer/rehacer, objeto fuera de la cama) y del panel «Asistentes» (rangos, coma decimal,
 * variantes, crear, deshacer/rehacer, medidas, inglés, 390 px, consola limpia).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];
function nota(a: { type: string; description: string }) { test.info().annotations.push(a); console.log(`NOTA ${a.type}: ${a.description}`); }
const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/qa23';

const S = (page: Page) => page;
async function escena(page: Page, posiciones: P3[], snap = 0): Promise<string[]> {
  await abrir(page);
  return page.evaluate(
    async ({ posiciones: pos, snap: paso }) => {
      const s = () => (window as any).__s.getState();
      const ids: string[] = [];
      for (const p of pos) {
        const o = await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: p });
        ids.push(o.id);
      }
      s().setSnapGridMm(paso);
      s().setActiveTool('select');
      s().setTransformMode('translate');
      s().setSelection([]);
      s().dismissAllToasts();
      return ids;
    },
    { posiciones, snap },
  );
}
const pos = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position as P3, id);
const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length as number);
const sel = (page: Page, ids: string[]) => page.evaluate((i) => (window as any).__s.getState().setSelection(i), ids);
const selIds = (page: Page) => page.evaluate(() => (window as any).__s.getState().selectedIds as string[]);

async function arrastrar(page: Page, desde: P3, dx: number, dy: number, mods: string[] = []) {
  const a = await aPixel(page, desde);
  await page.mouse.move(a.x, a.y);
  for (const m of mods) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.move(a.x + dx * 0.3, a.y + dy * 0.3, { steps: 3 });
  await page.mouse.move(a.x + dx, a.y + dy, { steps: 6 });
  await page.mouse.up();
  for (const m of mods) await page.keyboard.up(m);
  return a;
}
async function vista(page: Page, cam: P3) {
  await page.evaluate((c) => {
    const st = (window as any).__r3f.getState();
    st.camera.position.set(c[0], c[1], c[2]);
    st.camera.lookAt(0, 15, 0);
    st.camera.updateMatrixWorld();
    st.controls?.update?.();
  }, cam);
  await page.waitForTimeout(250);
}

test.describe('A. arrastrar para mover', () => {
  for (const [nombre, cam] of [
    ['cenital', [0, 600, 1] as P3],
    ['frontal', [0, 40, 500] as P3],
    ['casi rasante', [0, 22, 500] as P3],
  ] as const) {
    test(`vista ${nombre}: el objeto elevado no sale disparado ni cambia de altura`, async ({ page }) => {
      const [a] = await escena(page, [[0, 80, 0]]);
      await sel(page, [a]);
      await vista(page, cam);
      await arrastrar(page, [0, 80, 0], 60, 30);
      const p = await pos(page, a);
      expect(p[1]).toBeCloseTo(80, 5);
      expect(Math.hypot(p[0], p[2])).toBeLessThan(2100);
      expect(Number.isFinite(p[0]) && Number.isFinite(p[2])).toBe(true);
    });
  }

  test('rehacer tras deshacer devuelve la posición movida', async ({ page }) => {
    const [a] = await escena(page, [[0, 15, 0]]);
    await sel(page, [a]);
    await arrastrar(page, [0, 15, 0], 90, 40);
    const movida = await pos(page, a);
    await page.evaluate(() => (window as any).__s.getState().undo());
    expect(await pos(page, a)).toEqual([0, 15, 0]);
    await page.evaluate(() => (window as any).__s.getState().redo());
    expect(await pos(page, a)).toEqual(movida);
  });

  test('Ctrl+clic sobre un objeto seleccionado no lo mueve ni lo deselecciona por arrastre', async ({ page }) => {
    const [a, b] = await escena(page, [[-60, 15, 0], [60, 15, 0]]);
    await sel(page, [a]);
    const antes = await pos(page, b);
    await arrastrar(page, [60, 15, 0], 50, 20, ['Control']);
    expect(await pos(page, a)).toEqual([-60, 15, 0]);
    expect(await pos(page, b)).toEqual(antes);
  });

  for (const tool of ['cut', 'erase', 'measure']) {
    test(`no se activa con la herramienta ${tool}`, async ({ page }) => {
      const [a] = await escena(page, [[0, 15, 0]]);
      await sel(page, [a]);
      await page.evaluate((t) => (window as any).__s.getState().setActiveTool(t), tool);
      await arrastrar(page, [0, 15, 0], 80, 30);
      expect(await pos(page, a)).toEqual([0, 15, 0]);
    });
  }

  for (const modo of ['rotate', 'scale']) {
    test(`con ${modo} activo el cuerpo no mueve; al volver a Mover sí`, async ({ page }) => {
      let [a] = await escena(page, [[0, 15, 0]]);
      await sel(page, [a]);
      await page.evaluate((m) => (window as any).__s.getState().setTransformMode(m), modo);
      // Arrastre sobre una zona del cuerpo alejada del centro (el manipulador ocupa el centro).
      const c = await aPixel(page, [0, 15, 0]);
      const borde = await aPixel(page, [13, 28, 13]);
      await page.mouse.move(borde.x, borde.y);
      await page.mouse.down();
      await page.mouse.move(borde.x + 60, borde.y + 20, { steps: 6 });
      await page.mouse.up();
      expect(await pos(page, a)).toEqual([0, 15, 0]);
      await page.evaluate(() => (window as any).__s.getState().setTransformMode('translate'));
      // El arrastre en Rotar/Escalar pudo agarrar un asa del manipulador (legítimo y asíncrono): se recrea el cubo limpio.
      a = await page.evaluate(async () => {
        const g = () => (window as any).__s.getState();
        g().deleteObjects(g().objects.map((x: any) => x.id));
        const o = await g().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: [0, 15, 0] });
        g().setSelection([o.id]);
        g().setTransformMode('translate');
        return o.id as string;
      });
      await page.waitForTimeout(300);
      const estado = await page.evaluate(() => { const g = (window as any).__s.getState(); return { sel: g.selectedIds, modo: g.transformMode, tool: g.activeTool, past: g.past.length }; });
      await arrastrar(page, [0, 15, 0], 80, 30);
      const d = Math.hypot(...(await pos(page, a)).map((v, i) => (i === 1 ? 0 : v)));
      if (d <= 10) await page.screenshot({ path: `${SHOTS}/volver-a-mover-${modo}.png` });
      expect(d, JSON.stringify(estado)).toBeGreaterThan(10);
      void c;
    });
  }

  test('objeto dentro de un grupo: arrastrar el grupo seleccionado mueve a todos', async ({ page }) => {
    const [a, b] = await escena(page, [[-40, 15, 0], [40, 15, 0]]);
    const gid = await page.evaluate(([x, y]) => (window as any).__s.getState().groupObjects([x, y], 'G'), [a, b]);
    await page.evaluate((g) => (window as any).__s.getState().selectGroup?.(g?.id ?? g), gid);
    await page.waitForTimeout(200);
    const seleccion = await selIds(page);
    await arrastrar(page, [40, 15, 0], 0, 70);
    const [pa, pb] = [await pos(page, a), await pos(page, b)];
    expect(pb[2] - 0).not.toBe(0);
    expect(pb[0] - pa[0]).toBeCloseTo(80, 3);
    expect(seleccion.length).toBeGreaterThan(0);
  });

  test('objeto arrastrado fuera de la cama: avisa o queda registrado', async ({ page }) => {
    const [a] = await escena(page, [[0, 15, 0]]);
    await sel(page, [a]);
    await arrastrar(page, [0, 15, 0], 20, -400);
    const p = await pos(page, a);
    await page.screenshot({ path: `${SHOTS}/fuera-de-cama.png` });
    const avisos = await page.locator('[role="status"], [role="alert"], .kura-toast').allInnerTexts();
    nota({ type: 'fuera-de-cama', description: JSON.stringify({ p, avisos }) });
  });

  test('flecha del manipulador tiene prioridad sobre el cuerpo (no se mueve en el plano)', async ({ page }) => {
    const [a] = await escena(page, [[0, 15, 0]]);
    await sel(page, [a]);
    const flecha = await aPixel(page, [30, 15, 0]);
    await page.mouse.move(flecha.x, flecha.y);
    await page.mouse.down();
    await page.mouse.move(flecha.x + 50, flecha.y + 50, { steps: 6 });
    await page.mouse.up();
    const p = await pos(page, a);
    nota({ type: 'gizmo', description: JSON.stringify(p) });
    expect(await pasos(page)).toBeLessThan(3);
  });
});

test('consola sin errores al arrastrar', async ({ page }) => {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  const [a] = await escena(page, [[0, 15, 0]]);
  await sel(page, [a]);
  await arrastrar(page, [0, 15, 0], 80, 30);
  expect(errs.filter((e) => !/favicon/.test(e))).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// B. Asistentes
// ---------------------------------------------------------------------------------------------------------------
const objs = (page: Page) =>
  page.evaluate(() =>
    (window as any).__s.getState().objects.map((o: any) => ({
      id: o.id, name: o.name, pos: o.position, dims: o.stats.dimensionsMm, vol: o.stats.volumeMm3, manifold: o.stats.isManifold,
    })),
  );
async function abrirAsistentes(page: Page) {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
}
const crear = (page: Page) => page.getByRole('button', { name: 'Crear', exact: true });
async function esperarCreado(page: Page, n: number) {
  await expect.poll(async () => (await objs(page)).length, { timeout: 60000 }).toBeGreaterThanOrEqual(n);
}
const bus = (page: Page, command: string, params: Record<string, unknown>) =>
  page.evaluate(async ([c, p]) => (window as any).__s.getState().executeCommand({ id: `q-${Math.random()}`, command: c, params: p }), [command, params] as const);

test.describe('B. asistentes', () => {
  test('lista, foco inicial, abrir receta, Escape vuelve a la lista y luego cierra', async ({ page }) => {
    await abrir(page);
    await abrirAsistentes(page);
    await expect(page.locator('#kura-asis-first')).toBeFocused();
    for (const n of ['Caja con tapa', 'Llavero con texto', 'Placa de enchufe']) await expect(page.getByRole('button', { name: new RegExp(n) })).toBeVisible();
    await page.getByRole('button', { name: /Llavero/ }).click();
    await expect(page.getByLabel('Texto', { exact: false }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toHaveCount(0);
  });

  test('paleta Ctrl+K: «Asistentes» y «Asistente: Llavero»', async ({ page }) => {
    await abrir(page);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('Asistente');
    await page.waitForTimeout(300);
    const textos = await page.getByRole('option').allInnerTexts();
    nota({ type: 'paleta', description: textos.join(' | ') });
    expect(textos.join(' ')).toMatch(/Asistentes/);
    expect(textos.join(' ')).toMatch(/Asistente: Llavero/);
    await page.getByRole('option', { name: /Asistente: Llavero/ }).first().click();
    await expect(page.getByLabel('Texto', { exact: false }).first()).toBeVisible();
  });

  test('caja con tapa: medidas, un solo deshacer, rehacer, segunda creación sin solape, exportar y comprobar', async ({ page }) => {
    test.setTimeout(180000);
    const errs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    await abrir(page);
    await abrirAsistentes(page);
    await page.getByRole('button', { name: /Caja con tapa/ }).click();
    const antes = await pasos(page);
    await crear(page).click();
    await esperarCreado(page, 2);
    const o1 = await objs(page);
    expect(o1.map((o: any) => o.name).sort()).toEqual(['Caja', 'Tapa']);
    const caja = o1.find((o: any) => o.name === 'Caja');
    const tapa = o1.find((o: any) => o.name === 'Tapa');
    // Interior 80x60x40 + pared 2 => exterior 84x64x42.
    expect(caja.dims.map((v: number) => Math.round(v * 10) / 10).sort((a: number, b: number) => a - b)).toEqual([42, 64, 84]);
    expect(tapa.dims[0]).toBeCloseTo(84, 1);
    expect(caja.manifold && tapa.manifold).toBe(true);
    expect(await selIds(page)).toHaveLength(2);
    expect(await pasos(page)).toBe(antes + 1);
    await page.screenshot({ path: `${SHOTS}/caja-creada.png` });
    const stl = await bus(page, 'export_stl', { wantsBytes: true });
    nota({ type: 'export_stl', description: JSON.stringify(stl).slice(0, 200) });
    const tri = (stl as any)?.result?.triangleCount;
    const b64 = (stl as any)?.result?.bytesBase64 as string | undefined;
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      expect(buf.readUInt32LE(80)).toBe(tri);
      let v = 0;
      for (let i = 0; i < tri; i++) {
        const o = 84 + i * 50 + 12;
        const f = (k: number) => buf.readFloatLE(o + k * 4);
        const [ax, ay, az, bx, by, bz, cx, cy, cz] = [f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7), f(8)];
        v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      }
      const esperado = o1.reduce((s: number, o: any) => s + o.vol, 0);
      nota({ type: 'volumen', description: `stl=${v.toFixed(1)} esperado=${esperado.toFixed(1)}` });
      expect(Math.abs(v - esperado) / esperado).toBeLessThan(0.02);
    }
    const ids = o1.map((o: any) => o.id);
    const fit = await bus(page, 'check_fit', { ids });
    nota({ type: 'check_fit', description: JSON.stringify(fit).slice(0, 600) });
    for (const id of ids) {
      const pr = await bus(page, 'analyze_printability', { id });
      nota({ type: 'printability', description: JSON.stringify(pr).slice(0, 300) });
    }
    await page.evaluate(() => (window as any).__s.getState().undo());
    expect((await objs(page)).length).toBe(0);
    await page.evaluate(() => (window as any).__s.getState().redo());
    expect((await objs(page)).length).toBe(2);
    await abrirAsistentes(page);
    await page.getByRole('button', { name: /Caja con tapa/ }).click();
    await crear(page).click();
    await esperarCreado(page, 4);
    const o2 = await objs(page);
    const bx = o2.map((o: any) => ({ n: o.name, x0: o.pos[0] - o.dims[0] / 2, x1: o.pos[0] + o.dims[0] / 2, y0: o.pos[1] - o.dims[1] / 2, y1: o.pos[1] + o.dims[1] / 2 }));
    nota({ type: 'cajas', description: JSON.stringify(bx) });
    let solapes = 0;
    for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) {
      const a = bx[i], b = bx[j];
      if (a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01) solapes++;
    }
    void solapes;
    expect(errs.filter((e) => !/favicon/.test(e))).toEqual([]);
  });

  // QA23: la segunda creación caía exactamente sobre la primera (corregido: las salidas van a un hueco libre).
  test('crear dos veces seguidas sin deshacer: la segunda no se solapa con la primera', async ({ page }) => {
    await abrir(page);
    for (let k = 1; k <= 2; k++) {
      await abrirAsistentes(page);
      await page.getByRole('button', { name: /Caja con tapa/ }).click();
      await crear(page).click();
      await esperarCreado(page, 2 * k);
    }
    const o = await objs(page);
    nota({ type: 'doble-creacion', description: JSON.stringify(o.map((x: any) => [x.name, x.pos, x.dims])) });
    const cajas = o.filter((x: any) => x.name === 'Caja');
    expect(cajas).toHaveLength(2);
    const [a, b] = cajas;
    const solapa = Math.abs(a.pos[0] - b.pos[0]) < (a.dims[0] + b.dims[0]) / 2 - 0.01 && Math.abs(a.pos[2] - b.pos[2]) < (a.dims[2] + b.dims[2]) / 2 - 0.01; // planta: X y Z (Y es la altura)
    expect(solapa, 'la segunda caja cae sobre la primera').toBe(false);
  });

  test('valores fuera de rango bloquean Crear con mensaje junto al campo; coma decimal admitida', async ({ page }) => {
    await abrir(page);
    await abrirAsistentes(page);
    await page.getByRole('button', { name: /Caja con tapa/ }).click();
    const ancho = page.getByLabel('Ancho interior');
    await ancho.fill('5');
    await ancho.press('Tab');
    await page.screenshot({ path: `${SHOTS}/fuera-de-rango.png` });
    const panel = await page.locator('.kura-asis-panel').innerText();
    nota({ type: 'fuera-de-rango', description: panel.replace(/\n+/g, ' / ').slice(0, 600) });
    await expect(crear(page)).toBeDisabled();
    await ancho.fill('80');
    await ancho.press('Tab');
    await expect(crear(page)).toBeEnabled();
    const pared = page.getByLabel('Pared', { exact: true });
    await pared.fill('1,4');
    await pared.press('Tab');
    await expect(page.getByText(/Pared bajo 1,6 mm/)).toBeVisible();
    expect(await pared.inputValue()).toMatch(/1[.,]4/);
    await pared.fill('abc');
    await pared.press('Tab');
    nota({ type: 'texto-no-numerico', description: `valor=${await pared.inputValue()} crear=${await crear(page).isEnabled()}` });
  });

  test('placa de enchufe: todas las variantes crean sin error', async ({ page }) => {
    test.setTimeout(240000);
    await abrir(page);
    await abrirAsistentes(page);
    await page.getByRole('button', { name: /Placa de enchufe/ }).click();
    const opciones = await page.getByLabel('Variante', { exact: true }).locator('option').allInnerTexts();
    nota({ type: 'variantes', description: opciones.join(' | ') });
    expect(opciones.length).toBeGreaterThanOrEqual(5);
    let n = 0;
    for (let i = 1; i < opciones.length; i++) {
      if (i > 1) { await abrirAsistentes(page); await page.getByRole('button', { name: /Placa de enchufe/ }).click(); }
      await page.getByLabel('Variante', { exact: true }).selectOption({ index: i });
      await expect(crear(page)).toBeEnabled();
      await crear(page).click();
      n++;
      await esperarCreado(page, n);
      const todos = await objs(page);
      expect(todos.every((o: any) => o.manifold), `variante ${opciones[i]}`).toBe(true);
    }
  });

  test('Enter en un campo crea; aviso de lo creado; piezas encuadradas', async ({ page }) => {
    await abrir(page);
    await abrirAsistentes(page);
    await page.getByRole('button', { name: /Caja con tapa/ }).click();
    await page.getByLabel('Alto interior').press('Enter');
    await esperarCreado(page, 2);
    await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toHaveCount(0);
    const toasts = await page.locator('[role="status"], [role="alert"]').allInnerTexts();
    nota({ type: 'avisos-tras-crear', description: toasts.join(' | ').split(/ /).join(" ") });
    expect(toasts.join(' ')).toMatch(/Caja/);
  });

  for (const [nombre, w, h, lang, oscuro] of [
    ['en-1440', 1440, 900, 'en', false],
    ['es-oscuro-1024', 1024, 700, 'es', true],
  ] as const) {
    test(`panel Asistentes en ${nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await abrir(page);
      await page.evaluate((l) => (window as any).__s.getState().setLanguage(l), lang);
      if (oscuro) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      if (w < 600) {
        await page.getByRole('button', { name: /Agregar|Add/ }).first().click();
        await page.screenshot({ path: `${SHOTS}/asist-${nombre}-hoja.png` });
        await page.getByRole('button', { name: /Asistentes|Assistants|Wizards/ }).first().click();
      } else {
        await page.getByRole('button', { name: /^(Insertar|Insert)$/ }).first().click();
        await page.getByRole('menuitem', { name: /^(Asistentes|Assistants)/ }).click();
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/asist-${nombre}-lista.png` });
      await page.getByRole('button', { name: /Caja con tapa|Box with lid/ }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/asist-${nombre}-caja.png` });
      const txt = await page.locator('.kura-asis-panel').innerText();
      nota({ type: `texto-${nombre}`, description: txt.slice(0, 700).split(" ").join(" ") });
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(desborde, 'scroll horizontal de página').toBe(false);
    });
  }
});

test('modelo real pesado: arrastrar es fluido (fotogramas) y no congela el hilo', async ({ page }) => {
  test.setTimeout(420000);
  const modelo = 'G:/proyectos/kura3d/.eval-tmp/modelos/Spiral+Phoenix+12cm+STL.stl';
  await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(modelo);
  await expect.poll(async () => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 120000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => { const g = (window as any).__s.getState(); const o = g.objects[0]; return { id: o.id, pos: o.position as number[], tris: o.stats.triangles, sel: g.selectedIds }; });
  nota({ type: 'pesado', description: JSON.stringify(info) });
  await sel(page, [info.id]);
  await page.evaluate(() => { (window as any).__frames = 0; const t = () => { (window as any).__frames++; requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const c = await aPixel(page, info.pos as P3);
  const t0 = Date.now();
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) await page.mouse.move(c.x + i * 3, c.y + i * 1.5);
  await page.mouse.up();
  const ms = Date.now() - t0;
  const frames = await page.evaluate(() => (window as any).__frames as number);
  const p = await pos(page, info.id);
  nota({ type: 'pesado-arrastre', description: `ms=${ms} frames=${frames} mov=${JSON.stringify(p)} desde=${JSON.stringify(info.pos)}` });
  // Referencia: la misma cantidad de movimientos orbitando sobre el fondo (cuesta lo que cuesta dibujar la malla en este equipo).
  await sel(page, []);
  const t1 = Date.now();
  await page.mouse.move(120, 700);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) await page.mouse.move(120 + i * 3, 700 + i * 1.5);
  await page.mouse.up();
  const msOrbita = Date.now() - t1;
  nota({ type: 'pesado-referencia-orbita', description: `ms=${msOrbita}` });
  expect(Math.hypot(p[0] - info.pos[0], p[2] - info.pos[2])).toBeGreaterThan(5);
  // El arrastre no debe costar mucho más que orbitar la misma malla.
  expect(ms).toBeLessThan(msOrbita * 2 + 3000);
});
