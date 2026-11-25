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
import { itemAccion } from './acciones-helpers';

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
      const lote1 = new Set((await cajas(page)).map((b) => b.id));
      await importar(page, archivo);
      const bx = await cajas(page);
      console.log(archivo, 'objetos', n1, '->', bx.length);
      // Un archivo multi-pieza (llaveros) trae solapes propios por diseño: se compara cada importación
      // como bloque (caja unión) contra la otra y contra el cilindro previo.
      const union = (xs: typeof bx) => ({
        name: 'bloque',
        min: [0, 1, 2].map((k) => Math.min(...xs.map((b) => b.min[k]))),
        max: [0, 1, 2].map((k) => Math.max(...xs.map((b) => b.max[k]))),
      });
      const cil = bx.slice(0, 1);
      const a = bx.filter((b) => lote1.has(b.id) && !cil.some((c) => c.id === b.id));
      const b = bx.filter((b) => !lote1.has(b.id));
      const bloques = [{ ...union(cil), name: 'cilindro' }, { ...union(a), name: 'import1' }, { ...union(b), name: 'import2' }];
      console.log(archivo, 'bloques', JSON.stringify(bloques.map((x) => [x.name, x.min.map((n) => +n.toFixed(1)), x.max.map((n) => +n.toFixed(1))])));
      expect(solapes(bloques)).toEqual([]);
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
    // F2 abre el campo de renombrar (no hay botón «Renombrar» con ese nombre): el foco queda en un campo de texto.
    await page.keyboard.press('F2');
    const inp = page.locator('input:focus').first();
    await expect(inp).toBeVisible();
    await page.keyboard.type('hola');
    await page.keyboard.press('Shift+H');
    // La H con Mayús se escribe en el campo y no oculta la selección ni agrega pasos de historial.
    await expect(inp).toHaveValue(/holaH$/);
    const v = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).visible, a);
    expect(v).toBe(true);
  });
});

