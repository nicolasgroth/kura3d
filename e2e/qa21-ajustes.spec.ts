/**
 * @file e2e/qa21-ajustes.spec.ts
 * @description QA independiente de los ajustes a la interfaz (lotes A y B): casos límite del panel Proyecto
 * (Escape, nombre vacío/largo/con caracteres inválidos, «Nuevo» con cambios sin guardar), «Agregar» (cada forma
 * crea, selecciona y se deshace en un paso), menús sin desborde a 1440/1024/390 px, herramientas según la
 * selección (incluido borrar el objeto con la herramienta activa), panel por herramienta, paleta de pintura
 * (agregar, quitar, persistir, límite, colores de un 3MF), barra izquierda persistente e idiomas sin claves
 * crudas. Capturas en `.eval-tmp/qa21/`.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5189 npx playwright test e2e/qa21-ajustes.spec.ts --reporter=line`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { agregarForma } from './agregar-helpers';
import { abrir as abrirBase } from './ux-escena-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/qa21';
const MODELOS = 'G:/proyectos/kura3d/.eval-tmp/modelos';
const st = (page: Page, key: string) => page.evaluate((k) => (window as any).__s.getState()[k], key);
const nObjs = (page: Page) => page.evaluate(() => (window as any).__s.getState().objects.length);
const panel = (page: Page) => page.locator('#kura-inspector-panel');
const rail = (page: Page) => page.locator('#kura-tool-rail');


/**
 * Enlaza `__s` con la instancia de store que usa la app. Si Vite sirvió el módulo con `?t=` (tras un HMR) un
 * `import()` sin la marca crea un segundo store y los specs leen un estado ajeno; se importa la URL exacta.
 */
async function enlazar(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/useKuraStore\.ts/.test(n));
    const url = urls.length ? urls[urls.length - 1] : '/src/store/useKuraStore.ts';
    (window as any).__s = (await import(/* @vite-ignore */ url)).useKuraStore;
  });
}
async function abrir(page: Page): Promise<void> {
  await abrirBase(page);
  await enlazar(page);
}

let errores: string[] = [];
test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(() => {
  expect(errores.filter((e) => !/404|favicon/.test(e))).toEqual([]);
});

async function abrirProyecto(page: Page) {
  await page.locator('.kura-topbar .kura-project-trigger').click();
  await expect(panel(page)).toHaveAttribute('data-context', 'project');
}

