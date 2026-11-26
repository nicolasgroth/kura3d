/**
 * @file e2e/qa25j-arrastrar-plano.spec.ts
 * @description QA 26-nov (J): arrastrar por plano. En vista Frente el arrastre mueve en ancho y alto (no en profundidad) y
 * no baja de la cama; en Superior e isométrica se mueve sobre el plano horizontal; Alt fuerza el vertical; Mayús restringe a
 * un eje; el rótulo «Plano …» sigue al cursor; un Ctrl+Z por arrastre; Esc cancela; con 2 placas, soltar sobre la otra
 * reasigna la pieza. Las coordenadas de pantalla se calculan proyectando desde la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];
const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25j';
test.use({ viewport: { width: 1440, height: 900 } });

async function escena(page: Page, posiciones: P3[]): Promise<string[]> {
  await abrir(page);
  // El enlace al store de r3f se detecta por los recursos cargados: si falla una vez, se reintenta abriendo de nuevo.
  if (!(await page.evaluate(() => Boolean((window as any).__r3f)))) await abrir(page);
  return page.evaluate(async (pos) => {
    const s = () => (window as any).__s.getState();
    const ids: string[] = [];
    for (const p of pos) ids.push((await s().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position: p })).id);
    s().setSnapGridMm(0);
    s().setActiveTool('select');
    s().setTransformMode('translate');
    s().setSelection([]);
    s().dismissAllToasts();
    return ids;
  }, posiciones);
}
const pos = (page: Page, id: string) => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position as P3, id);
const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length as number);
const sel = (page: Page, ids: string[]) => page.evaluate((i) => (window as any).__s.getState().setSelection(i), ids);
async function vista(page: Page, cam: P3, mira: P3 = [0, 15, 0]) {
  await page.evaluate(([c, m]) => {
    const st = (window as any).__r3f.getState();
    st.camera.position.set(c[0], c[1], c[2]);
    st.camera.lookAt(m[0], m[1], m[2]);
    st.camera.updateMatrixWorld();
    st.controls?.update?.();
  }, [cam, mira] as const);
  await page.waitForTimeout(250);
}
const FRENTE: P3 = [0, 40, 500];
const SUPERIOR: P3 = [0, 600, 1];
const ISO: P3 = [300, 300, 300];

/** Arrastra desde la proyección de `desde`; devuelve el texto del rótulo visto a mitad del gesto. */
async function arrastrar(page: Page, desde: P3, dx: number, dy: number, o: { teclas?: string[]; soltar?: boolean } = {}) {
  const a = await aPixel(page, desde);
  await page.mouse.move(a.x, a.y);
  for (const k of o.teclas ?? []) await page.keyboard.down(k);
  await page.mouse.down();
  await page.mouse.move(a.x + dx * 0.4, a.y + dy * 0.4, { steps: 4 });
  await page.mouse.move(a.x + dx, a.y + dy, { steps: 6 });
  const rotulo = (await page.getByTestId('gizmo-drag-readout').count()) ? await page.getByTestId('gizmo-drag-readout').innerText() : '';
  if (o.soltar !== false) {
    await page.mouse.up();
    for (const k of o.teclas ?? []) await page.keyboard.up(k);
  }
  return rotulo;
}
const sinErr = (e: string[]) => e.filter((x) => !/favicon|WebGL|GPU/i.test(x));

test('vista Frente: mueve en ancho y alto, no en profundidad, y no baja de la cama; un Ctrl+Z', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const [a] = await escena(page, [[0, 60, 0]]);
  await sel(page, [a]);
  await vista(page, FRENTE);
  const n0 = await pasos(page);
  const rot = await arrastrar(page, [0, 60, 0], 90, -40);
  await page.screenshot({ path: `${EV}/arrastre-frente-drag.png` });
  const p = await pos(page, a);
  console.log('QA25J frente', JSON.stringify(p), 'rótulo:', rot);
  expect(p[0]).toBeGreaterThan(20);
  expect(Math.abs(p[2]), 'sin profundidad').toBeLessThan(1);
  expect(p[1], 'sube con el arrastre hacia arriba').toBeGreaterThan(60);
  expect(rot, 'el vertical frontal se rotula con los ejes del usuario').toMatch(/Plano XZ/);
  expect(await pasos(page)).toBe(n0 + 1);
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect(await pos(page, a)).toEqual([0, 60, 0]);
  expect(sinErr(errs)).toEqual([]);
});