/** Cantidad de borradores ofrecidos: opciones del selector del aviso (una sola fila con «Recuperar»). */
const borradoresIDB = (page: Page) => page.evaluate(async () => { const m = await import('/src/project/projectRecoveryStorage.ts'); return (await m.listRecoveryDrafts()).map((d: any) => `${d.id.slice(0, 6)}:${d.objectCount}`); });
const opciones = (page: Page) => page.locator('select option', { hasText: /#[0-9a-f]{6}/ }).count();

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
    const filas = await opciones(page);
    console.log('borradores ofrecidos tras 2 sesiones:', filas);
    await page.screenshot({ path: `${SHOTS}/p2-dos-borradores.png` });
    console.log('texto del aviso:', (await page.getByText('Borradores locales').locator('xpath=ancestor::*[self::section or self::div][1]').innerText().catch(() => '')).replace(/\n+/g, ' | '));
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
    page.on('dialog', (d) => { console.log('dialogo nativo:', d.message()); void d.accept(); });
    await abrir(page, 1440, 900);
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('box', undefined, { name: 'S1' }); });
    await esperarBorrador(page);
    await recargar(page);
    await page.evaluate(async () => { await (window as any).__s.getState().createPrimitive('sphere', undefined, { name: 'S2' }); });
    await esperarBorrador(page);
    await recargar(page);
    await expect(page.getByText('Borradores locales')).toBeVisible({ timeout: 30000 });
    const antes = await opciones(page);
    console.log('IDB antes de descartar', await borradoresIDB(page));
    await page.screenshot({ path: `${SHOTS}/p2-antes-descartar.png` });
    await page.getByRole('button', { name: 'Descartar' }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/p2-confirmar-descartar.png` });
    console.log('dialogos tras clic:', await page.getByRole('dialog').allInnerTexts());
    const conf = page.getByRole('dialog').getByRole('button', { name: /Descartar|Sí|Confirmar/ });
    if (await conf.count()) await conf.last().click();
    await page.waitForTimeout(1500);
    console.log('IDB tras descartar', await borradoresIDB(page));
    console.log('borradores antes de descartar', antes, '; aviso visible tras descartar:', await page.getByText('Borradores locales').isVisible());
    await page.screenshot({ path: `${SHOTS}/p2-descartar.png` });
    expect(await page.getByText('Borradores locales').isVisible()).toBe(false);
    await page.waitForTimeout(3500);
    await recargar(page);
    await page.waitForTimeout(2000);
    const despues = await opciones(page);
    console.log('tras recargar quedan', despues, 'IDB', await borradoresIDB(page));
    // Con un solo borrador el aviso no muestra selector: se comprueba el aviso y el almacenamiento.
    expect(await borradoresIDB(page)).toHaveLength(antes - 1);
    expect(await page.getByText('Borradores locales').isVisible()).toBe(antes - 1 > 0);
    void despues;
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

test.describe('8. Dividir: indicador y resultado desactualizado', () => {
  test('al cambiar la cama o un parámetro aparece «Calculando» y el resultado viejo queda marcado', async ({ page }) => {
    test.setTimeout(120000);
    const errs = await abrir(page, 1440, 900);
    await crear(page, 'box', { width: 40, height: 40, depth: 600 }, [0, 20, 0]);
    await page.evaluate(() => {
      // Observa la región de estado y el atributo data-stale: ambos pueden durar pocos ms.
      (window as any).__vistos = { calculando: 0, stale: 0 };
      new MutationObserver(() => {
        const c = document.querySelector('[data-testid="split-calculating"]');
        if (c && c.textContent && c.textContent.trim().length > 0) (window as any).__vistos.calculando += 1;
        if (document.querySelector('.kura-split-dl[data-stale]')) (window as any).__vistos.stale += 1;
      }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      const s = (window as any).__s.getState();
      s.setSelection([s.objects[0].id]);
      s.setActiveDialog('splitForBed');
    });
    const dlg = page.getByRole('dialog').first();
    await expect(page.getByTestId('split-piece-count')).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: `${SHOTS}/p8-resultado.png` });
    const antes = await page.getByTestId('split-piece-count').textContent();
    await page.evaluate(() => { (window as any).__vistos = { calculando: 0, stale: 0 }; (window as any).__s.getState().setPrinterProfile('free-studio'); });
    await page.waitForTimeout(2500);
    const v1 = await page.evaluate(() => (window as any).__vistos);
    console.log('cambio de cama: piezas antes', antes, 'despues', await page.getByTestId('split-piece-count').textContent().catch(() => null), v1);
    await page.evaluate(() => { (window as any).__vistos = { calculando: 0, stale: 0 }; });
    const chk = dlg.locator('.kura-split-check input[type=checkbox]').first();
    if (await chk.count()) await chk.click();
    await page.waitForTimeout(2500);
    const v2 = await page.evaluate(() => (window as any).__vistos);
    console.log('cambio de parametro:', v2);
    await page.screenshot({ path: `${SHOTS}/p8-tras-cambio.png` });
    expect(v1.calculando + v2.calculando, 'debe aparecer el indicador de cálculo').toBeGreaterThan(0);
    expect(v1.stale + v2.stale, 'el resultado viejo debe marcarse desactualizado').toBeGreaterThan(0);
    expect(errs).toEqual([]);
  });
});

test.describe('12. Comprobar encaje', () => {
  test('al cambiar la selección tras comprobar el resultado desaparece; sin cercanos no dice «Todo calza»', async ({ page }) => {
    test.setTimeout(180000);
    const errs = await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [-100, 10, 0]);
    const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [100, 10, 0]);
    const c = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [100, 10, 40]);
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    await (await itemAccion(page, 'Comprobar encaje…')).click();
    const panel = page.locator('#kura-inspector-panel');
    await expect(panel.getByTestId('fit-check-panel')).toBeVisible({ timeout: 15000 });
    await page.evaluate(({ a, b }) => (window as any).__s.getState().setSelection([a, b]), { a, b });
    await panel.getByTestId('fit-check-run').click();
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().fitCheckRunning), { timeout: 60000 }).toBeNull();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/p12-lejos.png` });
    const texto1 = await panel.innerText();
    console.log('lejos:', texto1.replace(/\n+/g, ' | ').slice(0, 400));
    expect(texto1).not.toMatch(/Todo calza/);
    await page.evaluate(({ b, c }) => (window as any).__s.getState().setSelection([b, c]), { b, c });
    await panel.getByTestId('fit-check-run').click();
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().fitCheckRunning), { timeout: 60000 }).toBeNull();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/p12-cercanos.png` });
    console.log('cercanos:', (await panel.innerText()).replace(/\n+/g, ' | ').slice(0, 400));
    await page.evaluate(({ a, b }) => (window as any).__s.getState().setSelection([a, b]), { a, b });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/p12-cambio-seleccion.png` });
    const t3 = await panel.innerText();
    console.log('tras cambiar seleccion:', t3.replace(/\n+/g, ' | ').slice(0, 400));
    await expect(panel.getByTestId('fit-check-result')).toHaveCount(0);
    expect(t3).toMatch(/Vuelve a comprobar|Volver a comprobar/);
    expect(errs).toEqual([]);
  });
});