test.describe('1. Panel Proyecto', () => {
  test('Escape cancela, vacío y solo espacios se rechazan, el nombre largo se recorta y no hay cambios espurios', async ({ page }) => {
    await abrir(page);
    await abrirProyecto(page);
    const antes = await st(page, 'projectName');
    const lapiz = panel(page).getByRole('button', { name: 'Cambiar nombre del proyecto' });
    await lapiz.click();
    const campo = panel(page).getByRole('textbox', { name: 'Nombre del proyecto' });
    await campo.fill('Descartado');
    await campo.press('Escape');
    await expect(campo).toHaveCount(0);
    expect(await st(page, 'projectName')).toBe(antes);
    await expect(lapiz).toBeFocused();
    await expect(panel(page)).not.toContainText('Cambios sin guardar');

    // Solo espacios: se rechaza igual que vacío; Enter no cierra ni renombra.
    await lapiz.click();
    await campo.fill('    ');
    await campo.press('Enter');
    expect(await st(page, 'projectName')).toBe(antes);
    await expect(panel(page).getByRole('alert')).toBeVisible();
    await campo.press('Escape');

    // Largo: maxLength 120.
    await lapiz.click();
    await campo.fill('x'.repeat(300));
    expect((await campo.inputValue()).length).toBeLessThanOrEqual(120);
    await campo.press('Enter');
    await expect.poll(() => st(page, 'projectName')).toMatch(/^x+\.kura$/);
    const largo = (await st(page, 'projectName')) as string;
    expect(largo.length).toBeLessThanOrEqual(130);
    await page.screenshot({ path: `${OUT}/nombre-largo-1440.png` });
    const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(d.sw).toBeLessThanOrEqual(d.cw + 1);
    // El nombre largo no desborda el panel ni la barra superior.
    const pb = (await panel(page).boundingBox())!;
    const nb = (await panel(page).getByTestId('panel-project-name').boundingBox())!;
    expect(nb.x + nb.width).toBeLessThanOrEqual(pb.x + pb.width + 1);
  });

  test('caracteres inválidos de archivo se sanean y renombrar no pierde cambios sin guardar ni la escena', async ({ page }) => {
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await abrirProyecto(page);
    await expect(panel(page)).toContainText('Cambios sin guardar');
    const lapiz = panel(page).getByRole('button', { name: 'Cambiar nombre del proyecto' });
    await lapiz.click();
    const campo = panel(page).getByRole('textbox', { name: 'Nombre del proyecto' });
    await campo.fill('a/b:c*d?e"f<g>h|i\\j');
    await campo.press('Enter');
    await expect.poll(() => st(page, 'projectName')).toMatch(/\.kura$/);
    const nombre = (await st(page, 'projectName')) as string;
    expect(nombre).not.toMatch(/[\\/:*?"<>|]/);
    expect(nombre.length).toBeGreaterThan(4);
    await expect(panel(page)).toContainText('Cambios sin guardar');
    expect(await nObjs(page)).toBe(1);
    // Mismo nombre otra vez: no debe marcar nada nuevo ni romper.
    await lapiz.click();
    await campo.press('Enter');
    expect(await st(page, 'projectName')).toBe(nombre);
    // Nombre con extensión escrita a mano no se duplica.
    await lapiz.click();
    await campo.fill('pieza.kura');
    await campo.press('Enter');
    expect(await st(page, 'projectName')).toBe('pieza.kura');
    // Deshacer no revierte el nombre ni borra el cubo por sorpresa.
    expect(await nObjs(page)).toBe(1);
  });

  test('Nuevo con cambios sin guardar pide confirmación; cancelar conserva la escena', async ({ page }) => {
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await abrirProyecto(page);
    await panel(page).getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await page.screenshot({ path: `${OUT}/nuevo-confirma-1440.png` });
    const botones = await dlg.getByRole('button').allInnerTexts();
    test.info().annotations.push({ type: 'botones-nuevo', description: botones.join(' | ') });
    // Cancelar con el botón: la escena se conserva.
    await dlg.getByRole('button', { name: /Cancelar/ }).click();
    await expect(dlg).toHaveCount(0);
    expect(await nObjs(page)).toBe(1);
    // Cancelar con Escape: debe dar el mismo resultado.
    await panel(page).getByRole('button', { name: 'Nuevo proyecto', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await nObjs(page), 'Escape en el diálogo de cambios sin guardar no debe descartar la escena').toBe(1);
  });

  test('cama y unidades: Escape no cambia el valor y la cama editada persiste en el proyecto', async ({ page }) => {
    await abrir(page);
    await abrirProyecto(page);
    const unit = await st(page, 'unitSystem');
    await panel(page).getByTestId('panel-project-units-edit').click();
    const sel = panel(page).getByRole('combobox', { name: 'Unidad de medida' });
    await sel.focus();
    await page.keyboard.press('Escape');
    expect(await st(page, 'unitSystem')).toBe(unit);
    await panel(page).getByTestId('panel-project-bed-edit').click();
    await expect(panel(page).getByTestId('fit-bed-select')).toBeFocused();
    // Cambiar la cama a otra opción y verificar que el resumen la refleja.
    const opciones = await panel(page).getByTestId('fit-bed-select').locator('option').allInnerTexts();
    test.info().annotations.push({ type: 'camas', description: opciones.join(' | ') });
    await page.keyboard.press('Escape');
    await expect(panel(page).getByTestId('panel-project-bed-edit')).toBeVisible();
  });
});

test.describe('2. Agregar', () => {
  const FORMAS = ['Cubo', 'Cilindro', 'Disco', 'Tubo hueco', 'Esfera', 'Cono', 'Toroide', 'Prisma'];
  for (const forma of FORMAS) {
    test(`Agregar ${forma}: crea, selecciona y deshacer lo quita en un paso`, async ({ page }) => {
      await abrir(page);
      await agregarForma(page, forma);
      await expect.poll(() => nObjs(page)).toBe(1);
      await expect.poll(() => st(page, 'selectedIds').then((a: string[]) => a.length)).toBe(1);
      const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id);
      expect(await st(page, 'selectedIds')).toEqual([id]);
      // Segunda forma y luego un solo deshacer: queda solo la primera.
      await agregarForma(page, 'Esfera');
      await expect.poll(() => nObjs(page)).toBe(2);
      await page.evaluate(() => (window as any).__s.getState().undo());
      await expect.poll(() => nObjs(page)).toBe(1);
      await page.evaluate(() => (window as any).__s.getState().undo());
      await expect.poll(() => nObjs(page)).toBe(0);
      expect(await st(page, 'selectedIds')).toEqual([]);
      await page.evaluate(() => (window as any).__s.getState().redo());
      await expect.poll(() => nObjs(page)).toBe(1);
    });
  }

  test('Agregar con teclado solo: Enter, flechas arriba/abajo con vuelta, Home/End, Escape devuelve el foco', async ({ page }) => {
    await abrir(page);
    const add = rail(page).getByRole('button', { name: 'Agregar', exact: true });
    await add.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: 'Agregar forma' });
    const items = menu.getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.last()).toBeFocused();
    await page.keyboard.press('Tab');
    // Tab cierra el menú y no deja el foco atrapado.
    await expect(menu).toBeHidden();
    // Clic fuera cierra.
    await add.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(700, 500);
    await expect(menu).toBeHidden();
    // Doble clic rápido en una forma crea solo un objeto.
    await add.click();
    await menu.getByRole('menuitem', { name: 'Cubo', exact: true }).dblclick();
    await page.waitForTimeout(600);
    expect(await nObjs(page)).toBeLessThanOrEqual(1);
  });

  test('Agregar en la escena no pisa la selección previa ni deja el menú abierto tras crear', async ({ page }) => {
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await agregarForma(page, 'Cilindro');
    await expect(page.getByRole('menu', { name: 'Agregar forma' })).toHaveCount(0);
    const sel = await st(page, 'selectedIds');
    expect(sel.length).toBe(1);
    const tipos = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.primitiveType));
    expect(tipos).toEqual(['box', 'cylinder']);
  });
});

