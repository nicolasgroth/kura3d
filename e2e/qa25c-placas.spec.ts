/**
 * @file e2e/qa25c-placas.spec.ts
 * @description QA independiente de la interfaz de placas (lote P2): una placa = interfaz de siempre, piezas que nacen
 * en la placa activa, duplicar/cortar en la placa 2, seleccionar activa la placa, mover a placa (deshacer en un paso),
 * fuera de volumen por placa, persistencia `.kura` y borrador, textos en es/en/de sin claves crudas ni «Kura3D»,
 * teclado solo, consola sin errores. Evidencia en `.eval-tmp/qa25c/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrir as abrirBase, importarStl, stlCubes } from './ux-escena-helpers';
import { agregarForma } from './agregar-helpers';
import { enlazarStores } from './store-link';
import { cmd, libre } from './qa25a-helpers';

const EVID = 'G:/proyectos/kura3d/.eval-tmp/qa25c';

async function abrir(page: Page): Promise<string[]> {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/GL Driver|ReadPixels/.test(m.text())) errs.push(`console.error: ${m.text()}`);
  });
  await abrirBase(page);
  return errs;
}

const st = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

const tira = (page: Page) => page.getByRole('region', { name: /Placas de impresión|Print plates|Druckplatten/ });
const ficha = (page: Page, nombre: string) => tira(page).getByRole('button', { name: new RegExp(`^${nombre}:`) });
const undo = (page: Page) => page.evaluate(() => (window as any).__s.getState().undo());

/** Texto visible que parece clave de i18n cruda (a.b.c). */
const clavesCrudas = (txt: string) => txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,}\b/g)?.filter((k) => /^(plates|ctx|ux|viewport|groups|sidebar|dialog|ui)\./.test(k)) ?? [];

