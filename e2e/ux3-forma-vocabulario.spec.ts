/**
 * @file e2e/ux3-forma-vocabulario.spec.ts
 * @description Vocabulario y tamaño de texto: ningún texto visible mide menos de 11 px en las pantallas principales,
 * el título de Ajustes no menciona el puente MCP y en inglés se dice «bed» (no «build plate»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

/** Elementos con texto propio visible y tamaño de letra menor que 11 px. */
const pequenos = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>('.kura-app *, [role=dialog] *').forEach((el) => {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      if (!own) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) {
        out.push(`${el.tagName}.${el.className} ${size}px "${(el.textContent ?? '').trim().slice(0, 30)}"`);
      }
    });
    return out;
  });

for (const esquema of ['light', 'dark'] as const) {
  test(`ningún texto visible mide menos de 11 px (${esquema})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: esquema });
    await abrir(page, 'es');
    await page.evaluate(async () => {
      await (window as any).__s.getState().createPrimitive('box', { width: 40, height: 40, depth: 40 }, {});
    });
    await page.waitForTimeout(800);
    const fallos: string[] = [...(await pequenos(page))];
    for (const d of ['splitForBed', 'cut', 'thread', 'settings']) {
      await page.evaluate((x) => (window as any).__s.getState().setActiveDialog(x), d);
      await page.waitForTimeout(400);
      fallos.push(...(await pequenos(page)).map((f) => `${d}: ${f}`));
      if (d === 'settings') {
        await expect(page.getByRole('dialog').getByRole('heading', { name: 'Ajustes de Kurra Studio', exact: true })).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/vocab-ajustes-${esquema}.png` });
      }
      await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));
      await page.waitForTimeout(200);
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });
}

test('en inglés se usa «bed» y el título de Ajustes es «Settings»', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'en');
  const texto = await page.evaluate(() => document.body.innerText);
  expect(texto).not.toMatch(/build plate/i);
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('settings'));
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Kurra Studio Settings', exact: true })).toBeVisible();
});
