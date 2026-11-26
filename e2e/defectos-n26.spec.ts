/**
 * @file e2e/defectos-n26.spec.ts
 * @description Recorridos de los defectos del lote 26-nov: arrastre entre placas (aviso con «Deshacer» y pieza dentro de la
 * cama destino) y Simplificar (informe tras «Aplicar de todos modos», «Tolerancia pedida», Enter = vista previa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];
test.use({ viewport: { width: 1440, height: 900 } });

async function vista(page: Page, cam: P3, mira: P3) {
  for (let intento = 0; intento < 6; intento++) {
    await page.evaluate(([c, m]) => {
      const st = (window as any).__r3f.getState();
      st.camera.position.set(c[0], c[1], c[2]);
      st.controls?.target?.set(m[0], m[1], m[2]);
      st.camera.lookAt(m[0], m[1], m[2]);
      st.camera.updateMatrixWorld();
      st.controls?.update?.();
    }, [cam, mira] as const);
    await page.waitForTimeout(250);
    const quieta = await page.evaluate((c) => {
      const q = (window as any).__r3f.getState().camera.position;
      return Math.hypot(q.x - c[0], q.y - c[1], q.z - c[2]) < 1;
    }, cam);
    if (quieta) return;
  }
  throw new Error('la cámara no quedó en la vista pedida');
}

/** Arrastra la pieza `a` (en el origen de la placa 1) hasta soltarla con su centro en `objetivo`. */
async function arrastrarEntrePlacas(page: Page, objetivo: P3) {
  await page.waitForTimeout(2500);
  const o2 = await page.evaluate(() => (window as any).__s.getState().plates[1].origin as number[]);
  await vista(page, [o2[0] / 2, 650, o2[1] / 2 + 1], [o2[0] / 2, 0, o2[1] / 2]);
  const desde = await aPixel(page, [0, 15, 0]);
  const hasta = await aPixel(page, objetivo);
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down();
  await page.mouse.move(desde.x + (hasta.x - desde.x) * 0.4, desde.y + (hasta.y - desde.y) * 0.4, { steps: 4 });
  await page.mouse.move(hasta.x, hasta.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function dosPlacas(page: Page, caja = 80) {
  await abrir(page);
  if (!(await page.evaluate(() => Boolean((window as any).__r3f)))) await abrir(page);
  return page.evaluate(async (w) => {
    const s = () => (window as any).__s.getState();
    const a = (await s().createPrimitive('box', { width: w, height: 30, depth: w }, { position: [0, 15, 0] })).id;
    s().createPlate();
    s().setSnapGridMm(0);
    s().setActiveTool('select');
    s().setTransformMode('translate');
    s().setSelection([a]);
    s().dismissAllToasts();
    return a as string;
  }, caja);
}
const estado = (page: Page, id: string) =>
  page.evaluate((i) => {
    const s = (window as any).__s.getState();
    const o = s.objects.find((x: any) => x.id === i);
    return { pos: o.position as P3, ref: o.plateRef as string, p1: s.plates[0].id as string, p2: s.plates[1].id as string, o2: s.plates[1].origin as number[], pasos: s.past.length as number, toasts: s.toasts.map((t: any) => t.text) as string[] };
  }, id);

test('arrastrar a otra placa: avisa con «Deshacer» y la pieza queda dentro de la cama', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const a = await dosPlacas(page);
  const antes = await estado(page, a);
  // Se suelta con el centro a 30 mm del origen de la placa 2 (dentro de su cama).
  await arrastrarEntrePlacas(page, [antes.o2[0] + 30, 15, antes.o2[1] + 30]);
  const r = await estado(page, a);
  console.log('N26 placas', JSON.stringify(r));
  expect(r.ref).toBe(r.p2);
  expect(r.toasts.filter((m) => /pasó a/i.test(m)).length, 'un solo aviso').toBe(1);
  await expect(page.getByRole('button', { name: /^Deshacer$/ }).first()).toBeVisible();
  expect(r.pos[0]).toBeGreaterThan(r.o2[0] - 1);
  expect(r.pos[2]).toBeGreaterThan(r.o2[1] - 1);
  // Un solo paso: Deshacer del aviso revierte arrastre y placa.
  expect(r.pasos - antes.pasos).toBe(1);
  await page.getByRole('button', { name: /^Deshacer$/ }).first().click();
  const u = await estado(page, a);
  expect(u.ref).toBe(u.p1);
  expect(u.pos[0]).toBeCloseTo(0, 1);
  expect(sinErr(errs)).toEqual([]);
});
const sinErr = (e: string[]) => e.filter((x) => !/favicon|WebGL|GPU/i.test(x));

test('arrastrar a otra placa soltando en el borde: la pieza se acerca lo justo para caber en la cama', async ({ page }) => {
  const a = await dosPlacas(page);
  const antes = await estado(page, a);
  // Centro a 10 mm del borde derecho de la placa 2 (cama de 256): la caja de 80 mm sobresaldría 30 mm.
  await arrastrarEntrePlacas(page, [antes.o2[0] + 118, 15, antes.o2[1]]);
  const r = await estado(page, a);
  console.log('N26 borde', JSON.stringify(r));
  expect(r.ref).toBe(r.p2);
  expect(r.pos[0] + 40, 'la caja cabe en la cama (borde derecho)').toBeLessThanOrEqual(r.o2[0] + 128 + 0.01);
  expect(r.pos[0] + 40, 'sin alejarse más de lo necesario').toBeGreaterThan(r.o2[0] + 128 - 1);
  expect(r.toasts.filter((m) => /pasó a/i.test(m)).length).toBe(1);
  expect(r.pasos - antes.pasos).toBe(1);
  await page.keyboard.press('Control+z');
  const u = await estado(page, a);
  expect(u.ref).toBe(u.p1);
  expect(u.pos[0]).toBeCloseTo(0, 1);
});

test('3MF real llaveros: arrastrar una pieza a la otra placa avisa y la deja dentro de la cama', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page);
  const ruta = 'G:/proyectos/kura3d/.eval-tmp/modelos/llaveros.3mf';
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(ruta);
  const conv = page.locator('button', { hasText: 'Convertir en placas' }).first();
  await expect(conv).toBeVisible({ timeout: 90_000 });
  await conv.click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().plates.length), { timeout: 20_000 }).toBe(2);
  await page.evaluate(() => { const s = (window as any).__s.getState(); s.setSnapGridMm(0); s.setActiveTool('select'); s.dismissAllToasts(); });
  await page.waitForTimeout(2500);
  // Pieza de la placa 1 con su caja, y destino: centro de la placa 2.
  const info = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    const o = s.objects.find((x: any) => x.plateRef === s.plates[0].id);
    s.setSelection([o.id]);
    const p = o.mesh.positions; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k] * o.scale[k]); mx[k] = Math.max(mx[k], p[i + k] * o.scale[k]); }
    return { id: o.id, pos: o.position, mn, mx, o1: s.plates[0].origin, o2: s.plates[1].origin, n1: s.objects.filter((x: any) => x.plateRef === s.plates[0].id).length };
  });
  console.log('N26 llaveros', JSON.stringify(info));
  const centro: P3 = [info.pos[0] + (info.mn[0] + info.mx[0]) / 2, info.pos[1] + (info.mn[1] + info.mx[1]) / 2, info.pos[2] + (info.mn[2] + info.mx[2]) / 2];
  const dest: P3 = [info.o2[0], centro[1], info.o2[1]];
  // Vista superior sobre las dos camas: el gizmo no ofrece su flecha vertical y el arrastre es horizontal.
  await vista(page, [info.o2[0] / 2, 900, 1], [info.o2[0] / 2, 0, 0]);
  await page.waitForTimeout(500);
  const desde = await aPixel(page, centro);
  const hasta = await aPixel(page, dest);
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down();
  await page.mouse.move(desde.x + (hasta.x - desde.x) * 0.4, desde.y + (hasta.y - desde.y) * 0.4, { steps: 4 });
  await page.mouse.move(hasta.x, hasta.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const r = await page.evaluate((id) => {
    const s = (window as any).__s.getState();
    const o = s.objects.find((x: any) => x.id === id);
    return { pos: o.position, ref: o.plateRef, p2: s.plates[1].id, toasts: s.toasts.map((t: any) => t.text), hist: s.toastHistory?.map((t: any) => t.text) };
  }, info.id);
  console.log('N26 llaveros resultado', JSON.stringify(r));
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/n26-llaveros.png' });
  expect(r.ref).toBe(r.p2);
  expect(r.toasts.filter((m: string) => /pasó a/i.test(m)).length, 'un solo aviso').toBe(1);
  // La pieza (34,5 mm de lado) queda dentro de la cama de la placa 2 (256 mm) y sobre ella.
  expect(r.pos[0] + info.mn[0]).toBeGreaterThanOrEqual(info.o2[0] - 128 - 0.01);
  expect(r.pos[0] + info.mx[0]).toBeLessThanOrEqual(info.o2[0] + 128 + 0.01);
  expect(r.pos[1], 'sin hundirse bajo la cama (el gizmo tiene holgura de décimas)').toBeGreaterThanOrEqual(-1);
  await expect(page.getByRole('button', { name: /^Deshacer$/ }).first()).toBeVisible();
  expect(sinErr(errs)).toEqual([]);
});