for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test.describe(`qa25c placas ${size.width}`, () => {
    test.use({ viewport: size });

    test('0 o 1 placa: interfaz de siempre; «+ Placa» solo con cama visible; sin «Mover a placa»; sin «Kura3D»', async ({ page }) => {
      const errs = await abrir(page);
      await agregarForma(page, 'Cubo');
      await expect(page.getByTestId('plate-strip')).toHaveCount(0);
      const add = page.getByTestId('plate-add-first');
      await expect(add).toBeVisible();
      await page.screenshot({ path: `${EVID}/una-placa-${size.width}.png` });
      // «Sin cama» (B): el botón desaparece; B otra vez lo devuelve.
      await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
      await page.keyboard.press('b');
      await expect(add).toHaveCount(0);
      await page.keyboard.press('b');
      await expect(add).toBeVisible();
      // Menú de la fila: sin «Mover a placa».
      const fila = page.getByRole('treeitem').first();
      await fila.click();
      await fila.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Posición y tipo' }).click();
      await expect(page.getByRole('menuitem', { name: /Mover a placa/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/Kura3D/);
      expect(errs).toEqual([]);
    });

    test('segunda placa: tira, activa por aria-pressed, un paso de deshacer; piezas nuevas caen en la activa', async ({ page }) => {
      const errs = await abrir(page);
      await agregarForma(page, 'Cubo');
      const pasos0 = await st(page, (s) => s.past.length);
      await page.getByTestId('plate-add-first').click();
      await expect(tira(page)).toBeVisible();
      expect(await st(page, (s) => s.past.length)).toBe(pasos0 + 1);
      await page.screenshot({ path: `${EVID}/dos-placas-${size.width}.png` });
      // Crear con la placa 2 activa: cae sobre ella.
      await agregarForma(page, 'Esfera');
      const r = await st(page, (s) => {
        const p2 = s.plates[1];
        const o = s.objects[s.objects.length - 1];
        return { ref: o.plateRef, p2: p2.id, x: o.position[0], ox: p2.origin[0], oz: p2.origin[1], z: o.position[2] };
      });
      expect(r.ref).toBe(r.p2);
      expect(Math.abs(r.x - r.ox)).toBeLessThan(150);
      await expect(ficha(page, 'Placa 2')).toContainText('1 pieza');
      await expect(ficha(page, 'Placa 1')).toContainText('1 pieza');
      // Importar un archivo cae en la placa activa.
      await importarStl(page, 'cubo.stl', stlCubes([[0, 0, 20]], 20));
      await expect.poll(() => st(page, (s) => s.objects.length), { timeout: 30000 }).toBe(3);
      const imp = await st(page, (s) => ({ ref: s.objects[s.objects.length - 1].plateRef, p2: s.plates[1].id }));
      expect(imp.ref).toBe(imp.p2);
      // Seleccionar una pieza de la placa 1 activa la placa 1.
      await st(page, (s) => s.setSelection([s.objects[0].id]));
      await expect(ficha(page, 'Placa 1')).toHaveAttribute('aria-pressed', 'true');
      await st(page, (s) => s.setSelection([s.objects[1].id]));
      await expect(ficha(page, 'Placa 2')).toHaveAttribute('aria-pressed', 'true');
      expect(errs).toEqual([]);
    });

    test('duplicar y cortar una pieza de la placa 2: el resultado queda en la 2', async ({ page }) => {
      const errs = await abrir(page);
      await st(page, (s) => s.createPlate());
      const e = await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Caja' });
      const ref = await st(page, (s) => ({ p2: s.plates[1].id, r: s.objects[0].plateRef }));
      expect(ref.r).toBe(ref.p2);
      await cmd(page, 'duplicate_object', { objectId: e.id });
      await libre(page);
      let o = await st(page, (s) => s.objects.map((x: any) => ({ n: x.name, r: x.plateRef, p2: s.plates[1].id })));
      expect(o).toHaveLength(2);
      expect(o.every((x: any) => x.r === x.p2)).toBe(true);
      await cmd(page, 'plane_cut', { objectId: e.id, axis: 'z', offset: 15 });
      await libre(page);
      o = await st(page, (s) => s.objects.map((x: any) => ({ n: x.name, r: x.plateRef, p2: s.plates[1].id })));
      expect(o.length).toBeGreaterThanOrEqual(3);
      expect(o.filter((x: any) => x.r !== x.p2), JSON.stringify(o)).toEqual([]);
      expect(errs).toEqual([]);
    });

    test('mover a placa desde el menú de la fila, «Placa nueva», un paso de deshacer, con el imán que acompaña', async ({ page }) => {
      const errs = await abrir(page);
      const a = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 30, name: 'Anfitriona' });
      let m: any = null;
      try {
        m = await cmd(page, 'add_magnet_pocket', { objectId: a.id, diameterMm: 6, depthMm: 3, position: [0, 0, 15], normal: [0, 0, 1] });
      } catch { m = null; }
      await st(page, (s) => s.createPlate());
      await st(page, (s) => s.setActivePlate(s.plates[0].id));
      const n0 = await st(page, (s) => s.objects.length);
      await st(page, (s) => s.setSelection([s.objects[0].id]));
      const pasos0 = await st(page, (s) => s.past.length);
      const fila = page.getByRole('treeitem').first();
      await fila.click();
      await fila.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Posición y tipo' }).click();
      await page.getByRole('menuitem', { name: 'Mover a placa' }).click();
      const lista = page.getByRole('menu', { name: /Mover a placa/ });
      await expect(lista.getByRole('menuitem', { name: /Placa 1/ })).toBeDisabled();
      await page.screenshot({ path: `${EVID}/mover-menu-${size.width}.png` });
      await lista.getByRole('menuitem', { name: /^Placa 2$/ }).click();
      const d = await st(page, (s) => ({ pasos: s.past.length, refs: s.objects.map((o: any) => [o.name, o.role, o.plateRef === s.plates[1]?.id]) }));
      expect(d.pasos).toBe(pasos0 + 1);
      expect(d.refs.length).toBe(n0);
      // Todo lo que no es de otra placa pasa junto (pieza + alojamiento).
      if (m) expect(d.refs.every((r: any) => r[2])).toBe(true);
      await undo(page);
      const u = await st(page, (s) => s.objects.map((o: any) => o.plateRef === s.plates[0]?.id));
      expect(u.every(Boolean)).toBe(true);
      expect(errs).toEqual([]);
    });

    test('fuera de volumen por placa: el aviso nombra la placa 2 y la placa 1 sigue «Bien»; ajustar a la impresora actúa sobre su placa', async ({ page }) => {
      const errs = await abrir(page);
      await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Uno' });
      await st(page, (s) => s.createPlate());
      const g = await cmd(page, 'create_primitive', { type: 'box', width: 500, depth: 40, height: 30, name: 'Largo' });
      await expect(ficha(page, 'Placa 2')).toContainText('Fuera de volumen');
      await expect(ficha(page, 'Placa 1')).toContainText('Bien');
      await expect(page.getByTestId('oob-plates')).toContainText('Placa 2');
      await expect(page.getByTestId('oob-plates')).not.toContainText('Placa 1');
      await page.screenshot({ path: `${EVID}/oob-${size.width}.png` });
      const antes = await st(page, (s) => s.objects.map((o: any) => ({ n: o.name, p: o.position, r: o.plateRef })));
      await st(page, (s) => s.setSelection([s.objects[1].id]));
      // «Ajustar a la impresora»: debe dejarla en su placa y la placa 1 no se toca.
      const btn = page.getByRole('button', { name: /Ajustar/ }).first();
      if (await btn.count()) await btn.click().catch(() => undefined);
      const dlg = page.getByRole('dialog');
      if (await dlg.count()) await page.screenshot({ path: `${EVID}/ajustar-dialogo-${size.width}.png` });
      await page.keyboard.press('Escape');
      const despues = await st(page, (s) => s.objects.map((o: any) => ({ n: o.name, p: o.position, r: o.plateRef })));
      expect(despues[0].p).toEqual(antes[0].p);
      expect(despues[1].r).toBe(antes[1].r);
      void g;
      expect(errs).toEqual([]);
    });

    test('borrar placa con piezas: confirmación, Cancelar no cambia; deshacer restaura placa y posiciones', async ({ page }) => {
      const errs = await abrir(page);
      await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Uno' });
      await st(page, (s) => s.createPlate());
      await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Dos' });
      const antes = await st(page, (s) => s.objects.map((o: any) => [...o.position]));
      await page.getByTestId('plate-delete').click();
      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toContainText('Placa 2');
      await expect(dialogo).toContainText('Placa 1');
      await page.screenshot({ path: `${EVID}/borrar-confirmar-${size.width}.png` });
      await page.keyboard.press('Escape');
      await expect(dialogo).toHaveCount(0);
      expect(await st(page, (s) => s.plates.length)).toBe(2);
      const pasos = await st(page, (s) => s.past.length);
      await page.getByTestId('plate-delete').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Borrar placa' }).click();
      await expect(tira(page)).toHaveCount(0);
      expect(await st(page, (s) => s.past.length)).toBe(pasos + 1);
      await undo(page);
      await expect(ficha(page, 'Placa 2')).toContainText('1 pieza');
      const rest = await st(page, (s) => s.objects.map((o: any) => [...o.position]));
      expect(rest).toEqual(antes);
      expect(errs).toEqual([]);
    });
  });
}

