/**
 * @file e2e/pulido7-avisos.spec.ts
 * @description La pila de avisos nunca se dibuja sobre la píldora de Consejo ni sobre un diálogo modal abierto, a
 * 390, 1024, 1280 y 1440 px: se comparan los rectángulos de los avisos (y «Cerrar todos») con los de la barra de
 * Consejo y, con un modal, se comprueba que ningún punto del aviso dentro del diálogo es el elemento superior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, stlCubes, importarStl } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/pulido7';
const ANCHOS: Array<[number, number]> = [[390, 844], [1024, 768], [1280, 800], [1440, 900]];

async function avisos(page: Page, n = 3) {
  await page.evaluate((k) => {
    const s = (window as any).__s.getState();
    for (let i = 0; i < k; i++) s.addToast(`Creado cubo de prueba ${i + 1}`, 'info');
  }, n);
  await expect(page.locator('.kura-toast').first()).toBeVisible();
  await page.waitForTimeout(450);
}

for (const [w, h] of ANCHOS) {
  test.describe(`${w} px`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('los avisos y «Cerrar todos» no tapan la barra de Consejo', async ({ page }) => {
      await abrir(page);
      await avisos(page);
      const r = await page.evaluate(() => {
        const rect = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const tip = [...document.querySelectorAll('.kura-protip-wrap > *')].map(rect).filter((b) => b.w > 0);
        const items = [...document.querySelectorAll('.kura-toast, .kura-toast-more')].map((e) => ({ name: e.className, ...rect(e) }));
        return { tip, items };
      });
      await page.screenshot({ path: `${SHOTS}/avisos-consejo-${w}.png` });
      expect(r.items.some((i) => i.name.includes('kura-toast-close-all'))).toBe(true);
      for (const t of r.tip) {
        for (const i of r.items) {
          const cruza = i.x < t.x + t.w && i.x + i.w > t.x && i.y < t.y + t.h && i.y + i.h > t.y;
          expect(cruza, `${i.name} cruza la barra de Consejo`).toBe(false);
        }
      }
    });

    test('con un diálogo modal abierto, ningún aviso se dibuja encima de él', async ({ page }) => {
      await abrir(page);
      await avisos(page);
      await page.evaluate(() => (window as any).__s.getState().setActiveDialog('shortcuts'));
      const dlg = page.getByRole('dialog');
      await expect(dlg).toBeVisible();
      await page.waitForTimeout(700);
      const tapa = await page.evaluate(() => {
        const d = document.querySelector('dialog[open]')!.getBoundingClientRect();
        const out: string[] = [];
        for (const e of document.querySelectorAll('.kura-toast, .kura-toast-more')) {
          const b = e.getBoundingClientRect();
          const x0 = Math.max(b.left, d.left), x1 = Math.min(b.right, d.right);
          const y0 = Math.max(b.top, d.top), y1 = Math.min(b.bottom, d.bottom);
          if (x1 <= x0 || y1 <= y0) continue;
          for (let i = 1; i <= 5; i++) for (let j = 1; j <= 5; j++) {
            const top = document.elementFromPoint(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * j) / 6);
            if (top && e.contains(top)) out.push(e.className);
          }
        }
        return out;
      });
      expect(tapa, 'avisos dibujados sobre el diálogo').toEqual([]);
      await page.screenshot({ path: `${SHOTS}/avisos-modal-${w}.png` });
    });
  });
}

test.describe('diálogo de unidades a 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('el aviso del STL diminuto no tapa ninguna opción del diálogo', async ({ page }) => {
    await abrir(page);
    await importarStl(page, 'diminuto.stl', stlCubes([[0, 0, 0]], 0.9));
    const aviso = page.locator('.kura-toast', { hasText: 'mide 0,9 mm' }).first();
    await expect(aviso).toBeVisible({ timeout: 30000 });
    await aviso.getByRole('button', { name: 'Otra unidad…' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await page.waitForTimeout(700);
    const opciones = await dlg.locator('button:not(.kura-toast *, .kura-toast-more), input, label').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }));
    const tapadas = await page.evaluate((pts) => pts.filter((p) => { const t = document.elementFromPoint(p.x, p.y); return !!t?.closest('.kura-toast, .kura-toast-more'); }), opciones);
    await page.screenshot({ path: `${SHOTS}/avisos-unidades-390.png` });
    expect(tapadas).toEqual([]);
  });
});
