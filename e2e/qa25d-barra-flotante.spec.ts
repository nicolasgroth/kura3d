/**
 * @file e2e/qa25d-barra-flotante.spec.ts
 * @description QA de la ronda 25-nov (D) de la barra flotante: no tapa la pieza (se proyectan vértices reales), no se
 * sale del visor ni tapa la barra de vista, también con un modelo grande y a 1024 px; la paleta de Color (muestra
 * activa, un Ctrl+Z por cambio, Escape y clic fuera la cierran, no se corta); «Más» + Escape devuelve el foco a «Más»;
 * se oculta con un panel de operación; Color deshabilitado con toda la selección bloqueada; Alt+. la enfoca.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir as abrirBase, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

/** Abre la web y enlaza el store de r3f (`__r3f`) para proyectar vértices a píxeles. */
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

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25d';
const barra = (page: Page) => page.getByTestId('floating-action-bar');
const REAL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';

/** Píxeles de página de hasta `n` vértices del objeto (con su transformación). */
async function vertices(page: Page, id: string, n = 2500): Promise<Array<[number, number]>> {
  return page.evaluate(([oid, max]) => {
    const st = (window as any).__r3f.getState();
    const cam = st.camera;
    cam.updateMatrixWorld();
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === oid);
    const V = cam.position.constructor, Eu = cam.rotation.constructor, Q = cam.quaternion.constructor;
    const q = new Q().setFromEuler(new Eu(o.rotation[0], o.rotation[1], o.rotation[2]));
    const r = st.gl.domElement.getBoundingClientRect();
    const P = o.mesh.positions as ArrayLike<number>;
    const total = P.length / 3;
    const paso = Math.max(1, Math.floor(total / (max as number)));
    const out: Array<[number, number]> = [];
    for (let i = 0; i < total; i += paso) {
      const v = new V(P[i * 3] * o.scale[0], P[i * 3 + 1] * o.scale[1], P[i * 3 + 2] * o.scale[2]).applyQuaternion(q);
      v.set(v.x + o.position[0], v.y + o.position[1], v.z + o.position[2]).project(cam);
      if (v.z > 1) continue;
      out.push([r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]);
    }
    return out;
  }, [id, n] as const);
}