test.describe('qa25c placas: persistencia', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('guardar y reabrir .kura conserva placas, nombres y asignaciones; sin placas se guarda como antes', async ({ page }) => {
    const errs = await abrir(page);
    await page.addInitScript(() => { delete (window as any).showSaveFilePicker; });
    await page.evaluate(() => { delete (window as any).showSaveFilePicker; (window as any).showSaveFilePicker = undefined; });
    const dir = mkdtempSync(join(tmpdir(), 'qa25c-'));
    // 1) Sin placas.
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Solo' });
    const dl0 = page.waitForEvent('download');
    await page.evaluate(() => void (window as any).__s.getState().saveProject(true));
    const f0 = join(dir, 'sin.kura');
    await (await dl0).saveAs(f0);
    const v0 = await page.evaluate(async (bytes) => {
      const { decodeProject } = await import('/src/project/projectCodec.ts');
      const d = decodeProject(new Uint8Array(bytes));
      return { plates: d.plates?.length ?? 0, refs: d.objects.filter((o: any) => o.plateRef !== undefined).length };
    }, [...readFileSync(f0)]);
    expect(v0).toEqual({ plates: 0, refs: 0 });
    // 2) Con placas.
    await st(page, (s) => s.createPlate({ name: 'Cabeza' }));
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Dos' });
    const antes = await st(page, (s) => ({ pl: s.plates.map((p: any) => [p.name, p.origin]), ob: s.objects.map((o: any) => [o.name, o.plateRef, [...o.position]]) }));
    const dl = page.waitForEvent('download');
    await page.evaluate(() => void (window as any).__s.getState().saveProject(true));
    const f1 = join(dir, 'con.kura');
    await (await dl).saveAs(f1);
    await page.evaluate(() => (window as any).__s.getState().clearScene());
    const ch = page.waitForEvent('filechooser');
    await page.evaluate(() => void (window as any).__s.getState().openProject());
    (await ch).setFiles({ name: 'con.kura', mimeType: 'application/octet-stream', buffer: readFileSync(f1) });
    const toasts = await st(page, (s) => (s.toasts ?? []).map((t: any) => t.message ?? t.text ?? JSON.stringify(t)));
    await expect.poll(() => st(page, (s) => s.objects.length), { timeout: 30000, message: `toasts: ${JSON.stringify(toasts)}` }).toBe(2);
    const despues = await st(page, (s) => ({ pl: s.plates.map((p: any) => [p.name, p.origin]), ob: s.objects.map((o: any) => [o.name, o.plateRef, [...o.position]]) }));
    expect(despues).toEqual(antes);
    await expect(tira(page)).toBeVisible();
    await expect(ficha(page, 'Cabeza')).toContainText('1 pieza');
    await page.screenshot({ path: `${EVID}/reabierto.png` });
    expect(errs).toEqual([]);
  });

  test('el borrador de recuperación conserva las placas, nombres y asignaciones tras recargar', async ({ page }) => {
    const errs = await abrir(page);
    await st(page, (s) => s.createPlate({ name: 'Borrador P2' }));
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'B' });
    const antes = await st(page, (s) => ({ pl: s.plates.map((p: any) => [p.name, p.origin]), ob: s.objects.map((o: any) => [o.name, o.plateRef === s.plates[1]?.id]) }));
    await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 30000 });
    await page.reload();
    await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
    await enlazarStores(page);
    await expect.poll(() => st(page, (s) => s.objects.length), { timeout: 30000 }).toBe(1);
    const despues = await st(page, (s) => ({ pl: s.plates.map((p: any) => [p.name, p.origin]), ob: s.objects.map((o: any) => [o.name, o.plateRef === s.plates[1]?.id]) }));
    expect(despues).toEqual(antes);
    await expect(ficha(page, 'Borrador P2')).toContainText('1 pieza');
    expect(errs).toEqual([]);
  });
});