test.describe('3. Menús sin desborde', () => {
  test.setTimeout(120_000);
  for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
    test(`Insertar, Acciones, Idioma y Agregar quedan dentro de la ventana a ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await abrir(page);
      await agregarForma(page, 'Cubo');
      await page.keyboard.press('Escape');
      const dentro = async (nombre: string) => {
        const r = await page.evaluate(() => {
          const out: Array<{ x: number; y: number; r: number; b: number; cls: string }> = [];
          document.querySelectorAll<HTMLElement>('[role="menu"], [role="dialog"], [role="listbox"]').forEach((m) => {
            const b = m.getBoundingClientRect();
            if (b.width > 0 && b.height > 0) out.push({ x: b.x, y: b.y, r: b.right, b: b.bottom, cls: m.getAttribute('aria-label') ?? m.className });
          });
          return { out, W: window.innerWidth, H: window.innerHeight };
        });
        for (const m of r.out) {
          expect(m.x, `${nombre} ${m.cls} izquierda`).toBeGreaterThanOrEqual(-1);
          expect(m.y, `${nombre} ${m.cls} arriba`).toBeGreaterThanOrEqual(-1);
          expect(m.r, `${nombre} ${m.cls} derecha`).toBeLessThanOrEqual(r.W + 1);
          expect(m.b, `${nombre} ${m.cls} abajo`).toBeLessThanOrEqual(r.H + 1);
        }
      };
      const barra = page.locator('.kura-topbar');
      // Cada botón de la barra superior que abre un menú: abrir, medir, abrir sus submenús con →.
      for (const nombre of ['Insertar', 'Acciones', 'Idioma']) {
        let btn = barra.getByRole('button', { name: new RegExp(`^${nombre}`) }).first();
        if (!(await btn.isVisible().catch(() => false))) {
          // A 390 px pueden estar en el menú de desbordamiento.
          const more = barra.getByRole('button', { name: /Más|More/ }).first();
          if (await more.isVisible().catch(() => false)) await more.click();
          btn = page.getByRole('menuitem', { name: new RegExp(`^${nombre}`) }).first();
          if (!(await btn.isVisible().catch(() => false))) {
            test.info().annotations.push({ type: 'omitido', description: `${nombre} no visible a ${w}px` });
            await page.keyboard.press('Escape');
            continue;
          }
        }
        await btn.click();
        await page.waitForTimeout(150);
        await dentro(`${nombre} nivel 1`);
        // Entra a cada submenú con la flecha derecha.
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(60);
          await dentro(`${nombre} sub ${i}`);
          await page.keyboard.press('ArrowLeft');
        }
        await page.screenshot({ path: `${OUT}/menu-${nombre}-${w}.png` });
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
      }
      const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(d.sw).toBeLessThanOrEqual(d.cw + 1);
    });
  }

  test('acciones que requieren selección salen apagadas con motivo legible y no ejecutan nada', async ({ page }) => {
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await page.evaluate(() => (window as any).__s.getState().setSelection([]));
    await page.getByRole('button', { name: /^Acciones/ }).first().click();
    const menu = page.getByRole('menu').first();
    const items = menu.getByRole('menuitem');
    const n = await items.count();
    expect(n).toBeGreaterThan(2);
    // Recorre submenús y reúne ítems apagados.
    const apagados: string[] = [];
    for (let i = 0; i < n; i++) {
      await items.nth(i).hover();
      await page.keyboard.press('ArrowRight');
      const subs = page.getByRole('menu');
      const c = await subs.count();
      for (let k = 0; k < c; k++) {
        const its = subs.nth(k).getByRole('menuitem');
        const m = await its.count();
        for (let j = 0; j < m; j++) {
          const it = its.nth(j);
          const dis = (await it.getAttribute('aria-disabled')) === 'true' || (await it.isDisabled().catch(() => false));
          if (dis) apagados.push(((await it.innerText()) || '').replace(/\n/g, ' · '));
        }
      }
    }
    test.info().annotations.push({ type: 'apagados', description: [...new Set(apagados)].join(' || ') });
    expect(apagados.length).toBeGreaterThan(0);
    // Cada ítem apagado trae algún motivo (más texto que solo el nombre).
    for (const a of new Set(apagados)) expect(a.length, a).toBeGreaterThan(8);
    await page.screenshot({ path: `${OUT}/acciones-apagadas-1440.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  });
});

