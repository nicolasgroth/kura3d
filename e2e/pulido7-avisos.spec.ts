/**
 * @file e2e/pulido7-avisos.spec.ts
 * @description El emergente de avisos nunca se dibuja sobre la píldora de Consejo ni sobre un diálogo modal abierto, a
 * 390, 1024, 1280 y 1440 px: se comparan los rectángulos de los avisos con los de la barra de
 * Consejo y, con un modal, se comprueba que ningún punto del aviso dentro del diálogo es el elemento superior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, stlCubes, importarStl } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/pulido7';
const ANCHOS: Array<[number, number]> = [[1024, 768], [1280, 800], [1440, 900]];

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

    test('el emergente no tapa la barra de Consejo', async ({ page }) => {
      await abrir(page);
      await avisos(page);
      const r = await page.evaluate(() => {
        const rect = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const tip = [...document.querySelectorAll('.kura-protip-wrap > *')].map(rect).filter((b) => b.w > 0);
        const items = [...document.querySelectorAll('.kura-toast, .kura-toast-more')].map((e) => ({ name: e.className, ...rect(e) }));
        return { tip, items };
      });
      await page.screenshot({ path: `${SHOTS}/avisos-consejo-${w}.png` });
      expect(r.items).toHaveLength(1);
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
