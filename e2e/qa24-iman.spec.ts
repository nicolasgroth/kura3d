/**
 * @file e2e/qa24-iman.spec.ts
 * @description QA24 del alojamiento de imán: entradas (escena vacía, solo negativos, pieza oculta o bloqueada),
 * colocación sobre caras inclinadas, escaladas, curvas e inferiores (vista previa = creado, a ras y perpendicular),
 * resta con volumen exacto, pared mínima, medidas inválidas, preajustes y su almacenamiento, exclusión con otros
 * paneles, agrupado con la pieza anfitriona, deshacer/rehacer y consola sin errores.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, aPixel } from './qa12-helpers';

type P3 = [number, number, number];
const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/qa24';

const getState = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  return {
    objects: s.objects.map((o: any) => ({
      id: o.id, name: o.name, role: o.role, visible: o.visible, locked: o.locked, position: o.position, rotation: o.rotation,
      scale: o.scale, addon: o.metadata?.addon ?? null, volume: o.stats.volumeMm3, manifold: o.stats.isManifold,
    })),
    past: s.past.length as number,
    busy: s.busyOperation as string | null,
    groups: s.groups,
  };
});

/** Espera a que el visor dibuje `n` cuadros: el ratón y la cámara se asientan sin un tiempo fijo. */
const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);

const libre = (page: Page) => expect.poll(async () => (await getState(page)).busy, { timeout: 20_000 }).toBeNull();

const crear = (page: Page, type: string, params: any, opts: any = {}) => page.evaluate(async ({ type, params, opts }) => {
  const s = () => (window as any).__s.getState();
  const o = await s().createPrimitive(type, params, opts);
  s().setSelection([]);
  s().dismissAllToasts?.();
  return o.id as string;
}, { type, params, opts });

const bbox = (page: Page, id: string) => page.evaluate((id) => {
  const o = (window as any).__s.getState().objects.find((x: any) => x.id === id);
  const p = o.mesh.positions; const [sx, sy, sz] = o.scale; const [rx, ry, rz] = o.rotation;
  const cx = Math.cos(rx), sxn = Math.sin(rx), cy = Math.cos(ry), syn = Math.sin(ry), cz = Math.cos(rz), szn = Math.sin(rz);
  const R = [
    [cy * cz, -cy * szn, syn],
    [cx * szn + sxn * syn * cz, cx * cz - sxn * syn * szn, -sxn * cy],
    [sxn * szn - cx * syn * cz, sxn * cz + cx * syn * szn, cx * cy],
  ];
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) {
    const v = [p[i] * sx, p[i + 1] * sy, p[i + 2] * sz];
    for (let a = 0; a < 3; a++) {
      const w = R[a][0] * v[0] + R[a][1] * v[1] + R[a][2] * v[2] + o.position[a];
      if (w < mn[a]) mn[a] = w;
      if (w > mx[a]) mx[a] = w;
    }
  }
  return { min: mn, max: mx, center: mn.map((v, i) => (v + mx[i]) / 2), size: mn.map((v, i) => mx[i] - v) };
}, id);

async function camara(page: Page, target: P3, dir: P3, dist = 220) {
  await page.evaluate(({ target, dir, dist }) => {
    const r = (window as any).__r3f.getState();
    const n = Math.hypot(...dir);
    r.camera.position.set(target[0] + dir[0] / n * dist, target[1] + dir[1] / n * dist, target[2] + dir[2] / n * dist);
    r.camera.lookAt(target[0], target[1], target[2]);
    r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(target[0], target[1], target[2]);
    r.controls?.update?.();
  }, { target, dir, dist });
  await cuadros(page, 3);
}

async function abrirPanel(page: Page) {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toBeVisible();
}

const hoverState = (page: Page) => page.evaluate(async () => {
  const { useMagnetPanel } = await import('/src/store/magnetPanel.ts');
  const h = useMagnetPanel.getState().hover;
  return h ? { hostId: h.hostId, point: [...h.point], normal: [...h.normal] } as { hostId: string; point: P3; normal: P3 } : null;
});

async function apuntar(page: Page, target: P3, offset: [number, number] = [0, 0]) {
  const a = await aPixel(page, target);
  await page.mouse.move(a.x + offset[0] - 5, a.y + offset[1] - 5);
  await page.mouse.move(a.x + offset[0], a.y + offset[1], { steps: 4 });
  await cuadros(page, 3);
  return { x: a.x + offset[0], y: a.y + offset[1] };
}

async function clicAqui(page: Page) {
  await page.mouse.down();
  await page.mouse.up();
  await libre(page);
}

const errores: string[] = [];
test.beforeEach(({ page }) => {
  errores.length = 0;
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(String(e)));
});
test.afterEach(() => {
  const reales = errores.filter((e) => !/favicon|Download the React DevTools/.test(e));
  expect(reales, `consola: ${reales.join(' | ')}`).toEqual([]);
});

