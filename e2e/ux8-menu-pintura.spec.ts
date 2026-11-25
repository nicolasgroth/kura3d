/**
 * @file e2e/ux8-menu-pintura.spec.ts
 * @description Lote ux8: el menú contextual del objeto tiene un primer nivel corto con los mismos grupos y nombres
 * que el menú «Acciones» (ninguna acción se pierde, teclado completo); el diálogo de Texto 3D enfoca su campo;
 * en Pintar el trazo que sigue a la confirmación pinta, las muestras miden 32×32 px (44×44 en táctil) y la barra
 * y el panel dicen lo mismo del objeto destino.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { aPixel } from './ux-movil-helpers';
import { agregarForma } from './agregar-helpers';
import { abrir, crear, SHOTS } from './ux3-edicion-helpers';

async function cubo(page: Page): Promise<string> {
  const id = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
  await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
  await page.waitForTimeout(900);
  return id;
}

const triangulos = (page: Page) =>
  page.evaluate(() => (window as any).__s.getState().objects[0].mesh.indices.length / 3);
const pasos = (page: Page) => page.evaluate(() => (window as any).__s.getState().past.length);

const PRIMER_NIVEL = ['Renombrar', 'Duplicar', 'Ocultar (no se exporta)', 'Bloquear', 'Agrupar', 'Preparar para imprimir', 'Malla', 'Separar y combinar', 'Posición y tipo', 'Analizar', 'Más', 'Eliminar'];

const VISTAS = [
  { ancho: 1440, alto: 900, tema: 'light' as const },
  { ancho: 1024, alto: 768, tema: 'dark' as const },
];

test.describe('Menú contextual del objeto', () => {
  for (const { ancho, alto, tema } of VISTAS) {
    test(`primer nivel corto, grupos de «Acciones» y teclado a ${ancho} px (tema ${tema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      const errs = await abrir(page, ancho, alto);
      await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
      const id = await cubo(page);
      const p = await aPixel(page, [0, 20, 0]);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      const menu = page.locator('.kura-context-menu').first();
      await expect(menu).toBeVisible();
      const nivel1 = menu.locator(':scope > [role=menuitem], :scope > .kura-context-subwrap > [role=menuitem]');
      expect(await nivel1.count()).toBeLessThanOrEqual(12);
      expect(await nivel1.evaluateAll((els) => els.map((e) => e.querySelector('.kura-context-label')?.textContent))).toEqual(PRIMER_NIVEL);
      await page.screenshot({ path: `${SHOTS}/ux8-menu-${ancho}-${tema}.png` });

      // Teclado: el foco empieza en el primer ítem; Fin salta al último; Inicio vuelve; Tab no saca el foco del menú.
      await expect(nivel1.first()).toBeFocused();
      await page.keyboard.press('End');
      await expect(nivel1.last()).toBeFocused();
      await page.keyboard.press('Home');
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('.kura-context-menu') !== null)).toBe(true);

      // Una acción del menú «Acciones» sigue a un submenú de distancia: Posición y tipo ▸ Convertir en ▸ Negativo.
      await menu.getByRole('menuitem', { name: 'Posición y tipo' }).click();
      await menu.getByRole('menuitem', { name: 'Convertir en' }).click();
      await page.getByRole('menuitemradio', { name: 'Negativo' }).click();
      await expect(page.locator('.kura-context-menu')).toHaveCount(0);
      expect(await page.evaluate((x) => (window as any).__s.getState().objects.find((o: any) => o.id === x).role, id)).toBe('negative');

      // Los nombres del menú son los del menú «Acciones» de la barra: Preparar ▸ Ahuecar… aparece en ambos.
      await page.mouse.click(p.x, p.y, { button: 'right' });
      await page.locator('.kura-context-menu').first().getByRole('menuitem', { name: 'Preparar para imprimir' }).click();
      await expect(page.getByRole('menuitem', { name: 'Ahuecar…' }).first()).toBeVisible();
      await page.keyboard.press('Escape');
      // Escape dentro de un submenú cierra solo ese nivel; el segundo cierra el menú.
      await page.keyboard.press('Escape');
      await expect(page.locator('.kura-context-menu')).toHaveCount(0);
      expect(errs).toEqual([]);
    });
  }
});

test.describe('Texto 3D', () => {
  test('el foco inicial cae en el campo de texto', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    await agregarForma(page, 'Texto 3D');
    const campo = page.locator('#kura-text3d-input');
    await expect(campo).toBeVisible();
    await expect(campo).toBeFocused();
    expect(errs).toEqual([]);
  });
});

test.describe('Pintura: muestras y destino', () => {
  test('las muestras miden 32×32 con puntero y la barra y el panel dicen lo mismo con dos objetos', async ({ page }) => {
    const errs = await abrir(page, 1440, 900);
    const a = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [-20, 10, 0]);
    const b = await crear(page, 'box', { width: 20, height: 20, depth: 20 }, [20, 10, 0]);
    await page.evaluate(({ a, b }) => {
      const s = (window as any).__s.getState();
      s.setSelection([a, b]);
      s.setActiveTool('paint');
    }, { a, b });
    const muestra = page.getByTestId('panel-tool').locator('.kura-paint-palette .kura-swatch').first();
    await expect(muestra).toBeVisible();
    const caja = (await muestra.boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(32);
    expect(caja.height).toBeGreaterThanOrEqual(32);
    const barra = (await page.locator('.kura-paint-target').first().textContent())?.trim();
    const panel = (await page.getByTestId('panel-tool').locator('.kura-ctx-target').textContent())?.trim();
    expect(barra).toBeTruthy();
    expect(panel).toBe(barra);
    expect(barra).not.toMatch(/Sin objeto/i);
    expect(errs).toEqual([]);
  });

});

test.describe('Pintura', () => {
  for (const sinSeleccion of [false, true]) test(`tras confirmar el aviso, el primer trazo se aplica y el siguiente también pinta (${sinSeleccion ? 'sin selección previa' : 'objeto seleccionado'})`, async ({ page }) => {
    const errs = await abrir(page, 1280, 800);
    const id = await cubo(page);
    await page.evaluate(({ x, sinSeleccion }) => {
      const s = (window as any).__s.getState();
      s.setSelection(sinSeleccion ? [] : [x]);
      s.setActiveTool('paint');
    }, { x: id, sinSeleccion });
    await expect(page.locator('.kura-paint-toolbar').first()).toBeVisible();
    const base = await pasos(page);
    const a = await aPixel(page, [-8, 40, 0]);
    const b = await aPixel(page, [8, 40, 0]);
    // Trazo 1: arrastre sobre la cara superior; el aviso aparece al soltar.
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    const aviso = page.getByRole('dialog').filter({ hasText: /parámetros|paramétric/i }).first();
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: /^Pintar/ }).first().click();
    await expect(aviso).toBeHidden();
    await expect.poll(() => triangulos(page)).toBeGreaterThan(12);
    await expect.poll(() => pasos(page)).toBe(base + 1);
    const tras1 = await triangulos(page);
    // Trazo 2: otra pasada sobre otra zona de la misma cara; no pide aviso y también pinta.
    const c = await aPixel(page, [-8, 40, 12]);
    const d = await aPixel(page, [8, 40, 12]);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move((c.x + d.x) / 2, (c.y + d.y) / 2, { steps: 4 });
    await page.mouse.move(d.x, d.y, { steps: 4 });
    await page.mouse.up();
    await expect(aviso).toBeHidden();
    await expect.poll(() => pasos(page)).toBe(base + 2);
    expect(await triangulos(page)).toBeGreaterThan(tras1);
    expect(errs).toEqual([]);
  });
});