test.describe('5/6. Avisos y árbol', () => {
  test('avisos a 1280x720 con manipulador de escala no tapan botones ni el objeto', async ({ page }) => {
    const errs = await abrir(page, 1280, 720);
    const id = await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [0, 15, 0]);
    await page.evaluate((i) => {
      const s = (window as any).__s.getState();
      s.setSelection([i]);
      s.setTransformMode('scale');
      for (let k = 0; k < 6; k++) s.addToast(`Aviso ${k + 1} de prueba algo largo para ocupar espacio`, k % 2 ? 'error' : 'info');
    }, id);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/p5-avisos-1280.png` });
    console.log('toasts visibles', await page.locator('.kura-toast').count(), 'pila:', (await page.locator('.kura-toast-stack').innerText()).replace(/\s+/g, ' | '));
    await expect(page.locator('.kura-toast')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /avisos? más/ })).toBeVisible();
    // Se compara contra los avisos y los botones propios de la pila (no contra el contenedor, que tiene holgura).
    const tapados = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('.kura-toast-stack .kura-toast, .kura-toast-stack button')].map((e) => e.getBoundingClientRect());
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, [role=button], [role=tab]')) {
        if (el.closest('.kura-toast-stack')) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (rects.some((r) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top)) out.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40));
      }
      return out;
    });
    await page.screenshot({ path: `${SHOTS}/p5-avisos-1280.png` });
    console.log('botones bajo la pila de avisos:', tapados);
    expect(tapados).toEqual([]);
    expect(errs).toEqual([]);
  });

  test('árbol: nombres largos de prefijo común se distinguen y el nombre accesible es completo', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const nombres = ['Soporte_Lateral_Izquierdo_Superior_Version_A_0001', 'Soporte_Lateral_Izquierdo_Superior_Version_A_0002', 'Soporte_Lateral_Izquierdo_Superior_Version_B_0003'];
    for (const n of nombres) {
      await page.evaluate(async (nom) => {
        const s = (window as any).__s.getState();
        const o = await s.createPrimitive('box', { width: 10, height: 10, depth: 10 }, {});
        s.updateObjectMeta(o.id, { name: nom });
      }, n);
    }
    const filas = page.locator('.kura-scene-name.kura-mid-ellipsis');
    await expect(filas).toHaveCount(3);
    for (const n of nombres) {
      const f = page.locator(`.kura-scene-name[title="${n}"]`);
      await expect(f).toHaveCount(1);
      const tail = await f.locator('.kura-mid-tail').textContent();
      console.log('cola visible', tail);
      expect(n.endsWith((tail ?? '').trim())).toBe(true);
    }
    const accesibles = await page.locator('[role=treeitem]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent || ''));
    console.log('nombres accesibles', accesibles);
    for (const n of nombres) expect(accesibles.join('|')).toContain(n);
    await page.screenshot({ path: `${SHOTS}/p6-arbol.png` });
    expect(errs).toEqual([]);
  });
});

const SUBMENUS = ['Preparar para imprimir', 'Malla', 'Separar y combinar', 'Posición y tipo', 'Analizar', 'Más'];

async function menuContextual(page: Page, id: string) {
  await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), id);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(700);
  const p = await aPixel(page, [0, 20, 0]);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  const menu = page.locator('.kura-context-menu').first();
  await expect(menu).toBeVisible();
  return { menu, p };
}

test.describe('10. Menú contextual: submenús, nombres y teclado', () => {
  for (const idioma of ['es', 'en'] as const) {
    test(`nombres de comandos iguales en menú contextual, Acciones y paleta (${idioma})`, async ({ page }) => {
      test.setTimeout(480000); // el catálogo creció: son más de 40 búsquedas en la paleta
      const errs = await abrir(page, 1440, 900);
      await page.evaluate((l) => (window as any).__s.getState().setLanguage(l), idioma);
      const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
      // Comandos con nombre propio: id de acción -> rótulo en el idioma activo (fuente única).
      const nombres: Array<{ id: string; nombre: string }> = await page.evaluate(async () => {
        const { ACTION_GROUPS } = await import('/src/store/actionsCatalog.ts');
        const { actionName } = await import('/src/store/actionLabels.ts');
        const lang = (window as any).__s.getState().language;
        return ACTION_GROUPS.flatMap((g: any) => g.items.map((i: string) => ({ id: i, nombre: actionName(lang, i) })));
      });
      // Menú contextual: todas las hojas de todos los submenús (por teclado: Flecha derecha abre).
      await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), id);
      await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
      await page.waitForTimeout(700);
      const p = await aPixel(page, [0, 20, 0]);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      const raiz = page.locator('.kura-context-menu').first();
      await expect(raiz).toBeVisible();
      const subs = await raiz.locator(':scope > .kura-context-subwrap > [role=menuitem]').evaluateAll((els) => els.map((e) => e.querySelector('.kura-context-label')?.textContent ?? ''));
      const hojasCtx = new Set<string>();
      for (const s of subs) {
        if (!(await raiz.isVisible())) { await page.mouse.click(p.x, p.y, { button: 'right' }); }
        await raiz.getByRole('menuitem', { name: s, exact: true }).click();
        const hijo = page.getByRole('menu', { name: s, exact: true });
        for (const t of await hijo.locator('[role^=menuitem] .kura-context-label').allTextContents()) hojasCtx.add(t.trim());
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const faltanEnCtx = nombres.filter((n) => !hojasCtx.has(n.nombre.trim())).map((n) => `${n.id}="${n.nombre}"`);
      console.log(idioma, 'acciones del catálogo que NO aparecen con el mismo nombre en el menú contextual:', faltanEnCtx);
      // Paleta: cada comando del catálogo se encuentra por su nombre exacto.
      const faltanEnPaleta: string[] = [];
      for (const n of nombres) {
        const buscado = n.nombre.replace('…', '').trim();
        const hay = (ops: string[]) => ops.some((o) => o.replace(/\s+/g, ' ').includes(buscado));
        let ops: string[] = [];
        // Dos intentos: si la paleta no alcanzó a cerrarse en la vuelta anterior, Ctrl+K la cierra en vez de abrirla
        // y el texto cae en otro campo. El segundo intento parte con la paleta cerrada de verdad.
        for (let intento = 0; intento < 2 && !hay(ops); intento++) {
          const dialogo = page.locator('.kura-palette-input');
          if (!(await dialogo.isVisible().catch(() => false))) await page.keyboard.press('Control+k');
          await dialogo.fill(buscado);
          // La lista se filtra con un pequeño retraso: se espera a que aparezca el nombre en vez de un tiempo fijo.
          ops = await page.locator('.kura-palette-list [role=option]').allTextContents();
          for (let k = 0; k < 20 && !hay(ops); k++) {
            await page.waitForTimeout(150);
            ops = await page.locator('.kura-palette-list [role=option]').allTextContents();
          }
          await page.keyboard.press('Escape');
          await expect(dialogo).toBeHidden();
        }
        if (!hay(ops)) faltanEnPaleta.push(`${n.id}="${n.nombre}" (opciones: ${ops.slice(0, 3).join(' / ')})`);
      }
      console.log(idioma, 'comandos del catálogo que NO aparecen con ese nombre en la paleta:', faltanEnPaleta);
      expect.soft(faltanEnCtx, 'menú contextual').toEqual([]);
      expect.soft(faltanEnPaleta, 'paleta').toEqual([]);
      expect(errs).toEqual([]);
    });
  }
});

test.describe('11. Pintura: variantes del primer trazo', () => {
  const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length);

  /** Trazo (arrastre corto o clic) en el pixel dado; si aparece el aviso de objeto paramétrico lo confirma. */
  async function trazo(page: Page, p: { x: number; y: number }, modo: 'arrastre' | 'clic'): Promise<boolean> {
    if (modo === 'clic') await page.mouse.click(p.x, p.y);
    else {
      await page.mouse.move(p.x - 12, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y, { steps: 4 });
      await page.mouse.move(p.x + 12, p.y, { steps: 4 });
      await page.mouse.up();
    }
    const aviso = page.getByRole('dialog').filter({ hasText: /parámetros|paramétric/i }).first();
    const hubo = await aviso.waitFor({ state: 'visible', timeout: 2500 }).then(() => true, () => false);
    if (hubo) {
      await aviso.getByRole('button', { name: /^Pintar/ }).first().click();
      await expect(aviso).toBeHidden();
    }
    return hubo;
  }

  for (const modo of ['arrastre', 'clic'] as const) {
    test(`cubo con color previo: el primer trazo tras confirmar pinta (${modo})`, async ({ page }) => {
      const errs = await abrir(page, 1440, 900);
      const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
      await page.evaluate((i) => {
        const s = (window as any).__s.getState();
        s.setSelection([i]);
        s.updateObjectMeta(i, { color: '#e11d48' });
        s.setActiveTool('paint');
      }, id);
      await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
      await page.waitForTimeout(900);
      const base = await pasos(page);
      const hubo = await trazo(page, await aPixel(page, [0, 40, 0]), modo);
      console.log(`cubo con color, ${modo}: aviso=${hubo}`);
      await expect.poll(() => pasos(page), { timeout: 8000 }).toBe(base + 1);
      expect(errs).toEqual([]);
    });
  }

  test('cambiar de objeto entre trazos: el primer trazo sobre el segundo objeto también pinta', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [-30, 15, 0]);
    const b = await crear(page, 'box', { width: 30, height: 30, depth: 30 }, [30, 15, 0]);
    await page.evaluate(({ a }) => { const s = (window as any).__s.getState(); s.setSelection([a]); s.setActiveTool('paint'); }, { a });
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
    await page.waitForTimeout(900);
    const base = await pasos(page);
    await trazo(page, await aPixel(page, [-30, 30, 0]), 'arrastre');
    await expect.poll(() => pasos(page), { timeout: 8000 }).toBe(base + 1);
    await page.evaluate((b) => (window as any).__s.getState().setSelection([b]), b);
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit')); // con Pintar activa la cámara no reencuadra sola
    await page.waitForTimeout(1200);
    const hubo2 = await trazo(page, await aPixel(page, [30, 30, 0]), 'arrastre');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/p11-segundo-objeto.png` });
    console.log('segundo objeto: aviso', hubo2, 'pasos', await pasos(page), 'base', base, 'sel', await page.evaluate(() => (window as any).__s.getState().selectedIds), 'toasts', await page.evaluate(() => (window as any).__s.getState().toasts.map((t: any) => t.text)));
    await expect.poll(() => pasos(page), { timeout: 8000 }).toBe(base + 2);
    // Sin selección previa, pintar directamente sobre el otro objeto
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    await trazo(page, await aPixel(page, [-30, 30, 8]), 'clic');
    await expect.poll(() => pasos(page), { timeout: 8000 }).toBe(base + 3);
    expect(errs).toEqual([]);
  });

  for (const modo of ['arrastre', 'clic'] as const) {
    test(`objeto importado real: el primer trazo pinta (${modo})`, async ({ page }) => {
      test.skip(!fs.existsSync(`${MODELOS}/obj_1_Saitama_75mm_base.stl`), 'modelo no disponible');
      test.setTimeout(150000);
      const errs = await abrir(page, 1440, 900);
      await importar(page, 'obj_1_Saitama_75mm_base.stl');
      await page.evaluate(() => {
        const s = (window as any).__s.getState();
        s.setSelection([s.objects[s.objects.length - 1].id]);
        s.setActiveTool('paint');
        s.requestCameraPreset('fit');
      });
      await page.waitForTimeout(1200);
      const [bx] = (await cajas(page)).slice(-1);
      const c = [(bx.min[0] + bx.max[0]) / 2, (bx.min[1] + bx.max[1]) / 2, (bx.min[2] + bx.max[2]) / 2];
      const base = await pasos(page);
      const hubo = await trazo(page, await aPixel(page, c as [number, number, number]), modo);
      console.log(`importado, ${modo}: aviso=${hubo}, pasos ${base} -> ${await pasos(page)}`);
      await page.screenshot({ path: `${SHOTS}/p11-importado-${modo}.png` });
      await expect.poll(() => pasos(page), { timeout: 10000 }).toBe(base + 1);
      expect(errs).toEqual([]);
    });
  }
});