/** Eje del negativo (Y local girado por Euler XYZ). */
const ejeDe = (rot: P3): P3 => {
  const [rx, ry, rz] = rot;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [-cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz];
};
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Coloca sobre la cara bajo `target` y comprueba coherencia vista previa / creado; devuelve hover y negativo. */
async function colocarYVerificar(page: Page, host: string, target: P3, profundidad = 2.2) {
  await apuntar(page, target);
  const h = await hoverState(page);
  expect(h, 'hay vista previa bajo el cursor').not.toBeNull();
  expect(h!.hostId).toBe(host);
  expect(Math.hypot(...h!.normal)).toBeCloseTo(1, 3);
  const before = (await getState(page)).objects.length;
  await clicAqui(page);
  await expect.poll(async () => (await getState(page)).objects.length).toBe(before + 1);
  const s = await getState(page);
  const last = s.objects.filter((o: any) => o.role === 'negative').slice(-1)[0];
  const axis = ejeDe(last.rotation);
  // Perpendicular: el eje del negativo coincide con la normal de la vista previa.
  expect(dot(axis, h!.normal), 'eje del negativo = normal de la cara').toBeGreaterThan(0.9995);
  // A ras: base + eje * profundidad(2.2) = punto bajo el cursor.
  const tip = last.position.map((v: number, i: number) => v + axis[i] * profundidad);
  const err = Math.hypot(tip[0] - h!.point[0], tip[1] - h!.point[1], tip[2] - h!.point[2]);
  expect(err, 'boca del hueco sobre el punto de la vista previa').toBeLessThan(0.15);
  return { h: h!, neg: last };
}

