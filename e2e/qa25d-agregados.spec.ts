/**
 * @file e2e/qa25d-agregados.spec.ts
 * @description QA de la ronda 25-nov (D) de los agregados sin ratón: imán, torreta, paso de cable y ojo de cerradura
 * con «Colocar en el centro de la cara» y selector de cara usando solo teclado; el agregado queda centrado y hacia
 * afuera, sin pieza elegible avisa, el bloque no desborda a 1024 px; en una esfera la torreta puesta con clic cerca
 * de la cima queda casi vertical respecto de la superficie; M5 aparece para tornillo directo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir as abrirBase, aPixel, cajaMundo } from './qa12-helpers';

type P3 = [number, number, number];
const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25d';

async function abrir(page: Page): Promise<string[]> {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console.error: ${m.text()}`); });
  await abrirBase(page);
  return errs;
}
const cuadros = (page: Page, n = 2) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i += 1) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, n);
const libre = (page: Page) => expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation), { timeout: 30_000 }).toBeNull();
const agregados = (page: Page) => page.evaluate(() =>
  (window as any).__s.getState().objects.filter((o: any) => o.metadata?.addon).map((o: any) => ({ id: o.id, kind: o.metadata.addon.kind, role: o.role })));

async function crear(page: Page, type: string, params: any, opts: any = {}): Promise<string> {
  return page.evaluate(async ({ type, params, opts }) => {
    const s = () => (window as any).__s.getState();
    const o = await s().createPrimitive(type, params, opts);
    s().setSelection([o.id]);
    s().dismissAllToasts?.();
    return o.id as string;
  }, { type, params, opts });
}
async function vista(page: Page, cam: P3, mira: P3) {
  await page.evaluate(({ cam, mira }) => {
    const r = (window as any).__r3f.getState();
    r.camera.position.set(cam[0], cam[1], cam[2]); r.camera.lookAt(mira[0], mira[1], mira[2]); r.camera.updateMatrixWorld();
    r.controls?.target?.set?.(mira[0], mira[1], mira[2]); r.controls?.update?.();
  }, { cam, mira });
  await cuadros(page, 3);
}
async function clic(page: Page, p: P3) {
  const a = await aPixel(page, p);
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.move(a.x, a.y, { steps: 3 });
  await cuadros(page);
  await page.mouse.down();
  await page.mouse.up();
}
const insertar = async (page: Page, nombre: RegExp) => {
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: nombre }).click();
};

const AGREGADOS = [
  { id: 'magnet', nombre: /^Alojamiento de imán/, kind: 'magnet' },
  { id: 'turret', nombre: /^Torreta para tornillo/, kind: 'screwBoss' },
  { id: 'cable', nombre: /^Paso de cable/, kind: 'cablePass' },
  { id: 'keyhole', nombre: /^Colgar en el muro/, kind: 'keyhole' },
];

for (const a of AGREGADOS) {
  test(`${a.id}: colocar en el centro de la cara solo con teclado (frente), centrado y hacia afuera; 1024 sin desborde`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1024, height: 768 });
    const errs = await abrir(page);
    const host = await crear(page, 'box', { width: 60, height: 40, depth: 50 }, { position: [0, 0, 0], name: 'Pieza' });
    await vista(page, [90, 80, 120], [0, 20, 0]);
    const hostBox = await cajaMundo(page, host);
    await insertar(page, a.nombre);
    const bloque = page.getByTestId(`${a.id}-face`);
    await expect(bloque).toBeVisible();
    await bloque.scrollIntoViewIfNeeded();
    const medida = await bloque.evaluate((el) => {
      const p = el.closest('[class*="panel"], [role="dialog"], aside') as HTMLElement | null;
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, vw: window.innerWidth, sw: el.scrollWidth, cw: el.clientWidth, pr: p?.getBoundingClientRect().right ?? null };
    });
    console.log('QA25D bloque', a.id, JSON.stringify(medida));
    expect(medida.r, 'el bloque desborda a 1024').toBeLessThanOrEqual(medida.vw + 0.5);
    expect(medida.sw, 'el bloque desborda a 1024').toBeLessThanOrEqual(medida.cw + 1);
    await page.screenshot({ path: `${EV}/agregado-${a.id}-panel.png` });
    // Solo teclado: foco al selector, elegir «Frente» y activar el botón con Enter.
    const sel = page.getByTestId(`${a.id}-face-select`);
    await sel.focus();
    await page.keyboard.press('ArrowDown'); // Arriba -> Abajo
    await page.keyboard.press('ArrowDown'); // -> Frente
    expect(await sel.inputValue()).toBe('front');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId(`${a.id}-face-place`)).toBeFocused();
    const antes = (await agregados(page)).length;
    await page.keyboard.press('Enter');
    await libre(page);
    await expect.poll(async () => (await agregados(page)).length, { timeout: 30_000 }).toBeGreaterThan(antes);
    await page.waitForTimeout(500);
    const ag = (await agregados(page)).filter((x: any) => x.kind === a.kind || true).slice(-1)[0];
    const box = await cajaMundo(page, ag.id);
    const c = (b: { min: number[]; max: number[] }) => b.min.map((v, i) => (v + b.max[i]) / 2);
    const ch = c(hostBox), ca = c(box);
    console.log('QA25D', a.id, 'host', JSON.stringify(hostBox), 'agregado', JSON.stringify(box), 'centros', ch, ca, 'tipo', ag.kind, ag.role);
    await page.screenshot({ path: `${EV}/agregado-${a.id}-colocado.png` });
    // «Frente» = +Z (cámara en +Z): centrado en X e Y, y por fuera/en la cara frontal.
    expect(Math.abs(ca[0] - ch[0]), 'centrado en X').toBeLessThan(1);
    // El ojo de cerradura tiene la ranura hacia arriba: el punto de cuelgue (círculo) queda en el centro, no su caja.
    expect(Math.abs(ca[1] - ch[1]), 'centrado en Y').toBeLessThan(a.id === 'keyhole' ? 6 : 1);
    if (a.id === 'keyhole') expect(Math.abs(box.min[1] + 4.3 - ch[1]), 'círculo de cuelgue en el centro').toBeLessThan(1);
    expect(box.max[2], 'hacia afuera de la cara frontal').toBeGreaterThan(hostBox.max[2] - 0.5);
    expect(Math.abs(ca[2] - hostBox.max[2]), 'sobre la cara frontal').toBeLessThan(15);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`${a.id}: sin pieza elegible avisa (dos piezas sin elegir y pieza bloqueada); escena vacía`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrir(page);
    // Escena vacía: se anota qué pasa (el panel puede no abrirse).
    await insertar(page, a.nombre);
    await page.waitForTimeout(800);
    console.log('QA25D', a.id, 'escena vacía: bloque visible =', await page.getByTestId(`${a.id}-face`).count(), '| avisos:', JSON.stringify(await page.locator('.kura-toast, [role="status"]').allInnerTexts()));
    await page.screenshot({ path: `${EV}/agregado-${a.id}-escena-vacia.png` });
    await page.keyboard.press('Escape');
    // Dos piezas sin elegir: no hay una única elegible.
    const h1 = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, { position: [-60, 0, 0], name: 'Uno' });
    await crear(page, 'box', { width: 40, height: 40, depth: 40 }, { position: [60, 0, 0], name: 'Dos' });
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    await insertar(page, a.nombre);
    await expect(page.getByTestId(`${a.id}-face`)).toBeVisible();
    const n0 = (await agregados(page)).length;
    await page.getByTestId(`${a.id}-face-place`).click();
    await expect(page.getByText(/Selecciona primero la pieza/).first()).toBeVisible({ timeout: 5_000 });
    expect((await agregados(page)).length).toBe(n0);
    await page.screenshot({ path: `${EV}/agregado-${a.id}-sin-pieza.png` });
    // Pieza elegida pero bloqueada: no coloca.
    await page.evaluate((i) => { const w = (window as any).__s; w.setState({ selectedIds: [i], objects: w.getState().objects.map((o: any) => (o.id === i ? { ...o, locked: true } : o)) }); }, h1);
    const locked = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).locked, h1);
    console.log('QA25D', a.id, 'pieza bloqueada locked=', locked);
    if (locked) {
      await page.getByTestId(`${a.id}-face-place`).click();
      await page.waitForTimeout(600);
      console.log('QA25D', a.id, 'bloqueada: agregados', (await agregados(page)).length, 'vs', n0);
      expect((await agregados(page)).length, 'colocó sobre una pieza bloqueada').toBe(n0);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('torreta en una ESFERA: el clic cerca de la cima queda casi vertical respecto de la superficie; M5 con tornillo directo', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await abrir(page);
  const host = await crear(page, 'sphere', { radius: 25 }, { position: [0, 0, 0], name: 'Esfera' });
  const hb = await cajaMundo(page, host);
  const cen: P3 = [(hb.min[0] + hb.max[0]) / 2, (hb.min[1] + hb.max[1]) / 2, (hb.min[2] + hb.max[2]) / 2];
  await vista(page, [cen[0], cen[1] + 110, cen[2] + 60], cen);
  await insertar(page, /^Torreta para tornillo/);
  await expect(page.getByTestId('turret-face')).toBeVisible();
  // M5 con tornillo directo.
  await page.getByTestId('turret-type-screw').click();
  const opciones = await page.getByTestId('turret-preset').evaluate((el) => Array.from((el as HTMLSelectElement).options).map((o) => o.textContent));
  console.log('QA25D torreta presets tornillo', JSON.stringify(opciones));
  expect(opciones.join('|'), 'M5 ausente en tornillo directo').toMatch(/M5/);
  const theta = (10 * Math.PI) / 180;
  const R = 25;
  const punto: P3 = [cen[0] + R * Math.sin(theta), cen[1] + R * Math.cos(theta), cen[2]];
  await clic(page, punto);
  await libre(page);
  await expect.poll(async () => (await agregados(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const ag = (await agregados(page))[0];
  // Eje principal del agregado (PCA por iteración de potencias) frente a la normal de la esfera en su centro.
  const r = await page.evaluate(([aid, c]) => {
    const st = (window as any).__r3f.getState();
    const V = st.camera.position.constructor, Eu = st.camera.rotation.constructor, Q = st.camera.quaternion.constructor;
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === aid);
    const q = new Q().setFromEuler(new Eu(o.rotation[0], o.rotation[1], o.rotation[2]));
    const P = o.mesh.positions as ArrayLike<number>;
    const pts: number[][] = [];
    for (let i = 0; i < P.length; i += 3) {
      const v = new V(P[i] * o.scale[0], P[i + 1] * o.scale[1], P[i + 2] * o.scale[2]).applyQuaternion(q);
      pts.push([v.x + o.position[0], v.y + o.position[1], v.z + o.position[2]]);
    }
    const m = [0, 0, 0];
    pts.forEach((p) => { for (let k = 0; k < 3; k++) m[k] += p[k] / pts.length; });
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    pts.forEach((p) => { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a][b] += ((p[a] - m[a]) * (p[b] - m[b])) / pts.length; });
    let v = [0.3, 0.8, 0.5];
    for (let it = 0; it < 60; it++) {
      const w = [0, 1, 2].map((a) => cov[a][0] * v[0] + cov[a][1] * v[1] + cov[a][2] * v[2]);
      const n = Math.hypot(w[0], w[1], w[2]) || 1;
      v = w.map((x) => x / n);
    }
    const nrm = [m[0] - (c as number[])[0], m[1] - (c as number[])[1], m[2] - (c as number[])[2]];
    const nl = Math.hypot(nrm[0], nrm[1], nrm[2]);
    const dot = Math.abs((v[0] * nrm[0] + v[1] * nrm[1] + v[2] * nrm[2]) / nl);
    return { angDeg: (Math.acos(Math.min(1, dot)) * 180) / Math.PI, centro: m, eje: v };
  }, [ag.id, cen] as const);
  console.log('QA25D torreta esfera', JSON.stringify(r));
  await page.screenshot({ path: `${EV}/torreta-esfera.png` });
  expect(r.angDeg, `la torreta se aparta ${r.angDeg.toFixed(1)}° de la normal`).toBeLessThan(2);
  expect(errs, errs.join('\n')).toEqual([]);
});