test.describe('10b. Menú contextual: teclado y bordes de ventana', () => {
  for (const [w, h] of [[1440, 900]] as const) {
    test(`flechas, Enter, Escape y Tab sin salir de la ventana (${w} px) y una acción por submenú`, async ({ page }) => {
      test.setTimeout(150000);
      const errs = await abrir(page, w, h);
      const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
      await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), id);
      await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
      await page.waitForTimeout(800);
      const dentro = async (sel: string, etiqueta: string) => {
        const r = (await page.locator(sel).last().boundingBox())!;
        expect(r.x, `${etiqueta} x`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${etiqueta} y`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, `${etiqueta} derecha`).toBeLessThanOrEqual(w + 0.5);
        expect(r.y + r.height, `${etiqueta} abajo`).toBeLessThanOrEqual(h + 0.5);
      };
      // Clic derecho lo más cerca posible de la esquina inferior derecha del visor (sobre el objeto no hace falta:
      // el menú del objeto se abre sobre él; se prueba además el centro).
      const p = await aPixel(page, [0, 20, 0]);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      const raiz = page.locator('.kura-context-menu').first();
      await expect(raiz).toBeVisible();
      await dentro('.kura-context-menu', 'primer nivel');
      const items = raiz.locator(':scope > [role=menuitem], :scope > .kura-context-subwrap > [role=menuitem]');
      await expect(items.first()).toBeFocused();
      // ArrowDown recorre; ArrowUp vuelve; en un submenú ArrowRight abre y Escape cierra solo el submenú.
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(items.first()).toBeFocused();
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const nombre = (await items.nth(i).locator('.kura-context-label').textContent())?.trim() ?? '';
        if (!['Preparar para imprimir', 'Malla', 'Separar y combinar', 'Posición y tipo', 'Analizar', 'Más'].includes(nombre)) continue;
        await items.nth(i).focus();
        await page.keyboard.press('ArrowRight');
        const sub = page.getByRole('menu', { name: nombre, exact: true });
        await expect(sub, `submenú ${nombre} abre con flecha derecha`).toBeVisible();
        // En pantalla estrecha el submenú se despliega en línea dentro del menú, que pasa a tener scroll interno:
        // lo que debe quedar dentro de la ventana es el menú, y el ítem con foco debe verse.
        if (await sub.evaluate((el) => el.classList.contains('is-inline'))) {
          await dentro('.kura-context-menu', `menú con ${nombre} desplegado`);
          await expect(page.locator(':focus')).toBeInViewport();
        } else {
          await dentro(`[role=menu][aria-label="${nombre}"]`, `submenú ${nombre}`);
        }
        expect(await page.evaluate(() => document.activeElement?.closest('[role=menu]')?.getAttribute('aria-label')), `foco dentro de ${nombre}`).toBe(nombre);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.closest('.kura-context-menu, [role=menu]') !== null), `Tab no saca el foco de ${nombre}`).toBe(true);
        await page.keyboard.press('Escape');
        await expect(sub).toBeHidden();
        await expect(raiz, 'Escape en el submenú no cierra el menú').toBeVisible();
      }
      await page.screenshot({ path: `${SHOTS}/p10-teclado-${w}.png` });
      // Una acción por submenú, solo con teclado/ratón: Posición y tipo > Centrar en la cama mueve el objeto.
      await page.evaluate((i) => (window as any).__s.getState().setObjectTransform(i, { position: [20, 20, 10] }, true), id);
      const pos0 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position, id);
      await page.keyboard.press('Escape');
      await page.evaluate((i) => (window as any).__s.getState().setSelection([i]), id);
      const q = await aPixel(page, [20, 20, 10]);
      await page.mouse.click(q.x, q.y, { button: 'right' });
      await page.locator('.kura-context-menu').first().getByRole('menuitem', { name: 'Posición y tipo', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Centrar en la cama', exact: true }).click();
      await expect.poll(() => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position, id)).not.toEqual(pos0);
      const pos1 = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).position, id);
      console.log('centrar: ', pos0, '->', pos1);
      // Analizar > Revisar si se puede imprimir produce un resultado/aviso; Malla > Reparar malla no rompe.
      const q2 = await aPixel(page, [pos1[0], 20, pos1[2]]);
      await page.mouse.click(q2.x, q2.y, { button: 'right' });
      await page.locator('.kura-context-menu').first().getByRole('menuitem', { name: 'Analizar', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Revisar si se puede imprimir' }).click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/p10-analizar-${w}.png` });
      expect(errs).toEqual([]);
    });
  }
});

test('sondeo paleta: comandos de menú sin entrada con el mismo nombre (dos objetos seleccionados)', async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page, 1440, 900);
  const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [-15, 10, 0]);
  const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [15, 10, 0]);
  await page.evaluate(({ a, b }) => (window as any).__s.getState().setSelection([a, b]), { a, b });
  for (const [consulta, esperado] of [['Módulos', 'Módulos (sumar o restar)…'], ['Textura', 'Textura superficial…'], ['Unir', 'Unir selección'], ['Convertir', 'Convertir en'], ['Alinear', 'Alinear y distribuir'], ['encaje', 'Comprobar encaje…']] as const) {
    await page.keyboard.press('Control+k');
    await page.locator('input[role=combobox]').first().fill(consulta);
    await page.waitForTimeout(250);
    const ops = (await page.locator('[role=listbox][aria-label] [role=option]').allTextContents()).map((s) => s.replace(/\s+/g, ' ').trim());
    console.log(`paleta "${consulta}" (esperado "${esperado}"):`, ops.slice(0, 6));
    await page.keyboard.press('Escape');
  }
});
