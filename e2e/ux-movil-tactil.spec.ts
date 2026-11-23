/**
 * @file e2e/ux-movil-tactil.spec.ts
 * @description Áreas táctiles a 390 px: recorre los controles interactivos visibles de las vistas principales
 * (escena vacía, objeto seleccionado, hojas Formas/Inspector/Medir, menú Más, chat de IA) y falla si alguno
 * mide menos de 44x44; comprueba que los avisos no tapan la hoja ni la barra; panel de IA y visor en
 * escritorio (1280 px). Capturas en .eval-tmp/ux-movil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crearCubo, rect, SHOTS } from './ux-movil-helpers';

const pequenos = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const sel = 'button, a[href], select, input:not([type="hidden"]), textarea, summary, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]';
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest('.sr-only, nav[aria-label], [inert], [hidden]')) continue;
      const box = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? (el.closest('label') ?? el) : el;
      const r = box.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      // Solo lo que se ve: el centro del control debe ser él mismo o uno de sus descendientes/etiqueta.
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      if (!top || !(el.contains(top) || top.contains(el) || el.closest('label')?.contains(top))) continue;
      if (r.width < 43.5 || r.height < 43.5) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? '').split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)];
  });

test.describe('390 px táctil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('ningún control visible mide menos de 44x44 en las vistas principales', async ({ page }) => {
    test.setTimeout(300000);
    await abrir(page);
    const fallos: Record<string, string[]> = {};
    const medir = async (vista: string) => {
      await page.waitForTimeout(350);
      const lista = await pequenos(page);
      if (lista.length) fallos[vista] = lista;
    };
    await medir('escena vacía');
    await crearCubo(page);
    await medir('objeto seleccionado');
    await page.getByRole('button', { name: 'Formas', exact: true }).tap();
    await medir('hoja Formas');
    await page.getByRole('button', { name: 'Escena', exact: true }).tap({ timeout: 4000 }).catch(() => undefined);
    await medir('hoja Escena');
    await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
    await medir('hoja Inspector');
    await page.evaluate(() => (window as any).__s.getState().setActiveTool('measure'));
    await medir('hoja Medir');
    await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
    await medir('chat de IA');
    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(false));
    await page.getByRole('button', { name: 'Más', exact: true }).tap();
    await medir('menú Más');
    await page.screenshot({ path: `${SHOTS}/tactil-mas.png` });
    expect(fallos).toEqual({});
  });

  test('los avisos no tapan la hoja ni las barras', async ({ page }) => {
    await abrir(page);
    await crearCubo(page);
    await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
    await page.evaluate(() => (window as any).__s.getState().addToast('Aviso de prueba para comprobar que no tapa la hoja', 'info'));
    await expect(page.locator('.kura-toast').first()).toBeVisible();
    const toast = (await rect(page, '.kura-toast'))!;
    for (const sel of ['.kura-narrow-panel-actions', '.kura-sidebar-right', '.kura-mobile-transform']) {
      const r = (await rect(page, sel))!;
      const cruza = toast.y < r.y + r.height && toast.y + toast.height > r.y && toast.x < r.x + r.width && toast.x + toast.width > r.x;
      expect(cruza, `el aviso tapa ${sel}`).toBe(false);
    }
    await page.screenshot({ path: `${SHOTS}/tactil-aviso.png` });
  });
});

test.describe('escritorio 1280 px', () => {
  test('el chat de IA mide <= 380 px, se pliega y el visor conserva >= 50 % del ancho', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await abrir(page);
    await crearCubo(page);
    await page.evaluate(() => (window as any).__s.getState().setAiDrawerOpen(true));
    await page.waitForTimeout(400);
    const drawer = (await rect(page, '.kura-ai-drawer'))!;
    expect(drawer.width).toBeLessThanOrEqual(380);
    const visor = (await rect(page, '.kura-viewport-wrap'))!;
    expect(visor.width).toBeGreaterThanOrEqual(1280 * 0.5);
    await page.screenshot({ path: `${SHOTS}/ia-1280-abierto.png` });
    await page.getByRole('button', { name: 'Plegar el panel de IA' }).click();
    const plegado = (await rect(page, '.kura-ai-drawer'))!;
    expect(plegado.height).toBeLessThan(120);
    await expect(page.getByRole('button', { name: 'Desplegar el panel de IA' })).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: `${SHOTS}/ia-1280-plegado.png` });
  });
});