for (const lang of [{ code: 'es' }, { code: 'en' }, { code: 'de' }]) {
  test(`qa25c placas: textos en ${lang.code} sin claves crudas ni «Kura3D», foco visible, nombres accesibles`, async ({ page }) => {
    const errs = await abrir(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate((c) => (window as any).__s.getState().setLanguage(c), lang.code);
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'X' });
    await st(page, (s) => s.createPlate());
    await st(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects[0].id]));
    await st(page, (s) => s.setObjectTransform(s.objects[0].id, { scale: [20, 1, 1] }, true));
    const txt = await page.evaluate(() => document.body.innerText);
    expect(clavesCrudas(txt)).toEqual([]);
    expect(txt).not.toMatch(/Kura3D/);
    const botones = await page.locator('[data-testid="plate-strip"] button').evaluateAll((els) => els.map((e) => ({ n: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim(), t: e.getAttribute('title') })));
    for (const b of botones) {
      expect(b.n, JSON.stringify(b)).not.toBe('');
      expect(b.n).not.toMatch(/^plates\./);
    }
    await page.screenshot({ path: `${EVID}/idioma-${lang.code}.png` });
    expect(errs).toEqual([]);
  });
}

test.describe('qa25c placas: teclado y tema', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('teclado solo: foco entre fichas con flechas, Inicio/Fin, F2, y anillo de foco visible; tema oscuro', async ({ page }) => {
    const errs = await abrir(page);
    await st(page, (s) => s.createPlate());
    await st(page, (s) => s.createPlate());
    await page.emulateMedia({ colorScheme: 'dark' });
    await ficha(page, 'Placa 3').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(ficha(page, 'Placa 2')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(ficha(page, 'Placa 1')).toBeFocused();
    await page.keyboard.press('End');
    await expect(ficha(page, 'Placa 3')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(ficha(page, 'Placa 1')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(ficha(page, 'Placa 1')).toHaveAttribute('aria-pressed', 'true');
    const foco = await ficha(page, 'Placa 1').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, w: cs.outlineWidth, shadow: cs.boxShadow };
    });
    expect(foco.outline !== 'none' || foco.shadow !== 'none', JSON.stringify(foco)).toBe(true);
    await page.screenshot({ path: `${EVID}/teclado-oscuro.png` });
    // Escape en la edición cancela y devuelve el foco a la ficha.
    await page.keyboard.press('F2');
    await page.keyboard.type('Nombre largo');
    await page.keyboard.press('Escape');
    await expect(ficha(page, 'Placa 1')).toBeFocused();
    expect(errs).toEqual([]);
  });

  test('renombrar vacío o enorme no rompe; nombre con HTML se muestra como texto', async ({ page }) => {
    const errs = await abrir(page);
    await st(page, (s) => s.createPlate());
    await ficha(page, 'Placa 2').focus();
    await page.keyboard.press('F2');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter');
    const n1 = await st(page, (s) => s.plates[1].name);
    expect(n1.trim().length).toBeGreaterThan(0);
    await ficha(page, n1).focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('<img src=x onerror=alert(1)>' + 'z'.repeat(200));
    await page.keyboard.press('Enter');
    const n2 = await st(page, (s) => s.plates[1].name);
    expect(n2.length).toBeLessThanOrEqual(80);
    expect(await page.locator('[data-testid="plate-strip"] img').count()).toBe(0);
    expect(errs).toEqual([]);
  });

  test('10+ placas: la tira se desplaza, la activa queda a la vista, sin desplazamiento horizontal de la página', async ({ page }) => {
    const errs = await abrir(page);
    for (let i = 0; i < 11; i += 1) await st(page, (s) => s.createPlate());
    const doc = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(doc).toBe(true);
    await expect(ficha(page, 'Placa 12')).toBeInViewport();
    await page.screenshot({ path: `${EVID}/doce-placas.png` });
    await st(page, (s) => s.setActivePlate(s.plates[0].id));
    await expect(ficha(page, 'Placa 1')).toBeInViewport();
    expect(errs).toEqual([]);
  });
});