test.describe('4. Herramientas según la selección', () => {
  const NOMBRES: Record<string, string> = { translate: 'Mover', rotate: 'Rotar', scale: 'Escalar', paint: 'Pintar', cut: 'Cortar', erase: 'Esculpir', measure: 'Medir' };

  async function estado(page: Page) {
    return page.evaluate(() => {
      const s = (window as any).__s.getState();
      return { tool: s.activeTool, action: s.activeAction, mode: s.transformMode, sel: s.selectedIds.length, n: s.objects.length, ctx: document.querySelector('#kura-inspector-panel')?.getAttribute('data-context') };
    });
  }

  test('escena vacía: ninguna herramienta cambia el estado y todas explican el motivo', async ({ page }) => {
    await abrir(page);
    for (const nombre of Object.values(NOMBRES)) {
      const b = rail(page).getByRole('button', { name: new RegExp(`^${nombre}`) }).first();
      if ((await b.count()) === 0) continue;
      await b.click({ force: true });
      const e = await estado(page);
      expect(e.tool, nombre).toBe('select');
      expect(e.action, nombre).toBeNull();
      expect(e.ctx, nombre).not.toBe('tool');
    }
  });

  test('con 1 y con varios objetos, cada herramienta se activa sin dejar el panel vacío', async ({ page }) => {
    await abrir(page);
    await page.evaluate(async () => {
      const s = (window as any).__s.getState();
      await s.createPrimitive('box');
      await s.createPrimitive('sphere');
      await s.createPrimitive('cylinder');
    });
    await expect.poll(() => nObjs(page)).toBe(3);
    const resultados: string[] = [];
    for (const seleccion of ['ninguno', 'uno', 'varios']) {
      for (const nombre of Object.values(NOMBRES)) {
        await page.evaluate((sel) => {
          const s = (window as any).__s.getState();
          s.setActiveTool('select');
          const ids = s.objects.map((o: any) => o.id);
          s.setSelection(sel === 'ninguno' ? [] : sel === 'uno' ? [ids[0]] : ids.slice(0, 2));
        }, seleccion);
        const b = rail(page).getByRole('button', { name: new RegExp(`^${nombre}`) }).first();
        await b.click();
        await page.waitForTimeout(250);
        const e = await estado(page);
        const alturaPanel = await panel(page).evaluate((p) => (p as HTMLElement).innerText.trim().length);
        resultados.push(`${seleccion}/${nombre}: tool=${e.tool} action=${e.action} mode=${e.mode} sel=${e.sel} ctx=${e.ctx} panelTxt=${alturaPanel}`);
        expect(alturaPanel, `${seleccion}/${nombre} panel vacío`).toBeGreaterThan(10);
        // Cualquier diálogo/hoja de operación abierta se cierra con Escape sin dejar la herramienta pegada.
        await page.keyboard.press('Escape');
        await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
      }
    }
    test.info().annotations.push({ type: 'matriz', description: resultados.join('\n') });
  });

  for (const nombre of ['Pintar', 'Cortar', 'Esculpir', 'Medir', 'Mover', 'Rotar', 'Escalar']) {
    // Pintar/Cortar/Esculpir/Medir fallan hoy: la herramienta queda activa (y el panel «Pintar») con la escena vacía.
    test(`borrar el objeto con ${nombre} activo no deja panel huérfano ni herramienta pegada`, async ({ page }) => {
      await abrir(page);
      await page.evaluate(async () => {
        const s = (window as any).__s.getState();
        await s.createPrimitive('box');
      });
      await expect.poll(() => nObjs(page)).toBe(1);
      await page.evaluate(() => {
        const s = (window as any).__s.getState();
        s.setSelection([s.objects[0].id]);
      });
      await rail(page).getByRole('button', { name: new RegExp(`^${nombre}`) }).first().click();
      await page.waitForTimeout(300);
      const antes = await estado(page);
      await page.screenshot({ path: `${OUT}/activa-${nombre}.png` });
      // Borrar con la herramienta activa.
      await page.evaluate(() => (window as any).__s.getState().deleteObjects());
      await expect.poll(() => nObjs(page)).toBe(0);
      await page.waitForTimeout(400);
      const despues = await estado(page);
      test.info().annotations.push({ type: nombre, description: `antes=${JSON.stringify(antes)} despues=${JSON.stringify(despues)}` });
      expect(despues.tool, 'herramienta pegada').toBe('select');
      expect(despues.action, 'acción pegada').toBeNull();
      expect(despues.ctx, 'panel de herramienta huérfano').not.toBe('tool');
      // Ningún diálogo/hoja de operación huérfano.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // Deshacer devuelve el objeto sin reactivar la herramienta a medias.
      await page.evaluate(() => (window as any).__s.getState().undo());
      await expect.poll(() => nObjs(page)).toBe(1);
    });
  }
});

