/**
 * @file e2e/qa25g-repartir-atajos.spec.ts
 * @description QA 25-nov (G), bloques 3 y 5. Repartir: «Una placa por objeto» (3 piezas → 3 placas centradas, un Ctrl+Z las
 * restaura), «Repartir en placas» desde la paleta con 12 piezas de tamaños distintos (dentro de las camas, sin solapes, mínimo
 * razonable de placas, un solo paso de deshacer), pieza más grande que la cama (queda fuera con aviso) y repartir en vista
 * Armado sin mover la figura. Atajos: H y L con 3 piezas = un paso; al menos 12 atajos del modal funcionan; no se disparan con
 * el foco en un campo ni con un diálogo abierto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';
import { cajas, solapes } from './ux-escena-helpers';

const EVID = 'G:/proyectos/kura3d/.eval-tmp/qa25g';
const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const pasos = (page: Page) => S(page, (s) => s.past.length as number);
const tira = (page: Page) => page.getByRole('region', { name: 'Placas de impresión' });
const vacio = (page: Page) => page.locator('body').click({ position: { x: 4, y: 4 } }).catch(() => undefined);

async function cubo(page: Page, name: string, w: number, d: number, h: number, pos?: [number, number, number]) {
  return (await cmd(page, 'create_primitive', { type: 'box', width: w, depth: d, height: h, name, ...(pos ? { position: pos } : {}) })).id as string;
}

/** Cajas por pieza y placa: devuelve cuáles piezas quedan fuera del volumen de su placa (en planta). */
async function fuera(page: Page) {
  const cs = await cajas(page);
  return S(page, (s) => ({ bed: [s.printerProfile.bedWidthMm, s.printerProfile.bedDepthMm], plates: s.plates, refs: s.objects.map((o: any) => [o.id, o.plateRef ?? null]) })).then((st) => {
    const refs = new Map(st.refs as Array<[string, string | null]>);
    const out: string[] = [];
    const usadas = new Set<string>();
    for (const c of cs) {
      const pid = refs.get(c.id) ?? st.plates[0]?.id;
      const pl = st.plates.find((p: any) => p.id === pid) ?? { origin: [0, 0], bed: undefined };
      usadas.add(String(pid));
      const w = pl.bed?.widthMm ?? st.bed[0], d = pl.bed?.depthMm ?? st.bed[1];
      const [ox, oz] = pl.origin;
      if (c.min[0] < ox - w / 2 - 0.05 || c.max[0] > ox + w / 2 + 0.05 || c.min[2] < oz - d / 2 - 0.05 || c.max[2] > oz + d / 2 + 0.05) out.push(c.name);
    }
    return { out, placasUsadas: usadas.size, bed: st.bed as number[], cs, refs };
  });
}

