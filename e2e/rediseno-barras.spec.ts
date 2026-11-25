/**
 * @file e2e/rediseno-barras.spec.ts
 * @description Rediseño clásico (lote 1): estructura de la barra superior (Archivo, Edición, Acciones a la
 * izquierda; utilidades a la derecha), barra vertical de herramientas con patrón «toolbar» de WAI-ARIA (una
 * parada de tabulación, flechas, Inicio/Fin, `aria-pressed`), barra de vista en una sola fila a 1280 y 1440 px
 * en es/en/de, rótulos conmutables que se recuerdan, tooltip con nombre, descripción y atajo (cursor y foco,
 * Esc lo cierra) y la línea de ayuda de la barra de estado que no mueve los datos fijos.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/rediseno-barras.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/rediseno';

async function conCubo(page: Page, lang = 'es') {
  await abrir(page);
  await page.evaluate((l) => {
    const s = (window as any).__s.getState();
    s.setLanguage(l);
    s.createStarterCube();
  }, lang);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
}

test('la barra superior agrupa Archivo, Edición y Acciones; Importar y Exportar llevan texto', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conCubo(page);
  const barra = page.locator('.kura-topbar');
  await expect(barra.getByRole('group', { name: 'Archivo' }).getByRole('button', { name: 'Importar 3D' })).toBeVisible();
  await expect(barra.getByRole('group', { name: 'Archivo' }).getByRole('button', { name: 'Exportar' })).toContainText('Exportar');
  await expect(barra.getByRole('group', { name: 'Edición' }).getByRole('button', { name: 'Deshacer' })).toBeVisible();
  await expect(barra.getByRole('button', { name: 'Historial de acciones' })).toBeVisible();
  await expect(barra.getByRole('button', { name: 'Acciones', exact: true })).toHaveAttribute('aria-haspopup', 'menu');
  // Ninguna herramienta queda en la barra superior ni en un menú «Más» en escritorio.
  await expect(barra.getByRole('button', { name: 'Pintar' })).toHaveCount(0);
  const unaFila = await barra.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height <= 60);
  expect(unaFila).toBe(true);
  // Con rótulos ocultos, Importar y Exportar conservan su texto.
  await barra.getByRole('button', { name: 'Rótulos' }).click();
  await expect(barra.getByRole('button', { name: 'Exportar' }).locator('.kura-btn-label')).toBeVisible();
  await expect(barra.getByRole('button', { name: 'Importar 3D' }).locator('.kura-btn-label')).toBeVisible();
});

test('barra de herramientas: patrón toolbar con una parada de tabulación, flechas e Inicio/Fin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await conCubo(page);
  const rail = page.getByRole('toolbar', { name: 'Herramientas' });
  await expect(rail).toHaveAttribute('aria-orientation', 'vertical');
  const botones = rail.getByRole('button');
  // «Agregar» (menú de formas) encabeza la barra, antes de las 8 herramientas.
  await expect(botones).toHaveCount(9);
  for (const name of ['Agregar', 'Seleccionar', 'Mover', 'Rotar', 'Escalar', 'Pintar', 'Cortar', 'Esculpir / Borrar', 'Medir']) {
    await expect(rail.getByRole('button', { name, exact: true })).toBeVisible();
  }
  // Un solo botón con tabindex=0.
  expect(await rail.locator('button[tabindex="0"]').count()).toBe(1);
  // Área de puntero ≥ 40 px.
  const box = await rail.getByRole('button', { name: 'Medir' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
  expect(box!.width).toBeGreaterThanOrEqual(40);

  await rail.getByRole('button', { name: 'Seleccionar' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(rail.getByRole('button', { name: 'Mover' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(rail.getByRole('button', { name: 'Medir' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rail.getByRole('button', { name: 'Agregar' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(rail.getByRole('button', { name: 'Medir' })).toBeFocused();
  // Las flechas no empujan el objeto seleccionado mientras se recorre la barra.
  const pos = await page.evaluate(() => (window as any).__s.getState().objects[0].position.join(','));
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => (window as any).__s.getState().objects[0].position.join(','))).toBe(pos);

  await rail.getByRole('button', { name: 'Rotar' }).click();
  await expect(rail.getByRole('button', { name: 'Rotar' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as any).__s.getState().transformMode)).toBe('rotate');
  await rail.getByRole('button', { name: 'Pintar' }).click();
  await expect(rail.getByRole('button', { name: 'Pintar' })).toHaveAttribute('aria-pressed', 'true');
  await expect(rail.getByRole('button', { name: 'Rotar' })).toHaveAttribute('aria-pressed', 'false');
  // Los atajos de siempre siguen: V vuelve a Seleccionar y S elige Escalar.
  await page.locator('.kura-viewport-wrap canvas').focus();
  await page.keyboard.press('v');
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().activeTool)).toBe('select');
  // Con un objeto elegido la herramienta Seleccionar deja marcado el modo del manipulador que había (Rotar): una sola pulsada.
  await expect(rail.getByRole('button', { name: 'Pintar' })).toHaveAttribute('aria-pressed', 'false');
  await expect(rail.getByRole('button', { name: 'Rotar' })).toHaveAttribute('aria-pressed', 'true');
  expect(await rail.locator('button[aria-pressed="true"]').count()).toBe(1);
  await page.keyboard.press('s');
  await expect(rail.getByRole('button', { name: 'Escalar' })).toHaveAttribute('aria-pressed', 'true');
});

for (const width of [1280, 1440]) {
  for (const lang of ['es', 'en', 'de']) {
    test(`barra de vista en una sola fila a ${width} px (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await conCubo(page, lang);
      const bar = page.locator('.kura-viewbar');
      await expect(bar).toBeVisible();
      await page.waitForTimeout(300);
      const r = await bar.evaluate((el) => {
        const tops = new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top)));
        return { h: el.getBoundingClientRect().height, rows: tops.size, overflow: el.scrollWidth > el.clientWidth + 1 };
      });
      expect(r.h).toBeLessThanOrEqual(56);
      expect(r.overflow).toBe(false);
      // Sin abreviaturas ambiguas: ningún botón dice «Sup» o «Der».
      await expect(bar.getByText(/^(Sup|Der)$/)).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/vista-${width}-${lang}.png`, clip: { x: 0, y: 0, width, height: 140 } });
    });
  }
}

test('rótulos conmutables: un solo botón, todas las barras, se recuerda al recargar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conCubo(page);
  const toggle = page.getByRole('button', { name: 'Rótulos' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.kura-tool-rail-label').first()).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.kura-tool-rail-label').first()).toBeHidden();
  await expect(page.locator('.kura-viewbar')).toHaveClass(/is-icons/);
  await expect(page.getByRole('button', { name: 'Acciones', exact: true }).locator('.kura-btn-label')).toBeHidden();
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Rótulos' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Rótulos' }).click();
  await expect(page.getByRole('button', { name: 'Rótulos' })).toHaveAttribute('aria-pressed', 'true');
});

test('tooltip con nombre, qué hace y atajo, con cursor y con foco; Esc lo cierra', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await conCubo(page);
  const medir = page.getByRole('toolbar', { name: 'Herramientas' }).getByRole('button', { name: 'Medir' });
  await medir.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Medir');
  await expect(tip).toContainText('Mide distancias');
  await expect(tip).toContainText('D');
  // No tapa el control: queda a su derecha.
  const [b, tb] = [await medir.boundingBox(), await tip.boundingBox()];
  expect(tb!.x).toBeGreaterThanOrEqual(b!.x + b!.width);
  await expect(medir).toHaveAttribute('aria-describedby', /kura-help-tooltip/);
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.mouse.move(700, 500);

  // Con el teclado: foco en la barra de vista.
  await page.getByRole('button', { name: 'Vista superior' }).last().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('tooltip')).toContainText('Mira la cama desde arriba');
});

test('la barra de estado explica el control sin mover los datos fijos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conCubo(page);
  const zona = page.getByTestId('status-help');
  const datos = page.locator('.kura-statusbar').getByText(/objs/);
  const antes = await datos.boundingBox();
  await page.getByRole('button', { name: 'Exportar' }).hover();
  await expect(zona).toContainText('Exportar — Guarda las piezas');
  await expect(zona).toHaveAttribute('aria-live', 'off');
  expect((await datos.boundingBox())!.x).toBeCloseTo(antes!.x, 0);
  // También para la barra lateral (con su título o nombre accesible).
  await page.locator('.kura-sidebar-left button').first().hover();
  await expect(zona).not.toContainText('Exportar');
  await page.mouse.move(700, 500);
  await expect(zona).toContainText('Ctrl+K');
  await page.screenshot({ path: `${SHOTS}/estado-ayuda.png`, clip: { x: 0, y: 860, width: 1440, height: 40 } });
});