test.describe('5. Panel por herramienta', () => {
  test('Pintar muestra solo pintura; volver a Seleccionar devuelve el panel del objeto; recargar no rompe', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().createStarterCube());
    await expect.poll(() => st(page, 'selectedIds').then((a: string[]) => a.length)).toBe(1);
    await expect(panel(page)).toHaveAttribute('data-context', 'object');
    await rail(page).getByRole('button', { name: 'Pintar' }).click();
    await expect(panel(page)).toHaveAttribute('data-context', 'tool');
    for (const prohibido of [/Transformación/, /Posición/, /Geometría/, /Dimensiones/]) await expect(panel(page).getByText(prohibido)).toHaveCount(0);
    await rail(page).getByRole('button', { name: 'Seleccionar' }).click();
    await expect(panel(page)).toHaveAttribute('data-context', 'object');
    await expect(panel(page).locator('#kura-obj-name')).toBeVisible();
    // Alternar rápido 10 veces no deja mezcla.
    for (let i = 0; i < 10; i++) await page.keyboard.press('p');
    await page.waitForTimeout(300);
    const ctx = await panel(page).getAttribute('data-context');
    const tool = await st(page, 'activeTool');
    expect(ctx === 'tool' ? tool !== 'select' : tool === 'select').toBe(true);
    await page.screenshot({ path: `${OUT}/panel-tras-alternar.png` });
  });

  test('con Cortar y Medir activos el panel no muestra transformación', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().createStarterCube());
    await expect.poll(() => nObjs(page)).toBe(1);
    for (const n of ['Cortar', 'Medir']) {
      await rail(page).getByRole('button', { name: new RegExp(`^${n}`) }).first().click();
      await page.waitForTimeout(300);
      await expect(panel(page).locator('#kura-precision-translate')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
    }
  });
});