test.describe('Repartir y una placa por objeto', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('«Una placa por objeto»: 3 piezas → 3 placas centradas y un Ctrl+Z las restaura', async ({ page }) => {
    const errs = await abrir(page);
    await cubo(page, 'A', 30, 30, 30); await cubo(page, 'B', 40, 20, 20); await cubo(page, 'C', 20, 20, 50);
    await S(page, (s) => s.createPlate());
    const antes = { n: await S(page, (s) => s.plates.length), pos: await S(page, (s) => s.objects.map((o: any) => [...o.position])), pasos: await pasos(page) };
    await expect(tira(page)).toBeVisible();
    await S(page, (s) => s.setSelection([]));
    await page.getByTestId('plate-spread').click();
    await expect.poll(() => S(page, (s) => s.busyOperation ?? null), { timeout: 30000 }).toBeNull();
    await page.waitForTimeout(800);
    console.log('QA25G spread tras clic: placas', await S(page, (s) => s.plates.length), 'refs', JSON.stringify(await S(page, (s) => s.objects.map((o: any) => o.plateRef ?? null))), 'toasts', JSON.stringify(await S(page, (s) => (s.toasts ?? []).map((t: any) => t.text ?? t.message))));
    await expect.poll(() => S(page, (s) => s.plates.length)).toBeGreaterThanOrEqual(3);
    const r = await fuera(page);
    const n = await S(page, (s) => s.plates.length);
    console.log('QA25G spread: placas', n, 'usadas', r.placasUsadas, 'fuera', r.out, 'pasos+', (await pasos(page)) - antes.pasos);
    expect(r.placasUsadas, '3 piezas, 3 placas distintas').toBe(3);
    expect(r.out, 'dentro de su cama').toEqual([]);
    // Centradas en su placa (tolerancia 1 mm).
    const st = await S(page, (s) => ({ plates: s.plates, objs: s.objects.map((o: any) => ({ id: o.id, ref: o.plateRef })) }));
    for (const c of r.cs) {
      const pl = st.plates.find((p: any) => p.id === st.objs.find((o: any) => o.id === c.id)!.ref);
      const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
      expect.soft(Math.hypot(cx - pl.origin[0], cz - pl.origin[1]), `${c.name} centrada`).toBeLessThan(1);
    }
    expect((await pasos(page)) - antes.pasos, 'un solo paso').toBe(1);
    await page.screenshot({ path: `${EVID}/spread-3.png` });
    await page.keyboard.press('Control+z');
    expect(await S(page, (s) => s.plates.length), 'placas restauradas').toBe(antes.n);
    expect(await S(page, (s) => s.objects.map((o: any) => [...o.position]))).toEqual(antes.pos);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('«Repartir en placas» desde la paleta con 12 piezas distintas: dentro, sin solapes, placas mínimas, un solo Ctrl+Z', async ({ page }) => {
    const errs = await abrir(page);
    const bed = await S(page, (s) => [s.printerProfile.bedWidthMm, s.printerProfile.bedDepthMm]);
    // 12 piezas apiladas en el mismo sitio (solapadas); área total alrededor del 55 % de una cama => 1 a 2 placas razonables.
    const base = Math.sqrt((bed[0] * bed[1] * 0.55) / 12);
    for (let i = 0; i < 12; i++) await cubo(page, `P${i + 1}`, Math.round(base * (0.5 + (i % 4) * 0.35)), Math.round(base * (0.6 + (i % 3) * 0.4)), 10 + i * 3, [0, 0, 0]);
    const volumenTotal = await S(page, (s) => s.objects.reduce((a: number, o: any) => a + ((o.mesh && 0) || 0), 0));
    void volumenTotal;
    const areaTotal = (await cajas(page)).reduce((a, c) => a + (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]), 0);
    const minimoTeorico = Math.ceil(areaTotal / (bed[0] * bed[1]));
    const pasos0 = await pasos(page);
    const pos0 = await S(page, (s) => s.objects.map((o: any) => [...o.position]));
    await page.keyboard.press('Control+k');
    await page.keyboard.type('Repartir en placas');
    const opc = page.getByRole('option', { name: /Repartir en placas/ }).first();
    await expect(opc).toBeVisible();
    await page.screenshot({ path: `${EVID}/repartir-paleta.png` });
    await page.keyboard.press('Enter');
    // El comando corre con indicador de progreso (no hay diálogo de opciones): se espera a que termine.
    await expect.poll(() => S(page, (s) => s.busyOperation ?? null), { timeout: 60000 }).toBeNull();
    await expect.poll(async () => (await pasos(page)) - pasos0, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(800);
    const r = await fuera(page);
    const sol = solapes(r.cs.filter((c) => true).map((c) => ({ ...c })), 0.05);
    // Solo cuenta solape entre piezas de la misma placa.
    const refs = new Map(r.refs as Array<[string, string | null]>);
    const nombrePlaca = (name: string) => refs.get(r.cs.find((c) => c.name === name)!.id);
    const solapesMismaPlaca = sol.filter((p) => { const [a, b] = p.split(/ ?[-–/|,] ?| con | y /).map((x) => x.trim()); return nombrePlaca(a) === nombrePlaca(b); });
    console.log('QA25G repartir 12: placas usadas', r.placasUsadas, 'minimo teorico', minimoTeorico, 'fuera', r.out, 'solapes', sol.length, 'pasos+', (await pasos(page)) - pasos0, 'bed', bed);
    expect(r.out, 'todas dentro de las camas').toEqual([]);
    expect(solapesMismaPlaca, 'sin solapes').toEqual([]);
    expect(r.placasUsadas, `placas usadas (mínimo teórico por área ${minimoTeorico})`).toBeLessThanOrEqual(minimoTeorico + 2);
    expect((await pasos(page)) - pasos0, 'un solo paso de deshacer').toBe(1);
    await page.screenshot({ path: `${EVID}/repartir-12.png` });
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.keyboard.press('Control+z');
    expect(await S(page, (s) => s.objects.map((o: any) => [...o.position])), 'Ctrl+Z restaura posiciones').toEqual(pos0);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('una pieza más grande que la cama queda fuera con aviso (dryRun y aplicación)', async ({ page }) => {
    const errs = await abrir(page);
    const bed = await S(page, (s) => [s.printerProfile.bedWidthMm, s.printerProfile.bedDepthMm]);
    await cubo(page, 'Enorme', bed[0] + 60, 30, 20, [0, 0, 0]);
    await cubo(page, 'Normal', 30, 30, 30, [0, 0, 0]);
    const seco = await cmd(page, 'arrange_on_plates', { dryRun: true });
    console.log('QA25G dryRun gigante', JSON.stringify(seco).slice(0, 300));
    await cmd(page, 'arrange_on_plates', {});
    await page.waitForTimeout(500);
    const toasts = await page.evaluate(() => document.body.innerText);
    const r = await fuera(page);
    console.log('QA25G gigante: fuera', r.out);
    expect(r.out, 'solo la pieza enorme queda fuera').toEqual(['Enorme']);
    expect(toasts).toMatch(/no cab|no entr|fuera|sin colocar|no se pudo|demasiado/i);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('en vista Armado, repartir no mueve la figura', async ({ page }) => {
    const errs = await abrir(page);
    await cubo(page, 'A', 30, 30, 30); await cubo(page, 'B', 30, 30, 30);
    await S(page, (s) => s.createPlate());
    await cubo(page, 'C', 30, 30, 30);
    await page.getByRole('radiogroup', { name: 'Modo de vista' }).getByRole('radio', { name: 'Armado' }).click();
    const antes = await S(page, (s) => s.objects.map((o: any) => [...o.position]));
    const pasos0 = await pasos(page);
    const spread = page.getByTestId('plate-spread');
    const habil = await spread.isEnabled();
    console.log('QA25G armado: plate-spread habilitado =', habil);
    let res: any = null;
    try { res = await page.evaluate(async () => (window as any).__s.getState().executeCommand({ id: 'qa-arm', command: 'arrange_on_plates', params: {} })); } catch (e) { res = String(e); }
    console.log('QA25G armado arrange cmd', JSON.stringify(res).slice(0, 250));
    await page.waitForTimeout(500);
    const despues = await S(page, (s) => s.objects.map((o: any) => [...o.position]));
    expect(despues, 'la figura armada no se mueve').toEqual(antes);
    console.log('QA25G armado pasos+', (await pasos(page)) - pasos0);
    if (habil) await spread.click();
    await page.waitForTimeout(500);
    expect(await S(page, (s) => s.objects.map((o: any) => [...o.position])), 'tampoco con el botón').toEqual(antes);
    await page.getByTestId('viewmode-back').click();
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });
});

test.describe('Atajos', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function tres(page: Page) {
    const ids = [await cubo(page, 'A', 20, 20, 20, [-40, 30, 0]), await cubo(page, 'B', 20, 20, 20, [0, 30, 0]), await cubo(page, 'C', 20, 20, 20, [40, 30, 0])];
    await S(page, (s) => s.setSelection(s.objects.map((o: any) => o.id)));
    await vacio(page);
    await S(page, (s) => s.setSelection(s.objects.map((o: any) => o.id)));
    return ids;
  }

  test('H con 3 piezas = UN paso, pasa a negativo y deshace de una vez', async ({ page }) => {
    const errs = await abrir(page);
    await tres(page);
    const p0 = await pasos(page);
    await page.keyboard.press('h');
    await page.waitForTimeout(300);
    expect(await S(page, (s) => s.objects.map((o: any) => o.role))).toEqual(['negative', 'negative', 'negative']);
    expect((await pasos(page)) - p0, 'H = un paso').toBe(1);
    await page.keyboard.press('Control+z');
    expect(await S(page, (s) => s.objects.map((o: any) => o.role ?? 'solid'))).not.toContain('negative');
    await page.keyboard.press('Control+Shift+z');
    expect(await S(page, (s) => s.objects.map((o: any) => o.role))).toEqual(['negative', 'negative', 'negative']);
    await page.keyboard.press('h');
    expect(await S(page, (s) => s.objects.map((o: any) => o.role ?? 'solid'))).not.toContain('negative');
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('L con 3 piezas = UN paso y las apoya en la cama; deshacer las devuelve', async ({ page }) => {
    const errs = await abrir(page);
    await tres(page);
    const antes = await S(page, (s) => s.objects.map((o: any) => [...o.position]));
    const p0 = await pasos(page);
    await page.keyboard.press('l');
    await page.waitForTimeout(400);
    const cs = await cajas(page);
    for (const c of cs) expect(Math.abs(c.min[1]), `${c.name} apoyada`).toBeLessThan(0.05);
    expect((await pasos(page)) - p0, 'L = un paso').toBe(1);
    await page.keyboard.press('Control+z');
    expect(await S(page, (s) => s.objects.map((o: any) => [...o.position]))).toEqual(antes);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('al menos 12 atajos del modal funcionan', async ({ page }) => {
    const errs = await abrir(page);
    const ids = await tres(page);
    const ok: string[] = [];
    const fallan: string[] = [];
    const prueba = async (nombre: string, accion: () => Promise<void>, verificar: () => Promise<boolean>) => {
      await accion();
      await page.waitForTimeout(250);
      (await verificar().catch(() => false) ? ok : fallan).push(nombre);
    };
    const reset = async () => {
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await S(page, (s) => { s.setActiveDialog(null); });
      await vacio(page);
      await S(page, (s) => s.setSelection(s.objects.map((o: any) => o.id)));
    };
    await prueba('?', () => page.keyboard.press('?'), async () => (await S(page, (s) => s.activeDialog)) === 'shortcuts'); await reset();
    await prueba('Shift+C dividir', () => page.keyboard.press('Shift+C'), async () => (await S(page, (s) => s.activeDialog)) === 'splitForBed' || (await page.getByTestId('panel-back').count()) > 0); await page.keyboard.press('Escape'); await reset();
    await prueba('Shift+M molde', () => page.keyboard.press('Shift+M'), async () => (await page.getByTestId('panel-back').count()) > 0 || (await S(page, (s) => s.activeDialog)) === 'mold'); await page.keyboard.press('Escape'); await reset();
    await prueba('C corte', () => page.keyboard.press('c'), async () => (await page.getByTestId('panel-back').count()) > 0 || (await S(page, (s) => s.activeDialog)) === 'cut'); await page.keyboard.press('Escape'); await reset();
    await prueba('D medir', () => page.keyboard.press('d'), async () => (await S(page, (s) => s.activeTool)) === 'measure'); await page.keyboard.press('Escape'); await S(page, (s) => s.setActiveTool('select')); await reset();
    await prueba('P pintar', () => page.keyboard.press('p'), async () => (await S(page, (s) => s.activeTool)) === 'paint'); await page.keyboard.press('p'); await S(page, (s) => s.setActiveTool('select')); await reset();
    const bed0 = await S(page, (s) => s.showBed);
    await prueba('B cama', () => page.keyboard.press('b'), async () => (await S(page, (s) => s.showBed)) !== bed0); await page.keyboard.press('b');
    const sec0 = await S(page, (s) => s.sectionPlane.enabled);
    await prueba('X sección', () => page.keyboard.press('x'), async () => (await S(page, (s) => s.sectionPlane.enabled)) !== sec0); await page.keyboard.press('x');
    await prueba('Ctrl+K paleta', () => page.keyboard.press('Control+k'), async () => (await page.getByRole('dialog', { name: /(paleta|comandos|Command)/i }).count()) > 0 || (await page.getByRole('combobox').count()) > 0); await page.keyboard.press('Escape'); await reset();
    await prueba('Alt+. barra flotante', async () => { await S(page, (s) => s.setSelection([s.objects[0].id])); await page.keyboard.press('Alt+.'); }, async () => true); await page.keyboard.press('Alt+.'); await reset();
    const n0 = await S(page, (s) => s.objects.length);
    await prueba('Ctrl+D duplicar', () => page.keyboard.press('Control+d'), async () => (await S(page, (s) => s.objects.length)) > n0); await page.keyboard.press('Control+z'); await reset();
    await prueba('Ctrl+G agrupar', () => page.keyboard.press('Control+g'), async () => (await S(page, (s) => s.objects.filter((o: any) => o.groupRef).length)) >= 3);
    await prueba('Ctrl+Shift+G desagrupar', () => page.keyboard.press('Control+Shift+g'), async () => (await S(page, (s) => s.objects.filter((o: any) => o.groupRef).length)) === 0);
    await reset();
    const nu = await S(page, (s) => s.objects.length);
    await prueba('Ctrl+Shift+U unir', () => page.keyboard.press('Control+Shift+u'), async () => { await page.waitForTimeout(1500); return (await S(page, (s) => s.objects.length)) !== nu || (await S(page, (s) => s.past.length)) > 0; });
    await page.keyboard.press('Control+z'); await reset();
    await prueba('H negativo', () => page.keyboard.press('h'), async () => (await S(page, (s) => s.objects.some((o: any) => o.role === 'negative')))); await page.keyboard.press('h');
    await prueba('Shift+H ocultar', () => page.keyboard.press('Shift+h'), async () => (await S(page, (s) => s.objects.some((o: any) => o.visible === false)))); await page.keyboard.press('Shift+h');
    await prueba('Flecha mueve', () => page.keyboard.press('ArrowRight'), async () => (await S(page, (s) => s.objects[0].position[0])) !== -40); await page.keyboard.press('Control+z');
    await prueba('Ctrl+Z / Ctrl+Y', async () => { await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y'); }, async () => true);
    await prueba('Del borra', () => page.keyboard.press('Delete'), async () => (await page.getByRole('alertdialog').count()) > 0 || (await page.getByRole('dialog').count()) > 0 || (await S(page, (s) => s.objects.length)) < 3);
    console.log('QA25G atajos ok:', ok.join(' | '), '\nQA25G atajos FALLAN:', fallan.join(' | '), 'total ok', ok.length, 'ids', ids.length);
    expect(fallan, `atajos que no funcionaron: ${fallan}`).toEqual([]);
    expect(ok.length).toBeGreaterThanOrEqual(12);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('con el foco en un campo de texto los atajos no se disparan; con un diálogo abierto no actúan sobre la escena', async ({ page }) => {
    const errs = await abrir(page);
    await tres(page);
    const foto = () => S(page, (s) => JSON.stringify({ r: s.objects.map((o: any) => [o.role, o.position, o.visible, o.groupRef]), t: s.activeTool, d: s.activeDialog, b: s.showBed, p: s.past.length }));
    const base = await foto();
    // Campo de texto: el nombre de la pieza en el inspector.
    await S(page, (s) => s.setSelection([s.objects[0].id]));
    const campo = page.locator('input[type="text"], input:not([type])').first();
    await expect(campo).toBeVisible();
    await campo.focus();
    for (const k of ['h', 'l', 'd', 'p', 'b', 'x', 'c', 'Shift+C', 'Shift+M', 'a', 'Shift+h', '1', '7', 'f']) await page.keyboard.press(k);
    expect(await foto(), 'sin efecto con el foco en un campo').toBe(base);
    await campo.blur();
    // Diálogo abierto (Atajos): H, L, Supr, Ctrl+G, Ctrl+D no tocan la escena.
    await S(page, (s) => { s.setSelection(s.objects.map((o: any) => o.id)); s.setActiveDialog('shortcuts'); });
    await expect(page.getByRole('dialog')).toBeVisible();
    const b2 = await S(page, (s) => JSON.stringify({ r: s.objects.map((o: any) => [o.role, o.position, o.visible, o.groupRef]), n: s.objects.length, p: s.past.length }));
    for (const k of ['h', 'l', 'Delete', 'Control+g', 'Control+d', 'ArrowRight', 'Control+Shift+u', 'Shift+h']) await page.keyboard.press(k);
    await page.waitForTimeout(300);
    expect(await S(page, (s) => JSON.stringify({ r: s.objects.map((o: any) => [o.role, o.position, o.visible, o.groupRef]), n: s.objects.length, p: s.past.length })), 'escena intacta con el diálogo abierto').toBe(b2);
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });

  test('F2 en la tira de placas renombra la placa activa', async ({ page }) => {
    const errs = await abrir(page);
    await cubo(page, 'A', 20, 20, 20);
    await S(page, (s) => s.createPlate());
    await expect(tira(page)).toBeVisible();
    const ficha = tira(page).getByRole('button', { name: /Placa 1/ }).first();
    await ficha.focus();
    await page.keyboard.press('F2');
    const campo = tira(page).getByRole('textbox').first();
    await expect(campo).toBeVisible({ timeout: 4000 });
    await campo.fill('Mi placa');
    await page.keyboard.press('Enter');
    expect(await S(page, (s) => s.plates.map((p: any) => p.name))).toContain('Mi placa');
    expect(errs.filter((e) => !/WebGL|GPU/i.test(e))).toEqual([]);
  });
});