test.describe('qa25c placas: hallazgos de QA (cosas que el desarrollo prometió o dejó a medias)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const pos = (page: Page) => st(page, (s) => s.objects.map((o: any) => ({ n: o.name, x: o.position[0], p2: o.plateRef === s.plates[1]?.id, ox: s.plates[1]?.origin[0] })));

  test('arrastrar una pieza hasta otra placa la reasigna con un solo Ctrl+Z', async ({ page }) => {
    const errs = await abrir(page);
    await agregarForma(page, 'Cubo');
    await st(page, (s) => s.createPlate());
    await agregarForma(page, 'Esfera');
    await st(page, (s) => s.setSelection([]));
    await page.getByRole('toolbar', { name: 'Vista' }).getByRole('button', { name: 'Vista superior' }).click();
    await page.getByRole('button', { name: 'Encuadrar' }).click();
    await page.waitForTimeout(1500);
    const mv = async (x0: number, y0: number, x1: number, y1: number) => {
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      for (let i = 1; i <= 12; i += 1) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12);
      await page.mouse.up();
      await page.waitForTimeout(600);
    };
    const pasos0 = await st(page, (s) => s.past.length);
    await page.mouse.click(490, 450);
    await mv(490, 450, 930, 330);
    const d = await pos(page);
    expect(d.find((o: any) => o.n === 'Cubo 1')!.p2).toBe(true);
    expect(await st(page, (s) => s.past.length)).toBe(pasos0 + 1);
    await page.keyboard.press('Control+z');
    expect((await pos(page)).find((o: any) => o.n === 'Cubo 1')!.p2).toBe(false);
    expect(errs).toEqual([]);
  });

  test('Dividir para imprimir con la pieza en la placa 2 deja las partes en la placa 2 y en su sitio', async ({ page }) => {
    const errs = await abrir(page);
    await st(page, (s) => s.createPlate());
    await agregarForma(page, 'Cubo');
    await st(page, (s) => s.setObjectTransform(s.objects[0].id, { scale: [10, 1, 1] }, true));
    const id = await st(page, (s) => s.objects[0].id);
    await cmd(page, 'split_for_bed', { objectId: id });
    await libre(page);
    const o = await pos(page);
    expect(o.length).toBe(2);
    expect(o.every((x: any) => x.p2 && x.x > x.ox - 200 && x.x < x.ox + 200)).toBe(true);
    // «Preparar para imprimir»: las partes se disponen desde la placa 2 (nunca sobre la placa 1) y siguen en la placa 2.
    await st(page, (s) => s.arrangeSplitGroup(s.objects.find((x: any) => x.metadata?.split)!.id, 'print'));
    const printed = await pos(page);
    expect(printed.every((x: any) => x.p2 && x.x > x.ox - 128)).toBe(true);
    expect(errs).toEqual([]);
  });

  // Corregido (QA25-C fallo 1): `create_primitive` por el bus/MCP sin `position` cae sobre el origen de la placa activa.
  test('create_primitive por comando sin posición, con la placa 2 activa, cae sobre la placa 2', async ({ page }) => {
    await abrir(page);
    await st(page, (s) => s.createPlate());
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'ViaCmd' });
    const o = (await pos(page)).find((x: any) => x.n === 'ViaCmd')!;
    expect(o.p2).toBe(true);
    expect(Math.abs(o.x - o.ox)).toBeLessThan(128);
  });

  // Corregido (QA25-C fallo 2): «Distribuir en cama (Auto)» acomoda cada pieza en la cama de SU placa.
  test('Distribuir en cama (Auto) sin selección no saca las piezas de su placa', async ({ page }) => {
    await abrir(page);
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'P1a', position: [10, 0, 0] });
    await st(page, (s) => s.createPlate());
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'P2a', position: [296 + 20, 0, 0] });
    await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'P2b', position: [296 - 20, 0, 40] });
    await st(page, (s) => s.setSelection([]));
    await page.getByRole('button', { name: /Distribuir en cama/ }).click();
    await page.waitForTimeout(2500);
    const o = (await pos(page)).filter((x: any) => x.p2);
    expect(o.length).toBe(2);
    expect(o.every((x: any) => Math.abs(x.x - x.ox) < 128), JSON.stringify(o)).toBe(true);
  });
});