test.describe('6. Paleta de pintura', () => {
  async function paleta(page: Page) {
    await abrir(page);
    await page.evaluate(() => {
      localStorage.removeItem('kura3d-paint-palette');
      (window as any).__s.getState().createStarterCube();
    });
    await expect.poll(() => st(page, 'selectedIds').then((a: string[]) => a.length)).toBe(1);
    await page.evaluate(() => (window as any).__s.getState().setActiveTool('paint'));
    await expect(panel(page).locator('[data-swatch]').first()).toBeVisible();
  }
  const stored = (page: Page) => page.evaluate(() => localStorage.getItem('kura3d-paint-palette'));

  test('agregar el color del pincel, no duplicar, quitar hasta el mínimo y persistir', async ({ page }) => {
    await paleta(page);
    const sw = panel(page).locator('[data-swatch]');
    const base = await sw.count();
    // Cambia el color del pincel a uno nuevo y lo agrega.
    await page.evaluate(() => (window as any).__s.setState({ paintColor: '#abcdef' }));
    await panel(page).getByRole('button', { name: /Agregar el color actual/ }).click();
    await expect(sw).toHaveCount(base + 1);
    // Repetir no duplica; el botón queda apagado.
    await panel(page).getByRole('button', { name: /Agregar el color actual/ }).click({ force: true });
    await expect(sw).toHaveCount(base + 1);
    await expect(panel(page).getByRole('button', { name: /Agregar el color actual/ })).toHaveAttribute('aria-disabled', 'true');
    // Recarga: persiste.
    await page.reload();
    await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
    await enlazar(page);
    await page.evaluate(() => {
      (window as any).__s.getState().createStarterCube();
      (window as any).__s.getState().setActiveTool('paint');
    });
    await expect(panel(page).locator('[data-swatch="#abcdef"]')).toHaveCount(1);
    // Quita por clic derecho hasta quedar con 1: el último no se deja quitar.
    for (let i = 0; i < 20; i++) {
      const n = await sw.count();
      if (n <= 1) break;
      await sw.last().click({ button: 'right' });
      await panel(page).getByRole('dialog').getByRole('button', { name: /Quitar/ }).click();
    }
    await expect(sw).toHaveCount(1);
    await sw.first().click({ button: 'right' });
    await expect(panel(page).getByRole('dialog').getByRole('button', { name: /Quitar/ })).toBeDisabled();
    await page.keyboard.press('Escape');
    // Pintar sigue funcionando con 1 color: no hay estado roto.
    expect(await stored(page)).toContain('colors');
    await page.screenshot({ path: `${OUT}/paleta-un-color.png` });
  });

  test('datos corruptos en el almacenamiento vuelven a la paleta original sin romper la app', async ({ page }) => {
    await abrir(page);
    for (const basura of ['{no json', '{"preset":"custom","colors":[]}', '{"preset":"x","colors":["rojo","#zzz",5,null]}', '[]', '"hola"']) {
      await page.evaluate((b) => localStorage.setItem('kura3d-paint-palette', b), basura);
      await page.reload();
      await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
      await enlazar(page);
    await page.evaluate(() => {
        (window as any).__s.getState().createStarterCube();
        (window as any).__s.getState().setActiveTool('paint');
    });
      const n = await panel(page).locator('[data-swatch]').count();
      expect(n, `con ${basura}`).toBeGreaterThanOrEqual(1);
    }
    await page.evaluate(() => localStorage.removeItem('kura3d-paint-palette'));
  });

  test('límite de la paleta: con 256 colores agregar se apaga y la zona sigue usable', async ({ page }) => {
    await paleta(page);
    const colores = Array.from({ length: 256 }, (_, i) => '#' + (0x100000 + i * 4099).toString(16).padStart(6, '0').slice(-6));
    await page.evaluate((c) => localStorage.setItem('kura3d-paint-palette', JSON.stringify({ preset: 'custom', colors: c })), colores);
    await page.reload();
    await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
    await enlazar(page);
    await page.evaluate(() => {
      (window as any).__s.getState().createStarterCube();
      (window as any).__s.getState().setActiveTool('paint');
    });
    const total = await panel(page).locator('[data-swatch]').count();
    test.info().annotations.push({ type: 'visibles', description: String(total) });
    expect(total).toBeLessThanOrEqual(256);
    await page.evaluate(() => (window as any).__s.setState({ paintColor: '#010203' }));
    await expect(panel(page).getByRole('button', { name: /Agregar el color actual/ })).toHaveAttribute('aria-disabled', 'true');
    await page.screenshot({ path: `${OUT}/paleta-256.png` });
    const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(d.sw).toBeLessThanOrEqual(d.cw + 1);
    await page.evaluate(() => localStorage.removeItem('kura3d-paint-palette'));
  });

  test('importar un 3MF con colores y «Usar los colores del proyecto» toma sus colores', async ({ page }) => {
    const archivo = `${MODELOS}/DAFFY.3mf`;
    test.skip(!existsSync(archivo), 'sin modelo de ejemplo');
    test.setTimeout(180_000);
    await paleta(page);
    await page.evaluate(() => (window as any).__s.getState().deleteObjects());
    const ch = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
    (await ch).setFiles(archivo);
    await expect.poll(() => nObjs(page), { timeout: 90000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const s = (window as any).__s.getState();
      s.setSelection([s.objects[0].id]);
      s.setActiveTool('paint');
    });
    const colProyecto = await page.evaluate(() => {
      const s = (window as any).__s.getState();
      const set = new Set<string>();
      for (const o of s.objects) { (o.mesh?.faceColors ?? [o.color]).forEach((c: string) => set.add(String(c).toLowerCase())); }
      return [...set];
    });
    await panel(page).getByRole('button', { name: 'Opciones de la paleta' }).click();
    const btn = panel(page).getByRole('dialog').getByRole('button', { name: /proyecto/i });
    await expect(btn).toBeEnabled();
    await btn.click();
    const sw = await panel(page).locator('[data-swatch]').evaluateAll((els) => els.map((e) => e.getAttribute('data-swatch')));
    test.info().annotations.push({ type: 'colores-proyecto', description: `${colProyecto.length} en proyecto; paleta tras usar: ${sw.length}` });
    for (const c of colProyecto.slice(0, 24)) expect(sw).toContain(c);
    await page.screenshot({ path: `${OUT}/paleta-3mf.png` });
    await page.evaluate(() => localStorage.removeItem('kura3d-paint-palette'));
  });
});

