/**
 * @file e2e/pulido7-contraste.spec.ts
 * @description «Cerrar todos» y «+N» de la pila de avisos usan los tokens del tema: contraste del texto contra su
 * fondo >= 4,5:1 en tema claro y oscuro (colores computados, resueltos con un canvas para aceptar light-dark()).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/pulido7';

for (const scheme of ['light', 'dark'] as const) {
  test(`«Cerrar todos» tiene contraste suficiente en tema ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await page.evaluate((s) => (window as any).__s.getState().setColorScheme(s), scheme);
    await page.evaluate(() => { const s = (window as any).__s.getState(); for (let i = 0; i < 5; i++) s.addToast(`Aviso ${i}`, 'info'); });
    const botones = page.locator('.kura-toast-more');
    await expect(botones.first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/contraste-${scheme}.png` });
    const ratios = await page.evaluate(() => {
      const rgb = (css: string) => {
        const c = document.createElement('canvas').getContext('2d')!;
        c.fillStyle = '#000';
        c.fillStyle = css;
        c.fillRect(0, 0, 1, 1);
        return Array.from(c.getImageData(0, 0, 1, 1).data.slice(0, 3));
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      return [...document.querySelectorAll('.kura-toast-more')].map((e) => {
        const cs = getComputedStyle(e);
        const a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
        return { texto: e.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), color: cs.color, fondo: cs.backgroundColor };
      });
    });
    expect(ratios.length).toBeGreaterThan(0);
    for (const r of ratios) expect(r.ratio, `${r.texto}: ${r.color} sobre ${r.fondo}`).toBeGreaterThanOrEqual(4.5);
  });
}