type R = { x: number; y: number; width: number; height: number };
const dentro = (r: R, [x, y]: [number, number]) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
const cruzan = (a: R, b: R) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Comprueba que la barra no tapa vértices de la pieza, está dentro del visor y no pisa la barra de vista. */
async function revisarBarra(page: Page, id: string, etiqueta: string): Promise<string[]> {
  const fallos: string[] = [];
  await expect(barra(page)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(700);
  const b = (await barra(page).boundingBox())!;
  const visor = (await page.locator('.kura-viewport-wrap').boundingBox())!;
  if (b.x < visor.x - 1 || b.y < visor.y - 1 || b.x + b.width > visor.x + visor.width + 1 || b.y + b.height > visor.y + visor.height + 1) {
    fallos.push(`${etiqueta}: la barra se sale del visor ${JSON.stringify(b)} vs ${JSON.stringify(visor)}`);
  }
  const vb = page.locator('.kura-viewbar').first();
  if (await vb.count()) {
    const vbox = await vb.boundingBox();
    if (vbox && cruzan(b, vbox)) fallos.push(`${etiqueta}: la barra tapa la barra de vista ${JSON.stringify(vbox)} vs ${JSON.stringify(b)}`);
  }
  const vs = await vertices(page, id);
  const tapados = vs.filter((p) => dentro(b, p)).length;
  // Solo cuenta vértices dentro del visor (los que se ven).
  const visibles = vs.filter((p) => dentro(visor, p)).length;
  if (tapados > 0) fallos.push(`${etiqueta}: la barra tapa ${tapados} de ${visibles} vértices visibles`);
  await page.screenshot({ path: `${EV}/barra-${etiqueta}.png` });
  return fallos;
}

for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`barra ${vp.width}: no tapa la pieza en varias vistas y posiciones`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(vp);
    const errs = await abrir(page);
    const fallos: string[] = [];
    const caja = (await cmd(page, 'create_primitive', { type: 'box', width: 60, height: 30, depth: 40, name: 'Caja' })).id as string;
    const lejos = (await cmd(page, 'create_primitive', { type: 'sphere', radius: 15, name: 'Lejana', position: [-130, 0, 15] })).id as string;
    const lejos2 = (await cmd(page, 'create_primitive', { type: 'sphere', radius: 15, name: 'Lejana2', position: [130, 60, 15] })).id as string;
    for (const id of [caja, lejos, lejos2]) {
      await seleccionar(page, [id]);
      for (const preset of ['iso', 'fit', 'scene', 'top', 'front']) {
        await page.evaluate((p) => (window as any).__s.getState().requestCameraPreset(p), preset);
        await page.waitForTimeout(900);
        if (!(await barra(page).count())) { console.log('QA25D barra ausente en', preset); continue; }
        fallos.push(...(await revisarBarra(page, id, `${vp.width}-${id.slice(0, 4)}-${preset}`)));
      }
    }
    console.log('QA25D barra fallos', JSON.stringify(fallos, null, 1));
    expect(fallos, fallos.join('\n')).toEqual([]);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('barra con la ocarina real a 1024: no tapa la pieza', async ({ page }) => {
  test.skip(!existsSync(REAL), 'sin modelo real');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(REAL);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 120_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  await seleccionar(page, [id]);
  const fallos: string[] = [];
  for (const preset of ['iso', 'fit', 'top']) {
    await page.evaluate((p) => (window as any).__s.getState().requestCameraPreset(p), preset);
    await page.waitForTimeout(900);
    fallos.push(...(await revisarBarra(page, id, `real-${preset}`)));
  }
  console.log('QA25D barra real fallos', JSON.stringify(fallos));
  expect(fallos, fallos.join('\n')).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('barra: paleta de color (activa marcada, un paso por cambio, Escape, clic fuera, sin cortarse)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const id = (await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 40, depth: 40, name: 'Caja', color: '#38bdf8' })).id as string;
  await seleccionar(page, [id]);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  const color = barra(page).getByRole('button', { name: 'Color' });
  await expect(color).toBeVisible();
  await color.click();
  const pal = page.getByTestId('floating-bar-palette');
  await expect(pal).toBeVisible();
  const r = (await pal.boundingBox())!;
  const visor = (await page.locator('.kura-viewport-wrap').boundingBox())!;
  console.log('QA25D paleta', JSON.stringify(r), 'visor', JSON.stringify(visor));
  expect(r.x).toBeGreaterThanOrEqual(visor.x - 1);
  expect(r.x + r.width).toBeLessThanOrEqual(visor.x + visor.width + 1);
  expect(r.y + r.height).toBeLessThanOrEqual(visor.y + visor.height + 1);
  expect(r.y).toBeGreaterThanOrEqual(visor.y - 1);
  await page.screenshot({ path: `${EV}/barra-paleta.png` });
  const pulsadas = await pal.locator('[aria-pressed="true"]').count();
  console.log('QA25D muestras activas', pulsadas);
  const muestras = pal.locator('.kura-floating-bar-swatch');
  const n = await muestras.count();
  expect(n).toBeGreaterThan(4);
  // Elegir una muestra distinta de la activa: un paso.
  const colorDe = () => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).color as string, id);
  const c0 = await colorDe();
  const p0 = await pasos(page);
  let elegida = -1;
  for (let i = 0; i < n; i += 1) if ((await muestras.nth(i).getAttribute('aria-pressed')) !== 'true') { elegida = i; break; }
  await muestras.nth(elegida).click();
  await expect(pal).toHaveCount(0);
  const c1 = await colorDe();
  expect(c1).not.toBe(c0);
  expect(await pasos(page)).toBe(p0 + 1);
  await expect(color).toBeFocused();
  // Reabrir: la muestra elegida queda marcada.
  await color.click();
  await expect(pal.locator('[aria-pressed="true"]')).toHaveCount(1);
  // Segundo cambio = otro paso, y Ctrl+Z deshace de a uno.
  const otra = pal.locator('.kura-floating-bar-swatch[aria-pressed="false"]').first();
  await otra.click();
  expect(await pasos(page)).toBe(p0 + 2);
  await page.keyboard.press('Control+z');
  await expect.poll(colorDe).toBe(c1);
  await page.keyboard.press('Control+z');
  await expect.poll(colorDe).toBe(c0);
  // Escape cierra y devuelve el foco a Color.
  await seleccionar(page, [id]);
  await color.click();
  await expect(pal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pal).toHaveCount(0);
  await expect(color).toBeFocused();
  // Clic fuera la cierra.
  await color.click();
  await expect(pal).toBeVisible();
  await page.mouse.click(visor.x + 40, visor.y + visor.height - 60);
  await expect(pal).toHaveCount(0);
  // «Otro color…» existe.
  await seleccionar(page, [id]);
  if (!(await pal.count())) await color.click();
  await expect(pal.getByRole('button', { name: /Otro color/ })).toBeVisible();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('barra: Más + Escape devuelve el foco a Más; Alt+. enfoca; se oculta con un panel; Color deshabilitado si está todo bloqueado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const id = (await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 40, depth: 40, name: 'Caja' })).id as string;
  await seleccionar(page, [id]);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  await expect(barra(page)).toBeVisible();
  // Alt+. enfoca la barra.
  await page.locator('.kura-viewport-wrap canvas').focus();
  await page.keyboard.press('Alt+.');
  await expect(barra(page).locator('button:focus')).toHaveCount(1);
  // Más con teclado + Escape.
  const mas = barra(page).getByRole('button', { name: 'Más' });
  await mas.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(barra(page)).toBeVisible();
  await expect(mas).toBeFocused({ timeout: 5_000 });
  // Bloquear todo: Color deshabilitado.
  await barra(page).getByRole('button', { name: /Bloquear/ }).click();
  const color = barra(page).getByRole('button', { name: 'Color' });
  await expect(color).toHaveAttribute('aria-disabled', 'true');
  await color.click({ force: true });
  await expect(page.getByTestId('floating-bar-palette')).toHaveCount(0);
  await page.screenshot({ path: `${EV}/barra-color-bloqueado.png` });
  await barra(page).getByRole('button', { name: /Desbloquear/ }).click();
  // Paneles de colocación de agregados: la barra se oculta (regla única).
  for (const nombre of [/^Alojamiento de imán/, /^Torreta para tornillo/, /^Paso de cable/, /^Colgar en el muro/]) {
    await seleccionar(page, [id]);
    await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
    await page.getByRole('menuitem', { name: nombre }).click();
    await page.waitForTimeout(700);
    const visible = await barra(page).count();
    console.log('QA25D barra con panel de colocación', String(nombre), 'visible=', visible);
    await page.screenshot({ path: `${EV}/barra-colocacion-${String(nombre).replace(/\W/g, '').slice(0, 12)}.png` });
    expect(visible, `la barra sigue con ${nombre}`).toBe(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await seleccionar(page, [id]);
  }
  // Paneles del inspector (Suavizar, Orientar): observación; la regla vigente solo cubre `activeDialog` y colocación.
  for (const accion of ['Suavizar…', 'Orientar para imprimir…']) {
    await (await itemAccion(page, accion)).click();
    await page.waitForTimeout(600);
    console.log('QA25D OBS barra con panel del inspector', accion, 'visible=', await barra(page).count());
    await page.keyboard.press('Escape');
  }
  expect(errs, errs.join('\n')).toEqual([]);
});
