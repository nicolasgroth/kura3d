/**
 * @file e2e/qa22-ajustes.spec.ts
 * @description QA22: intenta romper el lote de ajustes de usabilidad ux8 en navegador real: colocación sin solape
 * (generadores y modelos importados reales), borradores de recuperación, nombres, Mayús+H, avisos, árbol, barra de
 * herramientas, Dividir, Medir, menú de clic derecho (ratón y teclado, es/en), Texto 3D, Pintura y Comprobar encaje.
 * Los modelos reales se leen de `.eval-tmp/modelos` (si no existen, esas pruebas se omiten). Evidencia en `.eval-tmp/qa22/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { aPixel } from './ux-movil-helpers';
import { agregarForma } from './agregar-helpers';
import { abrir, crear } from './ux3-edicion-helpers';
import { cajas, solapes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/qa22';
const MODELOS = 'G:/proyectos/kura3d/.eval-tmp/modelos';
const store = (page: Page) => page.evaluate(() => (window as any).__s.getState());

async function importar(page: Page, archivo: string): Promise<void> {
  const antes = await page.evaluate(() => (window as any).__s.getState().objects.length);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  const fc = await chooser;
  await fc.setFiles(`${MODELOS}/${archivo}`);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 90000 }).toBeGreaterThan(antes);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation ?? null), { timeout: 90000 }).toBeNull();
  await page.waitForTimeout(400);
}

/** Cama activa: caja en XZ (centrada en el origen). */
const cama = (page: Page) =>
  page.evaluate(async () => {
    const { activeBedSize } = await import('/src/store/bedSize.ts');
    return activeBedSize((window as any).__s.getState()) as { width: number; depth: number } | null;
  });

