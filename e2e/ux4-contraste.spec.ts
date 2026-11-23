/**
 * @file e2e/ux4-contraste.spec.ts
 * @description Menú contextual y árbol de Escena: texto de al menos 11 px, sin desbordes horizontales y con
 * contraste WCAG medido sobre los colores computados (texto normal ≥ 4,5:1; atenuado, atajos y contadores ≥ 3:1)
 * en tema claro y oscuro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { aPixel } from './ux-movil-helpers';
import { abrir, crear, SHOTS } from './ux4-helpers';

/** Mide contraste y tamaño de todo texto propio dentro de los contenedores dados. */
const medir = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/) ?? c.match(/color\(srgb ([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const raw = m[1].replace('/', ' ').split(/[\s,]+/).filter(Boolean).map(Number);
      const srgb = c.startsWith('color(');
      const [r, g, b] = srgb ? raw.slice(0, 3).map((v) => v * 255) : raw.slice(0, 3);
      return [r, g, b, raw[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top: number[], bottom: number[]) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    const fondo = (el: Element): number[] => {
      const chain: number[][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) chain.push(c);
        if (c[3] >= 1) break;
      }
      let acc: number[] = [255, 255, 255, 1];
      for (const c of chain.reverse()) acc = over(c, acc);
      return acc;
    };
    const tenue = '.kura-context-kbd, .kura-context-group-title, .kura-tree-count, .kura-tree-icon, .kura-context-hint, [aria-disabled="true"], :disabled';
    const out: Array<{ txt: string; cls: string; size: number; ratio: number; need: number }> = [];
    document.querySelectorAll<HTMLElement>(`${sel} *`).forEach((el) => {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!own) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = fondo(el);
      const fgOver = over(fg, bg);
      const L1 = lum(fgOver);
      const L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      // Deshabilitado queda exento de contraste mínimo (WCAG 1.4.3), pero se mide como atenuado igualmente.
      const need = el.matches(tenue) || el.closest(tenue) ? 3 : 4.5;
      out.push({ txt: (el.textContent ?? '').trim().slice(0, 24), cls: String(el.className).slice(0, 40), size: parseFloat(cs.fontSize), ratio: Math.round(ratio * 100) / 100, need });
    });
    return out;
  }, selector);

const desborda = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    return { sw: el.scrollWidth, cw: el.clientWidth };
  }, selector);

for (const tema of ['light', 'dark'] as const) {
  test(`menú contextual y árbol: ≥ 11 px, sin desbordes y contraste suficiente (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema });
    const errs = await abrir(page, 1440, 900);
    await page.evaluate((t) => (window as any).__s.getState().setColorScheme(t), tema);
    const a = await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [0, 20, 0]);
    await crear(page, 'cylinder', undefined, [50, 15, 0]);
    await page.evaluate((x) => (window as any).__s.getState().updateObjectMeta(x, { name: 'Una pieza con un nombre bastante largo para el árbol' }), a);
    await page.evaluate(() => (window as any).__s.getState().requestCameraPreset('fit'));
    await page.waitForTimeout(900);

    // Árbol de Escena.
    await page.getByRole('tab', { name: /Escena/ }).first().click();
    await page.waitForTimeout(400);
    const arbol = await medir(page, '.kura-sidebar-left');
    await page.screenshot({ path: `${SHOTS}/4-arbol-${tema}.png` });
    // Menú contextual.
    const p = await aPixel(page, [0, 20, 0]);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await expect(page.getByRole('menu').first()).toBeVisible();
    const menu = await medir(page, '.kura-context-menu');
    await page.screenshot({ path: `${SHOTS}/4-menu-${tema}.png` });
    const caja = await page.locator('.kura-context-menu').first().boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(1440);
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(900);
    const dm = await desborda(page, '.kura-context-menu');
    expect(dm.sw).toBeLessThanOrEqual(dm.cw + 1);
    const da = await desborda(page, '.kura-scene-tree');
    expect(da.sw).toBeLessThanOrEqual(da.cw + 1);

    const todos = [...arbol.map((m) => ({ ...m, donde: 'árbol' })), ...menu.map((m) => ({ ...m, donde: 'menú' }))];
    expect(todos.length).toBeGreaterThan(10);
    const chicos = todos.filter((m) => m.size < 11);
    expect(chicos, JSON.stringify(chicos, null, 1)).toEqual([]);
    const flojos = todos.filter((m) => m.ratio < m.need);
    expect(flojos, JSON.stringify(flojos, null, 1)).toEqual([]);
    expect(errs).toEqual([]);
  });
}
