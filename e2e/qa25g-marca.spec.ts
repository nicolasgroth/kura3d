/**
 * @file e2e/qa25g-marca.spec.ts
 * @description QA 25-nov (G), bloque 4: marca. «Acerca de» y Ajustes › Identidad visual muestran el logo completo claro u oscuro
 * según el tema (6 temas de color × claro/oscuro) y su texto se lee (contraste del texto del SVG contra el fondo real);
 * el favicon responde como SVG; el README referencia archivos que existen y no quedan referencias a los PNG borrados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { abrir } from './qa25a-helpers';

const RAIZ = 'G:/proyectos/kura3d';
const EVID = `${RAIZ}/.eval-tmp/qa25g`;
const TEMAS = ['obsidian', 'kura_prism', 'studio_pro', 'nordic_frost', 'solar_amber', 'high_contrast'];

const lum = ([r, g, b]: number[]) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** Primer fondo opaco del contenedor del logo (rgb). */
async function fondoDe(loc: Locator): Promise<number[]> {
  return loc.evaluate((el) => {
    let e: Element | null = el;
    while (e) {
      const c = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
      if (c.length >= 3 && (c[3] ?? 1) > 0.9) return c.slice(0, 3);
      e = e.parentElement;
    }
    return [255, 255, 255];
  });
}

for (const esquema of ['light', 'dark'] as const) {
  for (const tema of TEMAS) {
    test(`logo en «Acerca de» y Ajustes: tema ${tema}, esquema ${esquema}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const errs = await abrir(page);
      await page.emulateMedia({ colorScheme: esquema });
      await page.evaluate(([e, t]) => { const s = (window as any).__s.getState(); s.setColorScheme(e); s.setThemePreset(t); }, [esquema, tema] as const);
      for (const donde of ['about', 'ajustes'] as const) {
        if (donde === 'about') await page.evaluate(() => (window as any).__s.getState().setActiveDialog('about'));
        else await page.evaluate(() => (window as any).__s.getState().openSettings('about'));
        const dlg = page.getByRole('dialog').first();
        await expect(dlg).toBeVisible();
        const logo = dlg.locator('img.kura-brand-logo').first();
        await expect(logo, `${donde}: logo completo`).toBeVisible();
        await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
        const variante = await logo.getAttribute('data-brand-scheme');
        expect(variante, `${donde} variante del logo`).toBe(esquema);
        const fondo = await fondoDe(logo);
        // Texto del SVG: «Studio» y la bajada. Claro: #332150 / #665b80; oscuro: #e8e0f5 / #b4aacb.
        const textos = esquema === 'light' ? ['#332150', '#665b80'] : ['#e8e0f5', '#b4aacb'];
        const cr = textos.map((t) => +ratio(hex(t), fondo).toFixed(2));
        console.log('QA25G marca', donde, tema, esquema, 'fondo', fondo.join(','), 'contraste', cr.join('/'));
        expect.soft(Math.min(...cr), `${donde} ${tema} ${esquema}: contraste del texto del logo ${cr}`).toBeGreaterThanOrEqual(3);
        await page.screenshot({ path: `${EVID}/marca-${donde}-${tema}-${esquema}.png` });
        await page.keyboard.press('Escape');
        await expect(dlg).toBeHidden();
      }
      expect(errs.filter((e) => !/WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
    });
  }
}

test('favicon: el enlace del index responde con un SVG y el sistema (modo del SO) no cambia el logo en esquema forzado', async ({ page, request }) => {
  await abrir(page);
  const href = await page.locator('link[rel="icon"]').first().getAttribute('href');
  expect(href).toBe('/branding/kurra-studio-icono.svg');
  const r = await request.get(new URL(href!, process.env.KURA_URL).toString());
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toMatch(/svg/);
  expect(await page.title()).toMatch(/Kurra Studio/);
  expect(await page.title()).not.toMatch(/Kura3D/);
});

test('carpeta del proyecto: README apunta a archivos que existen y no quedan referencias a los PNG borrados', async () => {
  const readme = readFileSync(`${RAIZ}/README.md`, 'utf8');
  const rutas = [...readme.matchAll(/(?:src|srcset|href)="([^"]+)"|\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? m[2]).filter((r) => r && !/^https?:|^#|^mailto:/.test(r));
  expect(rutas.length).toBeGreaterThan(0);
  const faltan = rutas.filter((r) => !existsSync(join(RAIZ, decodeURI(r.split('#')[0]))));
  expect(faltan, `rutas del README que no existen: ${faltan}`).toEqual([]);
  expect(rutas.some((r) => /kurra-studio-banner/.test(r))).toBe(true);
  const malos: string[] = [];
  const barrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (/node_modules|\.git$|dist|\.eval-tmp|\.claude/.test(p)) continue;
      const st = statSync(p);
      if (st.isDirectory()) barrer(p);
      else if (/\.(ts|tsx|md|html|css|json|svg|rs|toml)$/.test(n) && st.size < 2_000_000) {
        if (/kura3d-[\w-]*\.png/i.test(readFileSync(p, 'utf8'))) malos.push(p);
      }
    }
  };
  for (const d of ['src', 'docs', 'public', 'e2e']) barrer(join(RAIZ, d));
  for (const f of ['index.html', 'README.md', 'CHANGELOG.md']) if (/kura3d-[\w-]*\.png/i.test(readFileSync(join(RAIZ, f), 'utf8'))) malos.push(f);
  console.log('QA25G refs PNG borrados:', JSON.stringify(malos));
  expect(malos.filter((m) => !/qa25g-marca/.test(m)), `referencias a kura3d-*.png: ${malos}`).toEqual([]);
});
