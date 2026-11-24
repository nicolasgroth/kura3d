/**
 * @file e2e/rediseno-3a-ajustes.spec.ts
 * @description Ajustes al rediseño (lote 3a) en navegador real: el botón «Proyecto» muestra el panel (sin menú) con
 * las acciones de archivo y Ctrl+S sigue guardando; nombre, cama y unidades se editan en el panel; «Agregar» de la
 * barra vertical abre las primitivas con teclado (→, flechas, Enter, Esc devuelve el foco); «Insertar» lleva
 * formas y generadores; la barra izquierda solo muestra la Escena (con muestra de color por fila) y se oculta;
 * MCP conserva su texto sin rótulos; el idioma se elige con bandera y nombre propio. Recorre 1440, 1024 y 390 px
 * en tema claro y oscuro sin desborde horizontal ni errores de consola. Capturas en `.eval-tmp/rediseno-3a/`.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5254 npx playwright test e2e/rediseno-3a-ajustes.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { agregarForma } from './agregar-helpers';
import { abrir } from './ux-escena-helpers';

const OUT = 'G:/proyectos/kura3d/.eval-tmp/rediseno-3a';
const st = (page: Page, key: string) => page.evaluate((k) => (window as any).__s.getState()[k], key);

let errores: string[] = [];
test.beforeEach(async ({ page }) => {
  errores = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
});
test.afterEach(() => {
  expect(errores.filter((e) => !/404|favicon/.test(e))).toEqual([]);
});

test('Proyecto: sin menú, muestra el panel con acciones de archivo; nombre, cama y unidades en línea', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await page.evaluate(() => (window as any).__s.getState().createStarterCube());
  await expect.poll(() => st(page, 'selectedIds').then((ids: string[]) => ids.length)).toBe(1);
  await page.evaluate(() => (window as any).__s.getState().toggleRightInspector());
  await expect.poll(() => st(page, 'rightCollapsed')).toBe(true);

  const boton = page.locator('.kura-topbar .kura-project-trigger');
  await expect(boton).not.toHaveAttribute('aria-haspopup', /.+/);
  await boton.click();
  await expect.poll(() => st(page, 'rightCollapsed')).toBe(false);
  await expect.poll(() => st(page, 'selectedIds').then((ids: string[]) => ids.length)).toBe(0);
  const panel = page.locator('#kura-inspector-panel');
  await expect(panel).toHaveAttribute('data-context', 'project');
  for (const nombre of ['Nuevo proyecto', 'Abrir proyecto…', 'Guardar proyecto', 'Guardar proyecto como…']) {
    const b = panel.getByRole('button', { name: nombre, exact: true });
    await expect(b).toBeVisible();
    await expect(b.locator('svg')).toHaveCount(1);
    expect(await b.getAttribute('title')).toMatch(/\((Ctrl|⌘)\+/);
  }
  await expect(panel.getByTestId('panel-project-file')).toContainText(/Proyectos recientes/);

  // Nombre: lápiz → campo; vacío se rechaza; Enter confirma y marca cambios sin guardar.
  await panel.getByRole('button', { name: 'Cambiar nombre del proyecto' }).click();
  const campo = panel.getByRole('textbox', { name: 'Nombre del proyecto' });
  await campo.fill('');
  await expect(panel.getByRole('alert')).toHaveText('El nombre no puede quedar vacío.');
  await campo.fill('Soporte cámara');
  await campo.press('Enter');
  await expect(panel.getByTestId('panel-project-name')).toContainText('Soporte cámara.kura');
  await expect(boton).toContainText('Soporte cámara.kura');
  await expect(panel).toContainText('Cambios sin guardar');
  await expect(panel.getByRole('button', { name: 'Cambiar nombre del proyecto' })).toBeFocused();

  // Unidades: el lápiz despliega el selector ahí mismo (bajo el valor), Esc lo pliega.
  const unidades = panel.getByTestId('panel-project-units-edit');
  await unidades.click();
  const sel = panel.getByRole('combobox', { name: 'Unidad de medida' });
  await expect(sel).toBeFocused();
  const yLapiz = (await unidades.boundingBox())!.y;
  const ySel = (await sel.boundingBox())!.y;
  expect(ySel - yLapiz).toBeGreaterThan(0);
  expect(ySel - yLapiz).toBeLessThan(120);
  await sel.selectOption('cm');
  await expect.poll(() => st(page, 'unitSystem')).toBe('cm');
  await page.keyboard.press('Escape');
  await expect(unidades).toBeFocused();
  await expect(unidades).toHaveAttribute('aria-expanded', 'false');

  // Cama: mismo patrón, con las camas propias («Mis camas»).
  await panel.getByTestId('panel-project-bed-edit').click();
  await expect(panel.getByTestId('fit-bed-select')).toBeFocused();
  await expect(panel.getByTestId('fit-bed-edit')).toBeVisible();
  await page.screenshot({ path: `${OUT}/proyecto-panel-1440.png` });
  await page.keyboard.press('Escape');

  // Ctrl+S sigue guardando (sin selector de archivos en la web: descarga o selector, aquí basta con la llamada).
  await page.evaluate(() => {
    const w = window as any;
    w.__saved = 0;
    w.__s.setState({ saveProject: async () => { w.__saved += 1; return true; } });
  });
  await page.locator('body').click({ position: { x: 700, y: 400 } });
  await page.keyboard.press('Control+s');
  await expect.poll(() => page.evaluate(() => (window as any).__saved)).toBe(1);
});

test('Agregar: menú lateral con primitivas, teclado completo y Esc devuelve el foco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const add = page.locator('#kura-tool-rail').getByRole('button', { name: 'Agregar', exact: true });
  await expect(add).toHaveAttribute('aria-haspopup', 'menu');
  await add.focus();
  await page.keyboard.press('ArrowRight');
  const menu = page.getByRole('menu', { name: 'Agregar forma' });
  await expect(menu).toBeVisible();
  const items = menu.getByRole('menuitem');
  await expect(items).toHaveCount(9);
  for (const n of ['Cubo', 'Cilindro', 'Disco', 'Tubo hueco', 'Esfera', 'Cono', 'Toroide', 'Prisma', 'Texto 3D']) {
    await expect(menu.getByRole('menuitem', { name: n, exact: true }).locator('svg')).toHaveCount(1);
  }
  // A la derecha del botón, sin salirse de la ventana.
  const rb = (await add.boundingBox())!;
  const mb = (await menu.boundingBox())!;
  expect(mb.x).toBeGreaterThanOrEqual(rb.x + rb.width);
  await expect(items.first()).toBeFocused();
  await page.screenshot({ path: `${OUT}/agregar-1440.png` });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(add).toBeFocused();

  // Enter abre, ↓ baja a Cilindro, Enter lo crea.
  await page.keyboard.press('Enter');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.primitiveType))).toEqual(['cylinder']);
  await expect(add).toBeFocused();

  // Texto 3D abre su panel de creación.
  await agregarForma(page, 'Texto 3D');
  await expect(page.getByRole('dialog', { name: 'Texto 3D' }).getByRole('button', { name: 'Crear texto' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('Insertar y Acciones con submenús en la barra superior', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const insertar = page.locator('.kura-topbar').getByRole('button', { name: 'Insertar', exact: true });
  await insertar.click();
  const menu = page.getByRole('menu', { name: 'Insertar' });
  for (const n of ['Cubo', 'Texto 3D', 'Importar SVG', 'Imagen → 3D', 'Cubo de calibración 30 mm']) {
    await expect(menu.getByRole('menuitem', { name: n, exact: true })).toBeVisible();
  }
  await expect(menu.getByRole('menuitem', { name: /Rosca ISO/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/insertar-1440.png` });
  await menu.getByRole('menuitem', { name: 'Cubo de calibración 30 mm' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  await expect(insertar).toBeFocused();

  // Acciones: las entradas viven en el submenú de su grupo y conservan disponibilidad y motivo.
  const agrupar = await itemAccion(page, 'Agrupar', true);
  await expect(agrupar).toBeDisabled();
  await expect(agrupar).toContainText('Selecciona dos o más objetos');
  await page.screenshot({ path: `${OUT}/acciones-submenu-1440.png` });
  await page.keyboard.press('Escape');
});

test('barra izquierda: solo Escena con muestra de color, se oculta y el visor gana el ancho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  await agregarForma(page, 'Cubo');
  await agregarForma(page, 'Esfera');
  const aside = page.locator('#kura-shapes-panel');
  await expect(aside.getByRole('tab')).toHaveCount(0);
  await expect(aside.locator('.kura-primitive-card')).toHaveCount(0);
  await expect(aside.getByRole('heading', { name: 'Escena' })).toBeVisible();
  const filas = aside.getByRole('treeitem');
  await expect(filas).toHaveCount(2);
  await expect(filas.first().locator('.kura-tree-swatch')).toBeVisible();
  await expect(filas.first()).toContainText(/color: /);
  await expect(aside.getByRole('button', { name: 'Vaciar cama' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/escena-1440.png` });

  const handle = page.getByTestId('left-sidebar-handle');
  const antes = (await page.locator('canvas').first().boundingBox())!.width;
  await handle.click();
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await page.locator('canvas').first().boundingBox())!.width).toBeGreaterThan(antes + 150);
  await handle.click();
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
});

test('sin rótulos: MCP conserva su texto y ningún botón queda vacío', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const barra = page.locator('.kura-topbar');
  const mcp = barra.locator('.kura-pill');
  await expect(mcp).toContainText('MCP');
  const ancho = async () => (await barra.boundingBox())!.height;
  const alto = await ancho();
  await barra.getByRole('button', { name: 'Rótulos' }).click();
  await expect(mcp.locator('.kura-mcp-text')).toHaveText('MCP');
  await expect(mcp.locator('.kura-dot')).toBeVisible();
  expect(await ancho()).toBe(alto);
  const vacios = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.kura-topbar button, .kura-tool-rail button'))
      .filter((b) => b.offsetParent !== null)
      .filter((b) => !b.querySelector('svg') && (b.innerText ?? '').trim() === '')
      .map((b) => b.getAttribute('aria-label') ?? b.className),
  );
  expect(vacios).toEqual([]);
  await page.screenshot({ path: `${OUT}/sin-rotulos-1440.png` });
  await barra.getByRole('button', { name: 'Rótulos' }).click();
});

test('idioma: bandera SVG y nombre propio; el botón muestra bandera y código', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page);
  const trigger = page.locator('.kura-topbar .kura-lang-trigger');
  await expect(trigger).toHaveAccessibleName('Idioma: Español');
  await expect(trigger.locator('svg[data-flag="es"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(trigger).toContainText('ES');
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'Idioma de interfaz' });
  for (const [code, n] of [['es', 'Español'], ['en', 'English'], ['de', 'Deutsch'], ['fr', 'Français'], ['hi', 'हिन्दी'], ['zh', '中文']]) {
    const item = menu.getByRole('menuitemradio', { name: n });
    await expect(item).toBeVisible();
    await expect(item.locator(`svg[data-flag="${code}"]`)).toHaveCount(1);
  }
  await expect(menu.getByRole('menuitemradio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: `${OUT}/idioma-1440.png` });
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect.poll(() => st(page, 'language')).toBe('zh');
  await expect(trigger).toContainText('ZH');
  await expect(trigger).toBeFocused();
  await page.evaluate(() => (window as any).__s.getState().setLanguage('es'));
});

for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
  for (const tema of ['light', 'dark'] as const) {
    test(`recorrido ${w}px ${tema}: sin desborde y Agregar alcanzable`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page);
      await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
      await agregarForma(page, 'Cubo');
      await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
      await page.locator('.kura-topbar .kura-project-trigger').click();
      await expect(page.locator('#kura-inspector-panel')).toHaveAttribute('data-context', 'project');
      const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(d.sw).toBeLessThanOrEqual(d.cw + 1);
      await page.screenshot({ path: `${OUT}/recorrido-${w}-${tema}.png` });
      if (w > 900) {
        await page.locator('#kura-tool-rail .kura-tool-rail-add').click();
        await page.screenshot({ path: `${OUT}/agregar-${w}-${tema}.png` });
        await page.keyboard.press('Escape');
      }
      await page.evaluate(() => (window as any).__s.getState().setColorScheme('system'));
    });
  }
}