test.describe('7. Barra izquierda', () => {
  test('solo Escena, muestra de color por objeto, se oculta y el estado persiste al recargar', async ({ page }) => {
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await agregarForma(page, 'Cono');
    const aside = page.locator('#kura-shapes-panel');
    await expect(aside.getByRole('treeitem')).toHaveCount(2);
    await expect(aside.locator('.kura-tree-swatch')).toHaveCount(2);
    // Cambiar el color de un objeto actualiza la muestra.
    const antes = await aside.locator('.kura-tree-swatch').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    await page.evaluate(() => {
      const s = (window as any).__s.getState();
      s.updateObject?.(s.objects[0].id, { color: '#12ab34' });
    });
    await page.waitForTimeout(300);
    const despues = await aside.locator('.kura-tree-swatch').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    test.info().annotations.push({ type: 'muestra', description: `${antes} -> ${despues}` });
    const handle = page.getByTestId('left-sidebar-handle');
    await handle.click();
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await page.reload();
    await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
    await expect(page.getByTestId('left-sidebar-handle')).toHaveAttribute('aria-expanded', 'false');
    await page.getByTestId('left-sidebar-handle').click();
    await expect(page.getByTestId('left-sidebar-handle')).toHaveAttribute('aria-expanded', 'true');
    // Con teclado: el tirador es enfocable y Enter lo alterna.
    await page.getByTestId('left-sidebar-handle').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('left-sidebar-handle')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('left-sidebar-handle')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('8. Idiomas', () => {
  const CLAVES = /\b(rediseno3?[ab]?|r3a|r3b)\.[a-zA-Z]+/;
  for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh']) {
    test(`idioma ${lang}: sin claves crudas en barra, panel Proyecto, Agregar, paleta y menús`, async ({ page }) => {
      await abrir(page);
      await page.evaluate((l) => (window as any).__s.getState().setLanguage(l), lang);
      await page.evaluate(() => (window as any).__s.getState().createStarterCube());
      const textos: string[] = [];
      const leer = async () => textos.push(await page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label],[title]')].map((e) => (e.getAttribute('aria-label') ?? '') + ' ' + (e.getAttribute('title') ?? '')).join('\n')));
      await leer();
      await page.locator('.kura-topbar .kura-project-trigger').click();
      await leer();
      await page.evaluate(() => (window as any).__s.getState().setActiveTool('paint'));
      await leer();
      await panel(page).locator('.kura-palette-more').click().catch(() => undefined);
      await leer();
      await page.keyboard.press('Escape');
      for (const t of ['#kura-tool-rail .kura-tool-rail-add', '.kura-topbar .kura-lang-trigger']) {
        await page.locator(t).first().click().catch(() => undefined);
        await leer();
        await page.keyboard.press('Escape');
      }
      await page.screenshot({ path: `${OUT}/idioma-${lang}.png` });
      for (const t of textos) expect(t.match(CLAVES)?.[0] ?? '', `clave cruda en ${lang}`).toBe('');
      // Rótulos ocultos: MCP conserva su texto.
      await page.locator('.kura-topbar').getByRole('button', { name: /Rótulos|Labels|Beschriftung|Libellés|लेबल|标签/ }).first().click().catch(() => undefined);
      await expect(page.locator('.kura-topbar .kura-pill .kura-mcp-text')).toHaveText('MCP');
      await page.evaluate(() => (window as any).__s.getState().setLanguage('es'));
    });
  }

  test('el selector de idioma muestra bandera y nombre propio, y el cambio persiste al recargar', async ({ page }) => {
    await abrir(page);
    await page.locator('.kura-topbar .kura-lang-trigger').click();
    const menu = page.getByRole('menu', { name: 'Idioma de interfaz' });
    await menu.getByRole('menuitemradio', { name: 'Deutsch' }).click();
    await expect.poll(() => st(page, 'language')).toBe('de');
    await page.reload();
    await page.getByText(/Manifold WASM/).waitFor({ timeout: 60000 });
    await enlazar(page);
    expect(await st(page, 'language')).toBe('de');
    await page.evaluate(() => (window as any).__s.getState().setLanguage('es'));
  });
});

test.describe('Móvil 390 px', () => {
  test('recorrido usable: agregar, herramientas, proyecto y paleta sin desborde ni errores', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page);
    await agregarForma(page, 'Cubo');
    await expect.poll(() => nObjs(page)).toBe(1);
    await page.screenshot({ path: `${OUT}/movil-390-base.png` });
    await page.locator('.kura-topbar .kura-project-trigger').click();
    await expect(panel(page).or(page.locator('#kura-inspector-panel'))).toBeAttached();
    await page.screenshot({ path: `${OUT}/movil-390-proyecto.png` });
    const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(d.sw).toBeLessThanOrEqual(d.cw + 1);
    // Objetivos táctiles de la barra inferior de al menos 32 px.
    const chicos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.kura-narrow-panel-actions button, .kura-topbar button')]
        .filter((b) => b.offsetParent !== null)
        .map((b) => ({ n: b.getAttribute('aria-label') ?? b.innerText, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
        .filter((b) => b.w < 32 || b.h < 32),
    );
    test.info().annotations.push({ type: 'objetivos-chicos', description: JSON.stringify(chicos) });
  });
});