test('01 entradas sin pieza sólida: escena vacía, solo negativos, ocultas y bloqueadas', async ({ page }) => {
  await abrir(page);
  const abre = async () => {
    await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
    await page.getByRole('menuitem', { name: /^Alojamiento de imán/ }).click();
  };
  await abre();
  await expect(page.getByText(/necesitas al menos una pieza sólida/)).toBeVisible();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);

  await crear(page, 'box', { width: 20, height: 20, depth: 20 }, { role: 'negative' });
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  await abre();
  await expect(page.getByText(/necesitas al menos una pieza sólida/).first()).toBeVisible();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);

  const solid = await crear(page, 'box', { width: 20, height: 20, depth: 20 });
  await page.evaluate((id) => (window as any).__s.getState().updateObjectMeta(id, { visible: false }), solid);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  await abre();
  await expect(page.getByText(/necesitas al menos una pieza sólida/).first()).toBeVisible();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);

  // Pieza bloqueada: no abre el panel y avisa por qué (no hay dónde colocar).
  await page.evaluate((id) => (window as any).__s.getState().updateObjectMeta(id, { visible: true, locked: true }), solid);
  await page.evaluate(() => (window as any).__s.getState().dismissAllToasts?.());
  await abre();
  await expect(page.getByText(/necesitas al menos una pieza sólida/).first()).toBeVisible();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/01-bloqueada.png` });
});

test('02 colocación: pieza rotada y escalada no uniforme, cara inferior, esfera', async ({ page }) => {
  await abrir(page);
  const caja = await crear(page, 'box', { width: 30, height: 30, depth: 30 }, { rotation: [0.4, 0.5, 0.3], scale: [1, 2, 0.6] });
  let bb = await bbox(page, caja);
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.6, 0.9, 1.1]);
  await colocarYVerificar(page, caja, bb.center as P3);
  await camara(page, bb.center as P3, [-1, 0.3, -0.5]);
  await colocarYVerificar(page, caja, bb.center as P3);
  await camara(page, bb.center as P3, [0.05, -1, 0.05]);
  await colocarYVerificar(page, caja, bb.center as P3);
  await page.screenshot({ path: `${SHOTS}/02-caja-rotada.png` });
  await page.keyboard.press('Escape');

  await page.evaluate(() => (window as any).__s.getState().clearScene?.());
  const esf = await crear(page, 'sphere', { radius: 20 }, { position: [0, 0, 0] });
  bb = await bbox(page, esf);
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.7, 0.5, 0.8]);
  const r1 = await colocarYVerificar(page, esf, bb.center as P3);
  const dist = Math.hypot(r1.h.point[0] - bb.center[0], r1.h.point[1] - bb.center[1], r1.h.point[2] - bb.center[2]);
  expect(Math.abs(dist - 20)).toBeLessThan(0.3);
  await page.keyboard.press('Escape');
});

const HOLE_ROUND = (d: number, depth: number) => 64 * (d / 2) ** 2 * Math.tan(Math.PI / 64) * depth;

/** Volumen firmado y caja de un STL binario o ASCII (Buffer). */
function leerStl(buf: Buffer) {
  const n = buf.readUInt32LE(80);
  if (84 + n * 50 !== buf.length) throw new Error(`STL no binario (${buf.length} bytes, ${n} triángulos)`);
  let vol = 0;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    const v: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const p = [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)];
      v.push(p);
      for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p[a]); mx[a] = Math.max(mx[a], p[a]); }
    }
    vol += (v[0][0] * (v[1][1] * v[2][2] - v[1][2] * v[2][1]) - v[0][1] * (v[1][0] * v[2][2] - v[1][2] * v[2][0]) + v[0][2] * (v[1][0] * v[2][1] - v[1][1] * v[2][0])) / 6;
  }
  return { tris: n, volume: Math.abs(vol), size: mn.map((m, i) => mx[i] - m) };
}

async function exportarStl(page: Page, file: string) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^STL/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  await (await dl).saveAs(file);
}

test('03 restas: volumen exacto, sólido válido, STL sin el negativo y reimportación', async ({ page }) => {
  test.setTimeout(180_000);
  const { mkdtempSync } = await import('node:fs');
  const { readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  await abrir(page);
  const host = await crear(page, 'box', { width: 30, height: 30, depth: 30 });
  const bb = await bbox(page, host);
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  await colocarYVerificar(page, host, bb.center as P3);
  await camara(page, bb.center as P3, [1, 0.02, 0.05]);
  await colocarYVerificar(page, host, [bb.center[0], bb.center[1] + 5, bb.center[2]]);
  await page.keyboard.press('Escape');

  // El negativo no se exporta como pieza: el STL trae solo el cubo (27000 mm³).
  const dir = mkdtempSync(join(tmpdir(), 'qa24-'));
  const stlAntes = join(dir, 'antes.stl');
  await exportarStl(page, stlAntes);
  const a = leerStl(readFileSync(stlAntes));
  expect(Math.abs(a.volume - 27000)).toBeLessThan(1);

  const vol0 = (await getState(page)).objects.find((o: any) => o.id === host).volume;
  await page.evaluate(async () => { const x = (window as any).__s.getState(); x.setSelection([]); await x.applyHolesOnSolids(); });
  await libre(page);
  const s = await getState(page);
  expect(s.objects.filter((o: any) => o.role === 'negative')).toHaveLength(0);
  expect(s.objects).toHaveLength(1);
  const solido = s.objects[0];
  expect(solido.manifold).toBe(true);
  const esperado = 2 * HOLE_ROUND(5.2, 2.2);
  const removido = vol0 - solido.volume;
  expect(Math.abs(removido - esperado) / esperado).toBeLessThan(0.01);

  const stl = join(dir, 'despues.stl');
  await exportarStl(page, stl);
  const b = leerStl(readFileSync(stl));
  expect(Math.abs(b.volume - solido.volume) / solido.volume).toBeLessThan(0.002);
  expect(b.size.map((v) => Math.round(v * 10) / 10)).toEqual([30, 30, 30]);

  // Reimporta y compara.
  await page.getByRole('button', { name: 'Vaciar cama' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vaciar cama' }).click();
  await expect.poll(async () => (await getState(page)).objects.length).toBe(0);
  const ch = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  (await ch).setFiles(stl);
  await expect.poll(async () => (await getState(page)).objects.length, { timeout: 30000 }).toBe(1);
  await cuadros(page);
  await libre(page);
  const r = (await getState(page)).objects[0];
  expect(Math.abs(r.volume - solido.volume) / solido.volume).toBeLessThan(0.002);
  expect(r.manifold).toBe(true);
});

test('04 pared mínima: placa de 3 mm avisa, placa de 2 mm atraviesa, hueco pegado al borde', async ({ page }) => {
  await abrir(page);
  const toasts = () => page.evaluate(() => (window as any).__s.getState().toasts?.map((t: any) => t.message ?? t.text) ?? []);
  const placa = async (h: number) => {
    await page.evaluate(() => (window as any).__s.getState().clearScene?.());
    const id = await crear(page, 'box', { width: 40, height: h, depth: 40 });
    return { id, bb: await bbox(page, id) };
  };
  // 3 mm: queda 0,8 mm de fondo.
  let p = await placa(3);
  await abrirPanel(page);
  await camara(page, p.bb.center as P3, [0.05, 1, 0.05]);
  await colocarYVerificar(page, p.id, p.bb.center as P3);
  let wall = await page.getByTestId('magnet-wall').innerText();
  expect(wall).toMatch(/0,8/);
  expect(wall).toMatch(/1,2/);
  await page.screenshot({ path: `${SHOTS}/04-placa3.png` });
  await page.keyboard.press('Escape');

  // 2 mm: el hueco de 2,2 atraviesa.
  p = await placa(2);
  await abrirPanel(page);
  await camara(page, p.bb.center as P3, [0.05, 1, 0.05]);
  await colocarYVerificar(page, p.id, p.bb.center as P3);
  wall = await page.getByTestId('magnet-wall').innerText();
  expect(wall.toLowerCase()).toMatch(/atraviesa|asoma/);
  await page.keyboard.press('Escape');

  // Placa gruesa, hueco pegado al borde (a 1 mm del borde: pared lateral < 1,2).
  p = await placa(10);
  await abrirPanel(page);
  await camara(page, p.bb.center as P3, [0.05, 1, 0.05]);
  const borde: P3 = [p.bb.max[0] - 3.6, p.bb.max[1], p.bb.center[2]];
  await colocarYVerificar(page, p.id, borde);
  wall = await page.getByTestId('magnet-wall').innerText();
  expect(wall).toMatch(/pared/i);
  expect(wall, 'hueco a ~1 mm del borde debe avisar pared fina').toMatch(/menos|poca|fina|mínim/i);
  void toasts;
});

const campo = (page: Page, nombre: RegExp | string) => page.locator('.kura-magnet-panel').getByLabel(nombre, { exact: false }).first();
async function escribir(page: Page, nombre: RegExp | string, valor: string) {
  const c = campo(page, nombre);
  await c.click();
  await c.press('Control+a');
  await c.fill(valor);
  await c.press('Tab');
}

/** Coloca un oculto bajo el cursor (el techo del hueco queda 0,6 mm bajo la cara). */
async function colocarYVerificarOculto(page: Page, host: string) {
  const h = await hoverState(page);
  expect(h).not.toBeNull();
  const antes = (await getState(page)).objects.length;
  await clicAqui(page);
  await expect.poll(async () => (await getState(page)).objects.length).toBe(antes + 1);
  const neg = (await getState(page)).objects.filter((o: any) => o.role === 'negative').slice(-1)[0];
  const axis = ejeDe(neg.rotation);
  const tip = neg.position.map((v: number, i: number) => v + axis[i] * 2.2);
  const prof = (h!.point[0] - tip[0]) * axis[0] + (h!.point[1] - tip[1]) * axis[1] + (h!.point[2] - tip[2]) * axis[2];
  expect(Math.abs(prof - 0.6)).toBeLessThan(0.15);
  expect(neg.addon.hostId).toBe(host);
  return neg.addon;
}

test('05 medidas: rangos, coma decimal, inválidos bloquean, holguras, cuadrado y oculto', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  const host = await crear(page, 'box', { width: 40, height: 40, depth: 40 });
  const bb = await bbox(page, host);
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  const resumen = page.getByTestId('magnet-summary');
  const nObj = async () => (await getState(page)).objects.length;
  const base = await nObj();

  for (const malo of ['0', '-3', 'abc', '61', '0,4']) {
    await escribir(page, /^Diámetro/, malo);
    const invalido = await campo(page, /^Diámetro/).getAttribute('aria-invalid');
    expect(invalido, `"${malo}" debe marcarse inválido`).toBe('true');
    await apuntar(page, bb.center as P3);
    await page.mouse.down();
    await page.mouse.up();
    await cuadros(page);
    await libre(page);
    expect(await nObj(), `con "${malo}" no se coloca`).toBe(base);
  }
  await escribir(page, /^Diámetro/, '1');
  expect(await campo(page, /^Diámetro/).getAttribute('aria-invalid')).not.toBe('true');
  await escribir(page, /^Diámetro/, '60');
  expect(await campo(page, /^Diámetro/).getAttribute('aria-invalid')).not.toBe('true');
  await expect(resumen).toHaveText('Hueco: Ø 60,2 × 2,2 mm');
  await escribir(page, /^Diámetro/, '6,5');
  await expect(resumen).toHaveText('Hueco: Ø 6,7 × 2,2 mm');
  await escribir(page, /^Holgura de ancho/, '0');
  await escribir(page, /^Holgura de profundidad/, '0');
  await expect(resumen).toHaveText('Hueco: Ø 6,5 × 2 mm');
  await escribir(page, /^Holgura de ancho/, '0,6');
  await escribir(page, /^Holgura de profundidad/, '0,6');
  await expect(resumen).toHaveText('Hueco: Ø 7,1 × 2,6 mm');
  await escribir(page, /^Holgura de ancho/, '0,61');
  expect(await campo(page, /^Holgura de ancho/).getAttribute('aria-invalid'), '0,61 inválido').toBe('true');
  await escribir(page, /^Holgura de ancho/, '0,6');

  await page.getByTestId('magnet-shape-square').click();
  await expect(resumen).toHaveText('Hueco: 7,1 × 7,1 × 2,6 mm');
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  const r = await colocarYVerificar(page, host, bb.center as P3, 2.6);
  const neg = (await getState(page)).objects.find((o: any) => o.id === r.neg.id);
  expect(neg.addon.params).toMatchObject({ shape: 'square', sizeMm: 6.5, clearanceMm: 0.6, depthClearanceMm: 0.6, hidden: false });

  await page.getByTestId('magnet-hidden').check();
  await page.getByTestId('magnet-shape-round').click();
  await escribir(page, /^Diámetro/, '5');
  await escribir(page, /^Holgura de ancho/, '0,2');
  await escribir(page, /^Holgura de profundidad/, '0,2');
  await apuntar(page, bb.center as P3, [60, 0]);
  const params = await colocarYVerificarOculto(page, host);
  expect(params.params.hidden).toBe(true);
  await page.keyboard.press('Escape');

  const vol0 = (await getState(page)).objects.find((o: any) => o.id === host).volume;
  await page.evaluate(async () => { const x = (window as any).__s.getState(); x.setSelection([]); await x.applyHolesOnSolids(); });
  await libre(page);
  const s = await getState(page);
  expect(s.objects).toHaveLength(1);
  const esperado = 7.1 * 7.1 * 2.6 + HOLE_ROUND(5.2, 2.2);
  const quitado = vol0 - s.objects[0].volume;
  expect(Math.abs(quitado - esperado) / esperado).toBeLessThan(0.01);
  expect(s.objects[0].manifold).toBe(true);
});

test('06 preajustes: incluidos, guardar propio, nombres raros, eliminar, recargar, tope y localStorage', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  await page.evaluate(() => localStorage.removeItem('kura3d-presets-magnet'));
  await crear(page, 'box', { width: 40, height: 40, depth: 40 });
  await abrirPanel(page);
  const sel = page.getByTestId('magnet-preset');
  const resumen = page.getByTestId('magnet-summary');
  await sel.selectOption({ label: 'Redondo 10 × 3' });
  await expect(resumen).toHaveText('Hueco: Ø 10,2 × 3,2 mm');
  await expect(page.getByTestId('magnet-preset-delete')).toBeDisabled();

  const nombre = page.getByTestId('magnet-preset-name');
  const guardar = page.getByTestId('magnet-preset-save');
  const alerta = page.locator('.kura-magnet-panel [role="alert"]');
  await guardar.click();
  await expect(alerta).toBeVisible();
  await nombre.fill('     ');
  await guardar.click();
  await expect(alerta).toBeVisible();
  await nombre.fill('X'.repeat(300));
  await guardar.click();
  await expect(alerta).toBeVisible();
  await nombre.fill('N'.repeat(40));
  await guardar.click();
  await expect(sel.locator('option', { hasText: 'N'.repeat(40) })).toHaveCount(1);
  const raro = '<img src=x onerror=alert(1)> "q" 🧲 ñ';
  await page.getByTestId('magnet-shape-square').click();
  await nombre.fill(raro);
  await guardar.click();
  await expect(page.locator('.kura-magnet-panel img')).toHaveCount(0);
  await page.getByTestId('magnet-shape-round').click();
  await nombre.fill('n'.repeat(40));
  await guardar.click();
  const guardado = await page.evaluate(() => localStorage.getItem('kura3d-presets-magnet'));
  const lista = JSON.parse(guardado!);
  expect(lista).toHaveLength(2);
  for (const p of lista) expect(Object.keys(p).sort()).toEqual(['id', 'name', 'values']);
  expect(Object.keys(lista[0].values).sort()).toEqual(['clearanceMm', 'depthClearanceMm', 'heightMm', 'hidden', 'shape', 'sizeMm']);
  const claves = await page.evaluate(() => Object.keys(localStorage).filter((k) => /magnet|iman|imán/i.test(k)));
  expect(claves).toEqual(['kura3d-presets-magnet']);

  await page.reload();
  await abrir(page);
  await crear(page, 'box', { width: 40, height: 40, depth: 40 });
  await abrirPanel(page);
  const propios = page.getByTestId('magnet-preset').locator('optgroup[label="Mis preajustes"] option');
  await expect(propios).toHaveCount(2);
  await page.getByTestId('magnet-preset').selectOption((await propios.first().getAttribute('value')) as string);
  await expect(page.getByTestId('magnet-preset-delete')).toBeEnabled();
  await page.getByTestId('magnet-preset-delete').click();
  await expect(propios).toHaveCount(1);

  await page.evaluate(async () => {
    const { useMagnetPresets } = await import('/src/store/magnetPanel.ts');
    for (let i = 0; i < 40; i++) useMagnetPresets.getState().save(`Imán ${i}`, { shape: 'round', sizeMm: 5 + (i % 5), heightMm: 2, clearanceMm: 0.2, depthClearanceMm: 0.2, hidden: false });
  });
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('kura3d-presets-magnet') ?? '[]').length);
  expect(n).toBeLessThanOrEqual(30);
  await nombre.fill('Uno más');
  await guardar.click();
  await expect(alerta).toContainText(/30|máximo|tope|lleno/i);
  await page.screenshot({ path: `${SHOTS}/06-preajustes-tope.png` });
  await page.evaluate(() => localStorage.setItem('kura3d-presets-magnet', '{"no":"lista"}'));
  await page.reload();
  await abrir(page);
  await crear(page, 'box', { width: 40, height: 40, depth: 40 });
  await abrirPanel(page);
  await expect(page.getByTestId('magnet-preset')).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('kura3d-presets-magnet'));
});

const sel = (page: Page) => page.evaluate(() => (window as any).__s.getState().selectedIds as string[]);

test('07 interacción: orbitar y arrastrar no actúan, Escape y Listo cierran, deshacer y rehacer por hueco', async ({ page }) => {
  test.setTimeout(150_000);
  await abrir(page);
  const host = await crear(page, 'box', { width: 30, height: 30, depth: 30 });
  const bb = await bbox(page, host);
  await camara(page, bb.center as P3, [0.6, 0.9, 1.1]);
  // Sin selección previa: el arrastre sobre la pieza no la mueve (el panel intercepta el gesto).
  await abrirPanel(page);
  const pos0 = (await getState(page)).objects[0].position;
  const past0 = (await getState(page)).past;
  // Arrastre sobre la pieza con el panel abierto: no mueve ni coloca ni selecciona.
  const a = await apuntar(page, bb.center as P3);
  await page.mouse.down();
  await page.mouse.move(a.x + 80, a.y + 30, { steps: 10 });
  await page.mouse.up();
  await cuadros(page);
  await libre(page);
  let s = await getState(page);
  expect(s.objects).toHaveLength(1);
  expect(s.objects[0].position).toEqual(pos0);
  expect(s.past).toBe(past0);
  expect((await sel(page)).length, 'el arrastre con el panel abierto no selecciona').toBe(0);
  // Clic derecho con el panel abierto no coloca.
  await camara(page, bb.center as P3, [0.6, 0.9, 1.1]);
  await apuntar(page, bb.center as P3);
  await page.mouse.click((await aPixel(page, bb.center as P3)).x, (await aPixel(page, bb.center as P3)).y, { button: 'right' });
  await cuadros(page);
  await libre(page);
  expect((await getState(page)).objects).toHaveLength(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Tres huecos; cada uno es un paso (sin selección para que el gizmo no tape el centro de la cara).
  await page.evaluate(() => (window as any).__s.getState().setSelection([]));
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  for (const off of [[-8, 0], [0, 0], [8, 0]] as [number, number][]) {
    const base = (await getState(page)).past;
    const p = await aPixel(page, bb.center as P3);
    await page.mouse.move(p.x + off[0] * 3 - 4, p.y - 4);
    await page.mouse.move(p.x + off[0] * 3, p.y, { steps: 3 });
    await cuadros(page);
    await libre(page);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(async () => (await getState(page)).past).toBe(base + 1);
    await libre(page);
  }
  expect((await getState(page)).objects.filter((o: any) => o.role === 'negative')).toHaveLength(3);
  // «Listo» cierra; el canvas vuelve a la normalidad (sin cursor crosshair, sin catchers).
  await page.getByTestId('magnet-done').click();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);
  const cursor = await page.locator('canvas').first().evaluate((c) => getComputedStyle(c).cursor);
  expect(cursor).not.toBe('crosshair');
  // Clic sobre la pieza ahora selecciona (herramientas normales).
  await camara(page, bb.center as P3, [0.6, 0.9, 1.1]);
  const c = await aPixel(page, [bb.center[0], bb.center[1], bb.center[2]]);
  await page.mouse.click(c.x, c.y);
  await cuadros(page);
  await libre(page);
  expect((await sel(page)).length).toBeGreaterThan(0);
  // Arrastrar para mover vuelve a funcionar.
  const p0 = (await getState(page)).objects.find((o: any) => o.id === host).position;
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 70, c.y + 10, { steps: 10 });
  await page.mouse.up();
  await cuadros(page);
  await libre(page);
  s = await getState(page);
  const p1 = s.objects.find((o: any) => o.id === host).position;
  // Los imanes agrupados se mueven con la anfitriona.
  const negs = s.objects.filter((o: any) => o.role === 'negative');
  expect(negs).toHaveLength(3);
  const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
  expect(Math.hypot(dx, dz), 'la pieza se mueve al arrastrar').toBeGreaterThan(5);
  // Deshacer x4 (mover + 3 huecos) y rehacer.
  const kinds = async () => (await getState(page)).objects.filter((o: any) => o.role === 'negative').length;
  await page.keyboard.press('Control+z');
  await cuadros(page);
  await libre(page);
  expect(await kinds()).toBe(3);
  await page.keyboard.press('Control+z');
  await expect.poll(kinds).toBe(2);
  await page.keyboard.press('Control+z');
  await expect.poll(kinds).toBe(1);
  await page.keyboard.press('Control+y');
  await expect.poll(kinds).toBe(2);
  await page.keyboard.press('Control+y');
  await expect.poll(kinds).toBe(3);
});

test('08 convivencia: paneles excluyentes, grupo, duplicar, borrar, guardar y reabrir .kura, borrador', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => { delete (window as any).showSaveFilePicker; });
  page.on('dialog', (d) => void d.accept());
  await abrir(page);
  const host = await crear(page, 'box', { width: 30, height: 30, depth: 30 });
  const bb = await bbox(page, host);
  await abrirPanel(page);
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  await colocarYVerificar(page, host, bb.center as P3);

  // Texto 3D cierra el panel; volver a abrir imán cierra Texto 3D; Asistentes igual.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Texto 3D/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);
  await abrirPanel(page);
  await expect(page.getByRole('dialog', { name: /Texto 3D/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.locator('.kura-magnet-panel')).toHaveCount(0);
  await abrirPanel(page);
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Agrupado: negativo en el mismo grupo que su pieza.
  let s = await getState(page);
  const neg = s.objects.find((o: any) => o.role === 'negative');
  expect(neg.name).toBe('Imán 5 × 2');
  const refs = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => ({ id: o.id, g: o.groupRef ?? null })));
  expect(refs.find((r: any) => r.id === neg.id).g).toBe(refs.find((r: any) => r.id === host).g);
  expect(refs.find((r: any) => r.id === host).g).not.toBeNull();

  // Mover la anfitriona mueve el imán.
  await page.evaluate((id) => (window as any).__s.getState().selectObject(id), host);
  await page.evaluate(() => (window as any).__s.getState().nudgeSelectedObjects([10, 0, 0]));
  s = await getState(page);
  const neg2 = s.objects.find((o: any) => o.id === neg.id);
  expect(neg2.position[0] - neg.position[0]).toBeCloseTo(10, 3);

  // Duplicar la pieza: el duplicado trae su imán?
  await page.evaluate((id) => (window as any).__s.getState().duplicateObjects([id]), host);
  s = await getState(page);
  await page.keyboard.press('Control+z');
  await cuadros(page);
  await libre(page);

  // Guardar .kura (descarga) y reabrir.
  const dir = (await import('node:fs')).mkdtempSync((await import('node:path')).join((await import('node:os')).tmpdir(), 'qa24k-'));
  const archivo = (await import('node:path')).join(dir, 'iman.kura');
  const dl = page.waitForEvent('download');
  await page.evaluate(() => void (window as any).__s.getState().saveProject(true));
  await (await dl).saveAs(archivo);
  const antesN = (await getState(page)).objects.map((o: any) => `${o.name}|${o.role}|${JSON.stringify(o.addon)}`).sort();
  await page.evaluate(() => (window as any).__s.getState().clearScene());
  await expect.poll(async () => (await getState(page)).objects.length).toBe(0);
  const ch = page.waitForEvent('filechooser');
  await page.evaluate(() => void (window as any).__s.getState().openProject());
  (await ch).setFiles(archivo);
  await expect.poll(async () => (await getState(page)).objects.length, { timeout: 30000 }).toBe(antesN.length);
  await cuadros(page);
  await libre(page);
  s = await getState(page);
  const despuesN = s.objects.map((o: any) => `${o.name}|${o.role}|${JSON.stringify(o.addon)}`).sort();
  expect(despuesN).toEqual(antesN);
  const negR = s.objects.find((o: any) => o.role === 'negative');
  expect(negR.name).toBe('Imán 5 × 2');
  expect(negR.addon.kind).toBe('magnet_pocket');
  // Aplicar restas tras reabrir sigue funcionando.
  await page.evaluate(async () => { const x = (window as any).__s.getState(); x.setSelection([]); await x.applyHolesOnSolids(); });
  await libre(page);
  s = await getState(page);
  expect(s.objects).toHaveLength(1);
  expect(s.objects[0].manifold).toBe(true);
  await page.evaluate(() => (window as any).__s.getState().undo());
  await cuadros(page);
  await libre(page);

  // Borrar la anfitriona: ¿qué pasa con el imán?
  await page.evaluate((id) => { const x = (window as any).__s.getState(); x.setSelection([id]); x.deleteSelected?.(); }, host);
  await cuadros(page);
  await libre(page);
  s = await getState(page);

  // Borrador tras recargar con un imán colocado.
  await page.evaluate(() => (window as any).__s.getState().clearScene());
  const h2 = await crear(page, 'box', { width: 30, height: 30, depth: 30 });
  const bb2 = await bbox(page, h2);
  await abrirPanel(page);
  await camara(page, bb2.center as P3, [0.05, 1, 0.05]);
  await colocarYVerificar(page, h2, bb2.center as P3);
  await page.keyboard.press('Escape');
  await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 40000 });
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await expect.poll(async () => (await getState(page)).objects.length, { timeout: 30000 }).toBe(2);
  s = await getState(page);
  expect(s.objects.find((o: any) => o.role === 'negative')?.name).toBe('Imán 5 × 2');
});

test('09 gizmo con panel abierto: la pieza seleccionada no debe moverse ni bloquear la colocación', async ({ page }) => {
  test.setTimeout(120_000);
  await abrir(page);
  const host = await crear(page, 'box', { width: 30, height: 30, depth: 30 });
  const bb = await bbox(page, host);
  await camara(page, bb.center as P3, [0.6, 0.9, 1.1]);
  // Ruta habitual: la pieza queda seleccionada (clic derecho › Más, o seleccionar y luego Insertar).
  await page.evaluate((id) => (window as any).__s.getState().selectObject(id), host);
  await abrirPanel(page);
  const pos0 = (await getState(page)).objects[0].position;
  const a = await apuntar(page, bb.center as P3);
  await page.mouse.down();
  await page.mouse.move(a.x + 80, a.y + 30, { steps: 10 });
  await page.mouse.up();
  await cuadros(page);
  await libre(page);
  const s1 = await getState(page);
  expect(s1.objects[0].position, 'arrastrar con el panel abierto no mueve la pieza').toEqual(pos0);
  // Tras ese gesto, colocar un hueco debe seguir funcionando (lejos del gizmo).
  await camara(page, bb.center as P3, [0.05, 1, 0.05]);
  const top = await aPixel(page, [bb.center[0] + 8, bb.max[1], bb.center[2] + 8]);
  await page.mouse.move(top.x - 4, top.y - 4);
  await page.mouse.move(top.x, top.y, { steps: 3 });
  await cuadros(page);
  await libre(page);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await getState(page)).objects.filter((o: any) => o.role === 'negative').length, { timeout: 15000 }).toBe(1);
  const negs = (await getState(page)).objects.filter((o: any) => o.role === 'negative').length;
  expect(negs, 'colocar un hueco tras arrastrar el gizmo con el panel abierto').toBe(1);
  await page.screenshot({ path: `${SHOTS}/09-gizmo-panel.png` });
});

test('10 modelos reales importados: vista previa = creado, restas válidas', async ({ page }) => {
  test.setTimeout(300_000);
  const { existsSync } = await import('node:fs');
  const dir = process.env.QA20_MODELOS ?? 'G:/proyectos/kura3d/.eval-tmp/modelos';
  for (const nombre of ['ocarina.3mf', 'obj_1_tinker.obj.stl']) {
    const ruta = `${dir}/${nombre}`;
    if (!existsSync(ruta)) { continue; }
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().clearScene());
    const ch = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
    (await ch).setFiles(ruta);
    await expect.poll(async () => (await getState(page)).objects.filter((o: any) => o.role !== 'negative').length, { timeout: 120000 }).toBeGreaterThan(0);
    await cuadros(page);
    await libre(page);
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    const solidos = (await getState(page)).objects.filter((o: any) => o.role !== 'negative');
    // Busca una pieza y apunta a su centro desde arriba y desde un costado.
    const objetivo = solidos[0];
    const bb = await bbox(page, objetivo.id);
    await abrirPanel(page);
    const antes = (await getState(page)).objects.filter((o: any) => o.role === 'negative').length;
    for (const dir3 of [[0.05, 1, 0.05], [1, 0.3, 0.2]] as P3[]) {
      await camara(page, bb.center as P3, dir3, Math.max(...bb.size) * 3);
      await apuntar(page, bb.center as P3);
      const h = await hoverState(page);
      if (!h) { continue; }
      const n0 = (await getState(page)).objects.length;
      await page.mouse.down();
      await page.mouse.up();
      await expect.poll(async () => (await getState(page)).objects.length, { timeout: 60000 }).toBe(n0 + 1);
      await libre(page);
      const last = (await getState(page)).objects.filter((o: any) => o.role === 'negative').slice(-1)[0];
      const axis = ejeDe(last.rotation);
      const tip = last.position.map((v: number, i: number) => v + axis[i] * 2.2);
      const err = Math.hypot(tip[0] - h.point[0], tip[1] - h.point[1], tip[2] - h.point[2]);
      expect(dot(axis, h.normal)).toBeGreaterThan(0.999);
      expect(err).toBeLessThan(0.3);
    }
    await page.keyboard.press('Escape');
    const nNeg = (await getState(page)).objects.filter((o: any) => o.role === 'negative').length;
    expect(nNeg).toBeGreaterThan(antes);
    const volAntes = (await getState(page)).objects.find((o: any) => o.id === objetivo.id).volume;
    await page.evaluate(async () => { const x = (window as any).__s.getState(); x.setSelection([]); await x.applyHolesOnSolids(); });
    await expect.poll(async () => (await getState(page)).busy, { timeout: 120000 }).toBeNull();
    const fin = await getState(page);
    const sol = fin.objects.find((o: any) => o.id === objetivo.id) ?? fin.objects.filter((o: any) => o.role !== 'negative')[0];
    expect(fin.objects.filter((o: any) => o.role === 'negative')).toHaveLength(0);
    expect(sol.volume).toBeLessThan(volAntes);
  }
});
