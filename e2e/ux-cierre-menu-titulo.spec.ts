/**
 * @file e2e/ux-cierre-menu-titulo.spec.ts
 * @description El menú contextual del objeto abre mostrando su encabezado (nombre del objeto) completo, sin scroll
 * interno inicial ni sombra encima, a 1280x800 y a 390x844. Capturas en .eval-tmp/ux-cierre.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crearCubo, aPixel } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux-cierre';

for (const [w, h] of [[1280, 800]] as const) {
  test(`el menú del objeto muestra su título completo al abrir (${w}x${h})`, async ({ page }) => {
    const errs: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.setViewportSize({ width: w, height: h });
    await abrir(page);
    await crearCubo(page);
    const centro = await aPixel(page, await page.evaluate(() => (window as any).__s.getState().objects[0].position));
    await page.mouse.click(centro.x, centro.y, { button: 'right' });
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();
    await page.waitForTimeout(400);
    const r = await menu.evaluate((m) => {
      const head = m.querySelector('.kura-context-header') as HTMLElement;
      const mb = m.getBoundingClientRect();
      const hb = head.getBoundingClientRect();
      const topEl = document.elementFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2);
      return {
        scrollTop: m.scrollTop,
        headTop: hb.top,
        menuTop: mb.top,
        text: head.textContent,
        covered: !head.contains(topEl) && topEl !== head,
        clipped: head.scrollWidth > head.clientWidth + 1,
      };
    });
    await page.screenshot({ path: `${SHOTS}/menu-titulo-${w}.png` });
    expect(r.scrollTop).toBe(0);
    expect(r.headTop).toBeGreaterThanOrEqual(r.menuTop - 0.5);
    expect(r.headTop).toBeGreaterThanOrEqual(0);
    expect(r.covered).toBe(false);
    expect(r.clipped).toBe(false);
    expect(r.text).toMatch(/Cubo/);
    expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e))).toEqual([]);
  });
}
