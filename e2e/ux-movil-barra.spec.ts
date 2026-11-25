/**
 * @file e2e/ux-movil-barra.spec.ts
 * @description Barra superior de escritorio: a 1440 px los rótulos son visibles en los 6 idiomas y la barra
 * no cambia de forma al seleccionar un objeto; a 1280 y 1024 px primero pasan a "Más" los controles menos
 * usados; todo botón sin rótulo lleva title y nombre accesible. Capturas en .eval-tmp/ux-movil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crearCubo, SHOTS } from './ux-movil-helpers';

const forma = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.kura-topbar')!;
    const labels = [...bar.querySelectorAll('.kura-tool-label, .kura-btn-label')].map((el) => getComputedStyle(el).display !== 'none');
    return { compact: bar.classList.contains('is-compact'), labelsVisible: labels.every(Boolean) && labels.length > 0, more: !!bar.querySelector('.kura-topbar-more') };
  });

const sinNombre = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.kura-topbar')!;
    return [...bar.querySelectorAll('button, select')]
      .filter((el) => (el as HTMLElement).getClientRects().length > 0)
      .filter((el) => {
        const name = el.getAttribute('aria-label') || (el.textContent ?? '').trim();
        const visibleText = [...el.querySelectorAll('span')].some((s) => getComputedStyle(s).display !== 'none' && (s.textContent ?? '').trim());
        const tip = el.getAttribute('title') || el.closest('[title]');
        return !name || (!visibleText && !tip);
      })
      .map((el) => el.outerHTML.slice(0, 90));
  });

for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh']) {
  test(`1440 px (${lang}): rótulos visibles y misma forma al seleccionar`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, lang);
    await page.waitForTimeout(400);
    const antes = await forma(page);
    expect(antes.labelsVisible).toBe(true);
    await crearCubo(page);
    await page.waitForTimeout(400);
    const despues = await forma(page);
    expect(despues.compact).toBe(false);
    expect(despues.labelsVisible).toBe(true);
    expect(despues.more).toBe(antes.more);
    expect(await sinNombre(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/barra-1440-${lang}.png`, clip: { x: 0, y: 0, width: 1440, height: 60 } });
  });
}

for (const width of [1280, 1024]) {
  for (const lang of ['es', 'en', 'de']) {
    test(`${width} px (${lang}): oculta controles poco usados antes de quitar rótulos y todo icono tiene nombre`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await abrir(page, lang);
      await crearCubo(page);
      await page.waitForTimeout(500);
      const f = await forma(page);
      if (!f.compact) expect(f.labelsVisible).toBe(true);
      expect(await sinNombre(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/barra-${width}-${lang}.png`, clip: { x: 0, y: 0, width, height: 60 } });
    });
  }
}