test.describe('1. Colocación', () => {
  test('texto, rosca, SVG, imagen y molde caen sin solapar y dentro de la cama', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    await crear(page, 'cylinder', { radius: 20, height: 40 }, [0, 20, 0]);
    await crear(page, 'box', { width: 60, height: 20, depth: 30 }, [60, 10, 0]);
    await page.evaluate(async () => {
      const s = (window as any).__s.getState();
      await s.createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
      await s.createThreadObject({ kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20, includeHead: true });
      await s.createThreadObject({ kind: 'nut', diameterMm: 8, pitchMm: 1.25, lengthMm: 8, includeHead: false });
    });
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation ?? null)).toBeNull();
    const bx = await cajas(page);
    expect(bx.length).toBeGreaterThanOrEqual(5);
    expect(solapes(bx)).toEqual([]);
    const c = await cama(page);
    if (c) for (const b of bx) {
      expect(b.min[0], b.name).toBeGreaterThanOrEqual(-c.width / 2 - 0.5);
      expect(b.max[0], b.name).toBeLessThanOrEqual(c.width / 2 + 0.5);
      expect(b.min[2], b.name).toBeGreaterThanOrEqual(-c.depth / 2 - 0.5);
      expect(b.max[2], b.name).toBeLessThanOrEqual(c.depth / 2 + 0.5);
    }
    await page.screenshot({ path: `${SHOTS}/p1-generadores.png` });
    expect(errs).toEqual([]);
  });

  test('cama llena: no cabe, deja aviso y no solapa', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const c = await cama(page);
    const w = (c?.width ?? 220) - 4;
    const d = (c?.depth ?? 220) - 4;
    await crear(page, 'box', { width: w, height: 10, depth: d }, [0, 5, 0]);
    await page.evaluate(async () => {
      await (window as any).__s.getState().createPrimitive('text', { text: 'HOLA', fontSize: 18, height: 6 }, { placement: 'free' });
    });
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().toasts.length)).toBeGreaterThan(0);
    const textos = await page.evaluate(() => (window as any).__s.getState().toasts.map((t: any) => t.text));
    console.log('avisos cama llena:', textos);
    expect(textos.join(' ')).toMatch(/cama|bed/i);
    expect(solapes(await cajas(page))).toEqual([]);
    expect(errs).toEqual([]);
  });

  for (const archivo of ['ocarina.3mf', 'llaveros.3mf', 'obj_1_OcarinaDeluxe.stl', 'Spiral+Phoenix+12cm+STL.stl']) {
    test(`importar ${archivo} dos veces: sin solape y a la vista`, async ({ page }) => {
      test.skip(!fs.existsSync(`${MODELOS}/${archivo}`), 'modelo no disponible');
      test.setTimeout(180000);
      const errs = await abrir(page, 1440, 900);
      await crear(page, 'cylinder', { radius: 15, height: 30 }, [0, 15, 0]);
      await importar(page, archivo);
      const n1 = (await store(page)).objects.length;
      await importar(page, archivo);
      const bx = await cajas(page);
      console.log(archivo, 'objetos', n1, '->', bx.length, 'solapes', solapes(bx).slice(0, 4));
      expect(solapes(bx)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/p1-import-${archivo.replace(/[^\w.]/g, '_')}.png` });
      expect(errs).toEqual([]);
    });
  }
});

test.describe('3. Nombres', () => {
  test('menor número libre: «Caja 1» con una sola caja, y al borrar la 1 se reutiliza', async ({ page }) => {
    await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 10, height: 10, depth: 10 });
    const n1 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).name, a);
    const b = await crear(page, 'box', { width: 10, height: 10, depth: 10 });
    const n2 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).name, b);
    await page.evaluate((i) => (window as any).__s.getState().deleteObjects([i]), a);
    const c = await crear(page, 'box', { width: 10, height: 10, depth: 10 });
    const n3 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).name, c);
    console.log('nombres', n1, n2, n3);
    expect(n1).toMatch(/1$/);
    expect(n2).toMatch(/2$/);
    expect(n3).toBe(n1);
  });

  test('mitades de corte distinguibles', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const id = await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [0, 15, 0]);
    await page.evaluate((i) => {
      const st = (window as any).__s.getState();
      st.selectObject(i);
      st.setActiveDialog('cut');
    }, id);
    const dlg = page.getByRole('dialog', { name: 'Corte por plano + uniones' });
    await expect(dlg).toBeVisible();
    await page.getByLabel('Tipo de conector').selectOption('none');
    await page.getByRole('button', { name: /Ejecutar Corte/ }).click();
    await expect(dlg).toBeHidden({ timeout: 60000 });
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().busyOperation ?? null)).toBeNull();
    const nombres: string[] = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.name));
    console.log('mitades', nombres);
    expect(nombres.length).toBe(2);
    expect(new Set(nombres).size).toBe(2);
    expect(errs).toEqual([]);
  });

  test('exportar escena propone el nombre del proyecto', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    await crear(page, 'box', { width: 10, height: 10, depth: 10 });
    await page.evaluate(() => {
      const st = (window as any).__s.getState();
      st.setProjectName?.('Mi Proyecto QA');
    });
    const nombreProy = await page.evaluate(() => (window as any).__s.getState().projectName);
    console.log('projectName', nombreProy);
    await page.evaluate(() => (window as any).__s.getState().setActiveDialog('export'));
    const dlg = page.getByRole('dialog').first();
    await expect(dlg).toBeVisible();
    const campos = await dlg.locator('input[type=text], input:not([type])').evaluateAll((els) => els.map((e: any) => e.value));
    console.log('campos export', campos);
    await page.screenshot({ path: `${SHOTS}/p3-export.png` });
    if (nombreProy) expect(campos.join('|')).toContain(nombreProy);
    expect(errs).toEqual([]);
  });
});

test.describe('4. Mayús+H', () => {
  test('oculta/muestra, un solo paso de deshacer, sin selección muestra todo; H sola no oculta', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [-30, 10, 0]);
    const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [30, 10, 0]);
    const vis = (i: string) => page.evaluate((x) => (window as any).__s.getState().objects.find((o: any) => o.id === x).visible, i);
    const role = (i: string) => page.evaluate((x) => (window as any).__s.getState().objects.find((o: any) => o.id === x).role, i);
    await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), a);
    await page.locator('canvas').first().hover();
    const past0 = (await store(page)).past.length;
    await page.keyboard.press('Shift+H');
    expect(await vis(a)).toBe(false);
    expect((await store(page)).past.length).toBe(past0 + 1);
    await page.keyboard.press('Control+z');
    expect(await vis(a)).toBe(true);
    await page.keyboard.press('Control+y');
    expect(await vis(a)).toBe(false);
    // sin selección: muestra todo lo oculto
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    await page.keyboard.press('Shift+H');
    expect(await vis(a)).toBe(true);
    expect(await vis(b)).toBe(true);
    // sin selección y nada oculto: no hace nada ni agrega historial
    const p1 = (await store(page)).past.length;
    await page.keyboard.press('Shift+H');
    expect((await store(page)).past.length).toBe(p1);
    // H sola: alterna Sólido/Negativo o no oculta
    await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), b);
    const r0 = await role(b);
    await page.keyboard.press('h');
    console.log('H sola: rol', r0, '->', await role(b), 'visible', await vis(b));
    expect(await vis(b)).toBe(true);
    // Selección múltiple mixta: una oculta y otra no -> oculta ambas
    await page.evaluate(({ a, b }) => (window as any).__s.getState().setSelection([a, b]), { a, b });
    await page.keyboard.press('Shift+H');
    expect([await vis(a), await vis(b)]).toEqual([false, false]);
    expect(errs).toEqual([]);
  });

  test('Mayús+H con el foco en un campo de texto no oculta objetos', async ({ page }) => {
    await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 });
    await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), a);
    await page.getByRole('button', { name: /Renombrar/ }).first().click().catch(() => undefined);
    await page.keyboard.press('F2');
    const inp = page.locator('input[type=text]:focus').first();
    if (await inp.count()) {
      await page.keyboard.type('HOLA');
      const v = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).visible, a);
      expect(v).toBe(true);
    }
  });
});

test.describe('2. Borradores', () => {
  const esperarBorrador = (page: Page) => expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 40000 });
  const recargar = async (page: Page) => {
    await page.reload();
    await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
    const { enlazarStores } = await import('./store-link');
    await enlazarStores(page);
  };

  test('una escena vacía no deja ni ofrece borrador', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const id = await crear(page, 'box', { width: 10, height: 10, depth: 10 });
    await esperarBorrador(page);
    await page.evaluate((i) => (window as any).__s.getState().deleteObjects([i]), id);
    await page.waitForTimeout(3500);
    await recargar(page);
    await page.waitForTimeout(2500);
    const aviso = await page.getByText('Borradores locales').count();
    await page.screenshot({ path: `${SHOTS}/p2-vacio.png` });
    expect(aviso, 'no debe ofrecerse un borrador vacío').toBe(0);
    expect(errs).toEqual([]);
  });

  test('recuperar cierra el aviso; los demás borradores reaparecen al recargar; sin pérdida', async ({ page }) => {
    test.setTimeout(240000);
    const errs = await abrir(page, 1440, 900);
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('box', undefined, { name: 'Sesion1' }); });
    await esperarBorrador(page);
    await recargar(page);
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('sphere', undefined, { name: 'Sesion2' }); });
    await esperarBorrador(page);
    await recargar(page);
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    const filas = await page.getByRole('button', { name: 'Recuperar', exact: true }).count();
    console.log('borradores ofrecidos tras 2 sesiones:', filas);
    expect(filas).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: `${SHOTS}/p2-dos-borradores.png` });
    await page.getByRole('button', { name: 'Recuperar', exact: true }).first().click();
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(1);
    await expect(page.getByText('Borradores locales')).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(3500);
    await recargar(page);
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    expect(errs).toEqual([]);
  });

  test('descartar cierra el aviso y no borra los otros', async ({ page }) => {
    test.setTimeout(240000);
    page.on('dialog', (d) => void d.accept());
    await abrir(page, 1440, 900);
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('box', undefined, { name: 'S1' }); });
    await esperarBorrador(page);
    await recargar(page);
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('sphere', undefined, { name: 'S2' }); });
    await esperarBorrador(page);
    await recargar(page);
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    const antes = await page.getByRole('button', { name: 'Recuperar', exact: true }).count();
    await page.getByRole('button', { name: 'Descartar' }).first().click();
    const conf = page.getByRole('dialog').getByRole('button', { name: /Descartar|Sí|Confirmar/ });
    if (await conf.count()) await conf.last().click();
    await page.waitForTimeout(1500);
    console.log('borradores antes de descartar', antes, '; aviso visible tras descartar:', await page.getByText('Borradores locales').isVisible());
    await page.screenshot({ path: `${SHOTS}/p2-descartar.png` });
    expect(await page.getByText('Borradores locales').isVisible()).toBe(false);
    await page.waitForTimeout(3500);
    await recargar(page);
    await page.waitForTimeout(2000);
    const despues = await page.getByRole('button', { name: 'Recuperar', exact: true }).count();
    console.log('tras recargar quedan', despues);
    expect(despues).toBe(Math.max(antes - 1, 0));
  });
});

test.describe('7. Barra de herramientas', () => {
  test('una pulsada y ninguna apagada al cambiar de herramienta y al borrar o deseleccionar', async ({ page }) => {
    const errs = await abrir(page, 1280, 720);
    const pulsadas = page.locator('#kura-tool-rail button[aria-pressed="true"]');
    const apagadaPulsada = () => page.locator('#kura-tool-rail button[aria-pressed="true"][aria-disabled="true"]');
    const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [0, 10, 0]);
    const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [40, 10, 0]);
    for (const modo of ['translate', 'rotate', 'scale'] as const) {
      await page.evaluate(({ a, modo }) => { const s = (window as any).__s.getState(); s.setSelection([a]); s.setTransformMode(modo); }, { a, modo });
      await expect(pulsadas, modo).toHaveCount(1);
      await expect(apagadaPulsada()).toHaveCount(0);
    }
    for (const tool of ['paint', 'cut', 'measure', 'select'] as const) {
      await page.evaluate(({ a, tool }) => { const s = (window as any).__s.getState(); s.setSelection([a]); s.setActiveTool(tool); }, { a, tool });
      await expect(pulsadas, `herramienta ${tool}`).toHaveCount(1);
      await expect(apagadaPulsada()).toHaveCount(0);
      await page.evaluate(() => (window as any).__s.getState().setSelection([]));
      await expect(pulsadas, `${tool} sin selección`).toHaveCount(1);
      await expect(apagadaPulsada()).toHaveCount(0);
    }
    await page.evaluate(({ a, b }) => { const s = (window as any).__s.getState(); s.setSelection([a]); s.setActiveTool('paint'); s.deleteObjects([a, b]); }, { a, b });
    await expect(pulsadas).toHaveCount(1);
    await expect(apagadaPulsada()).toHaveCount(0);
    await page.evaluate(() => (window as any).__s.getState().undo());
    await expect(pulsadas).toHaveCount(1);
    await expect(apagadaPulsada()).toHaveCount(0);
    await page.locator('canvas').first().hover();
    for (const k of ['g', 'r', 's', 'v', 'm', 'Escape']) {
      await page.keyboard.press(k);
      await expect(pulsadas, `tecla ${k}`).toHaveCount(1);
      await expect(apagadaPulsada(), `tecla ${k}`).toHaveCount(0);
    }
    expect(errs).toEqual([]);
  });
});

test.describe('9. Medir', () => {
  test('activar Medir no mueve la cámara y el panel es legible', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
    await page.waitForTimeout(1200);
    const cam = () => page.evaluate(() => {
      const c = (window as any).__r3f.getState().camera;
      return [c.position.x, c.position.y, c.position.z, c.zoom];
    });
    for (const sel of [[id], []]) {
      await page.evaluate((s) => (window as any).__s.getState().setSelection(s), sel);
      await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
      await page.waitForTimeout(500);
      const antes = await cam();
      await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
      await page.waitForTimeout(1500);
      const despues = await cam();
      console.log('camara', sel.length ? 'con seleccion' : 'sin seleccion', antes.map((n) => +n.toFixed(2)), despues.map((n) => +n.toFixed(2)));
      for (let i = 0; i < 4; i++) expect(Math.abs(despues[i] - antes[i]), `eje ${i}`).toBeLessThan(0.01);
    }
    const panel = page.getByTestId('panel-tool');
    await expect(panel).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/p9-medir.png` });
    expect(await panel.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false);
    expect(errs).toEqual([]);
  });
});