// ---- Simplificar ----
import { itemAccion } from './acciones-helpers';
import { cmd, libre, pasos, seleccionar, volumen } from './qa25a-helpers';

async function panelTolerancia(page: Page, mm: string) {
  await abrir(page);
  const esf = await cmd(page, 'create_primitive', { type: 'sphere', radius: 10, name: 'Esfera' });
  await seleccionar(page, [esf.id]);
  await (await itemAccion(page, 'Simplificar…')).click();
  const sec = page.locator('.kura-simplify-section');
  await expect(sec).toBeVisible();
  await sec.locator('select').first().selectOption('tolerance');
  const campo = sec.getByRole('spinbutton').first();
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type(mm);
  return { id: esf.id as string, sec, campo };
}
const trisDe = (page: Page, id: string) => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);

test('Simplificar por tolerancia: «Aplicar de todos modos» deja el informe del panel con lo forzado y su Deshacer; «Tolerancia pedida» es la escrita', async ({ page }) => {
  test.setTimeout(180_000);
  const errs = await abrir(page);
  void errs;
  const { id, sec } = await panelTolerancia(page, '5');
  const t0 = await trisDe(page, id);
  const p0 = await pasos(page);
  await sec.getByTestId('simplify-run').click();
  await libre(page);
  const aplicada = page.getByTestId('simplify-safe-applied');
  await page.waitForTimeout(1500);
  console.log('N26 informe crudo', await page.locator('.kura-simplify-section').innerText(), await trisDe(page, id));
  await expect(aplicada).toBeVisible({ timeout: 20_000 });
  const t1 = await trisDe(page, id);
  const informe1 = (await page.getByTestId('simplify-report').innerText()).replace(/\s+/g, ' ');
  console.log('N26 segura', t0, '->', t1, informe1.slice(0, 300));
  // Defecto 3: «Tolerancia pedida» es lo escrito (5), la usada por la segura va aparte.
  expect.soft(informe1).toMatch(/Tolerancia pedida: 5 mm/);
  expect.soft(informe1).toMatch(/Tolerancia usada: /);
  await page.getByTestId('simplify-apply-anyway').click();
  await libre(page);
  const t2 = await trisDe(page, id);
  const informe2 = (await page.getByTestId('simplify-report').innerText()).replace(/\s+/g, ' ');
  console.log('N26 forzada', t1, '->', t2, informe2.slice(0, 300));
  expect(t2).toBeLessThan(t1);
  // Defecto 2: el informe refleja lo aplicado (forzado), sin «versión segura», con Deshacer.
  expect(informe2).toContain(`${t2}`);
  await expect(page.getByTestId('simplify-safe-applied')).toHaveCount(0);
  await expect(page.getByTestId('simplify-report-undo')).toBeVisible();
  expect(await pasos(page)).toBe(p0 + 1);
  await page.getByTestId('simplify-report-undo').click();
  expect(await trisDe(page, id)).toBe(t0);
  expect(await pasos(page)).toBe(p0);
});

test('Simplificar: Enter en un campo lanza la vista previa y no aplica', async ({ page }) => {
  test.setTimeout(180_000);
  await abrir(page);
  const esf = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
  await seleccionar(page, [esf.id]);
  await (await itemAccion(page, 'Simplificar…')).click();
  const sec = page.locator('.kura-simplify-section');
  await sec.locator('select').first().selectOption('target');
  const campo = sec.getByRole('spinbutton').first();
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('30');
  const v0 = await volumen(page, esf.id);
  const t0 = await trisDe(page, esf.id);
  const p0 = await pasos(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('simplify-report')).toBeVisible({ timeout: 60_000 });
  await libre(page);
  await expect(page.getByTestId('simplify-report')).toContainText(/Vista previa/i);
  expect(await trisDe(page, esf.id)).toBe(t0);
  expect(await volumen(page, esf.id)).toBeCloseTo(v0, 3);
  expect(await pasos(page)).toBe(p0);
});
