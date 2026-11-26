/**
 * @file e2e/qa25e-placas-arrastre.spec.ts
 * @description QA 25-nov (E): arrastrar una pieza de la placa 1 a la placa 2 con coordenadas de pantalla calculadas
 * proyectando la escena (no fijas): reasigna la placa, la placa activa cambia al soltar, un solo Ctrl+Z lo deshace
 * y Escape a mitad del arrastre cancela sin dejar la pieza reasignada. Evidencia en `.eval-tmp/qa25e/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir as abrirBase, cmd, libre } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25e';

async function abrir(page: Page): Promise<string[]> {
  const errs = await abrirBase(page);
  await page.evaluate(async () => {
    const w = window as any;
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /react-three_fiber/.test(n));
    for (const u of urls) {
      const m = await import(/* @vite-ignore */ u);
      if (m._roots) w.__r3f = [...m._roots.values()][0].store;
    }
  });
  return errs;
}

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

/** Píxel de página de un punto de mundo, con la cámara ya quieta. */
async function aPixel(page: Page, p: [number, number, number]): Promise<[number, number]> {
  return page.evaluate(([x, y, z]) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const v = new cam.position.constructor(x, y, z).project(cam);
    const r = st.gl.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height] as [number, number];
  }, p);
}

/** Espera a que la cámara deje de moverse (dos lecturas iguales). */
async function camaraQuieta(page: Page): Promise<void> {
  let prev = '';
  for (let i = 0; i < 40; i += 1) {
    const cur = await page.evaluate(() => (window as any).__r3f.getState().camera.matrixWorld.elements.map((n: number) => n.toFixed(3)).join());
    if (cur === prev) return;
    prev = cur;
    await page.waitForTimeout(250);
  }
}

async function preparar(page: Page) {
  await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo A', position: [0, 0, 0] });
  await S(page, (s) => s.createPlate());
  await cmd(page, 'create_primitive', { type: 'sphere', radius: 15, name: 'Esfera B' });
  await S(page, (s) => s.setSelection([]));
  await page.getByRole('toolbar', { name: 'Vista' }).getByRole('button', { name: 'Vista superior' }).click();
  await page.getByRole('button', { name: 'Encuadrar' }).click();
  await page.waitForTimeout(800);
  await camaraQuieta(page);
  const info = await S(page, (s) => ({
    a: s.objects.find((o: any) => o.name === 'Cubo A').position as number[],
    o2: s.plates[1].origin as number[],
    p1: s.plates[0].id as string, p2: s.plates[1].id as string,
  }));
  return info;
}

async function arrastrar(page: Page, de: [number, number], a: [number, number], soltar = true) {
  await page.mouse.move(de[0], de[1]);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1) await page.mouse.move(de[0] + ((a[0] - de[0]) * i) / 14, de[1] + ((a[1] - de[1]) * i) / 14);
  await page.waitForTimeout(200);
  if (soltar) {
    await page.mouse.up();
    await page.waitForTimeout(600);
  }
}

const estado = (page: Page) => S(page, (s) => ({
  ref: s.objects.find((o: any) => o.name === 'Cubo A').plateRef as string,
  x: s.objects.find((o: any) => o.name === 'Cubo A').position[0] as number,
  activa: s.activePlateId as string | undefined,
  past: s.past.length as number,
  sel: s.selectedIds.length as number,
}));

test.use({ viewport: { width: 1440, height: 900 } });

test('arrastrar de la placa 1 a la 2 (coordenadas proyectadas): reasigna, activa la 2 y un Ctrl+Z lo deshace', async ({ page }) => {
  const errs = await abrir(page);
  const { a, o2, p1, p2 } = await preparar(page);
  const de = await aPixel(page, [a[0], a[1], a[2]]);
  const a2 = await aPixel(page, [o2[0] - 30, a[1], a[2]]);
  await page.mouse.click(de[0], de[1]);
  const antes = await estado(page);
  expect(antes.sel, 'el clic sobre el cubo debe seleccionarlo').toBe(1);
  await arrastrar(page, de, a2, false);
  const durante = await estado(page);
  console.log('QA25E durante', JSON.stringify(durante), 'p1', p1, 'p2', p2);
  await page.screenshot({ path: `${EV}/arrastre-durante.png` });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const despues = await estado(page);
  console.log('QA25E despues', JSON.stringify(despues));
  await page.screenshot({ path: `${EV}/arrastre-despues.png` });
  expect(despues.ref, JSON.stringify({ antes, durante, despues })).toBe(p2);
  expect(despues.activa).toBe(p2);
  expect(despues.past).toBe(antes.past + 1);
  await page.keyboard.press('Control+z');
  const deshecho = await estado(page);
  expect(deshecho.ref).toBe(p1);
  expect(deshecho.x).toBeCloseTo(a[0], 3);
  await page.keyboard.press('Control+Shift+z');
  expect((await estado(page)).ref).toBe(p2);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('Escape a mitad del arrastre no deja la pieza reasignada ni pasos de historial', async ({ page }) => {
  const errs = await abrir(page);
  const { a, o2, p1 } = await preparar(page);
  const de = await aPixel(page, [a[0], a[1], a[2]]);
  const a2 = await aPixel(page, [o2[0] - 30, a[1], a[2]]);
  await page.mouse.click(de[0], de[1]);
  const antes = await estado(page);
  await arrastrar(page, de, a2, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(600);
  const fin = await estado(page);
  console.log('QA25E esc', JSON.stringify({ antes, fin }));
  expect(fin.ref, JSON.stringify({ antes, fin })).toBe(p1);
  expect(fin.x).toBeCloseTo(a[0], 3);
  expect(fin.past).toBe(antes.past);
  await libre(page);
  expect(errs, errs.join('\n')).toEqual([]);
});