test('Superior e isométrica: plano horizontal; Alt fuerza el vertical; Mayús restringe a un eje', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await sel(page, [a]);
  await vista(page, SUPERIOR);
  let rot = await arrastrar(page, [0, 15, 0], 60, 50);
  let p = await pos(page, a);
  console.log('QA25J superior', JSON.stringify(p), rot);
  expect(p[1]).toBeCloseTo(15, 3);
  expect(Math.hypot(p[0], p[2])).toBeGreaterThan(10);
  expect(rot).toMatch(/Plano XY/); // el horizontal, con ejes de usuario (Z arriba)
  await page.evaluate(() => (window as any).__s.getState().undo());

  await vista(page, ISO);
  rot = await arrastrar(page, [0, 15, 0], 60, 30);
  p = await pos(page, a);
  console.log('QA25J iso', JSON.stringify(p), rot);
  expect(p[1]).toBeCloseTo(15, 3);
  await page.screenshot({ path: `${EV}/arrastre-iso-drag.png` });
  await page.evaluate(() => (window as any).__s.getState().undo());

  // Alt en isométrica: vertical -> cambia la altura (se sube el cursor).
  rot = await arrastrar(page, [0, 15, 0], 40, -60, { teclas: ['Alt'] });
  p = await pos(page, a);
  console.log('QA25J iso+Alt', JSON.stringify(p), rot);
  expect(p[1], 'Alt: cambia la altura').toBeGreaterThan(16);
  await page.evaluate(() => (window as any).__s.getState().undo());
  expect(await pos(page, a)).toEqual([0, 15, 0]);

  // Mayús: un solo eje cambia.
  await vista(page, SUPERIOR);
  const a0 = await aPixel(page, [0, 15, 0]);
  await page.mouse.move(a0.x, a0.y);
  await page.mouse.down();
  await page.mouse.move(a0.x + 30, a0.y + 8, { steps: 4 });
  await page.keyboard.down('Shift');
  await page.mouse.move(a0.x + 80, a0.y + 20, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  p = await pos(page, a);
  console.log('QA25J superior+Shift', JSON.stringify(p));
  const movidos = [p[0], p[2]].filter((v) => Math.abs(v) > 1).length;
  expect(movidos, 'Mayús restringe a un eje').toBe(1);
});

test('Esc cancela el arrastre (sin paso de historial) y la pieza vuelve', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await sel(page, [a]);
  await vista(page, SUPERIOR);
  const n0 = await pasos(page);
  await arrastrar(page, [0, 15, 0], 70, 40, { soltar: false });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await pos(page, a)).toEqual([0, 15, 0]);
  expect(await pasos(page)).toBe(n0);
  await expect(page.getByTestId('gizmo-drag-readout')).toHaveCount(0);
});

test('con 2 placas, soltar sobre la otra reasigna la pieza', async ({ page }) => {
  const [a] = await escena(page, [[0, 15, 0]]);
  await page.evaluate(() => (window as any).__s.getState().createPlate());
  const o2 = await page.evaluate(() => (window as any).__s.getState().plates[1].origin as number[]);
  const plateA0 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).plateRef, a);
  const bed = await page.evaluate(() => { const s = (window as any).__s.getState(); return s.plates[1].bed ?? null; });
  console.log('QA25J placas origen2', JSON.stringify(o2), 'cama2', JSON.stringify(bed), 'plateRef inicial', plateA0);
  await sel(page, [a]);
  const objetivo: P3 = [o2[0] + 30, 15, o2[1] + 30];
  await vista(page, [(objetivo[0]) / 2, 900, (objetivo[2]) / 2 + 1], [objetivo[0] / 2, 0, objetivo[2] / 2]);
  const desde = await aPixel(page, [0, 15, 0]);
  const hasta = await aPixel(page, objetivo);
  await arrastrar(page, [0, 15, 0], hasta.x - desde.x, hasta.y - desde.y);
  const r = await page.evaluate((i) => { const s = (window as any).__s.getState(); const o = s.objects.find((x: any) => x.id === i); return { pos: o.position, ref: o.plateRef, p2: s.plates[1].id }; }, a);
  console.log('QA25J reasignar', JSON.stringify(r));
  await page.screenshot({ path: `${EV}/arrastre-placas.png` });
  expect(r.ref, 'la pieza pasó a la placa 2').toBe(r.p2);
});

// DEFECTO (QA 26-nov J): en vista Frente, arrastrar un cubo de 30 mm muy hacia abajo lo deja con el centro en y=0 (15 mm bajo la
// cama); debería quedar con y >= 15. Se documenta con test.fail hasta que se corrija.
test.fail('vista Frente: arrastrar hacia abajo no hunde la pieza bajo la cama', async ({ page }) => {
  const [a] = await escena(page, [[0, 60, 0]]);
  await sel(page, [a]);
  await vista(page, FRENTE);
  await arrastrar(page, [0, 60, 0], 0, 500);
  const q = await pos(page, a);
  console.log('QA25J frente abajo', JSON.stringify(q));
  expect(q[1]).toBeGreaterThanOrEqual(14.99);
});
