/**
 * @file e2e/ux3-forma-numeros.spec.ts
 * @description Formato numérico único: en es/de/fr los campos y rangos usan coma decimal, en en usan punto; los campos
 * son spinbutton con aria-value*, aceptan coma y punto al escribir y las expresiones ("1,5+2" y "1.5+2" = 3,5).
 * Recorre inspector, parámetros, dividir, corte, rosca, ahuecar y medir.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/ux3-forma';

/** Devuelve las cadenas visibles (valores de campos y texto) que usan el separador equivocado. */
async function escanear(page: Page, coma: boolean): Promise<string[]> {
  return page.evaluate((usaComa) => {
    // El separador de miles ("8,611.3" / "8.611,3") no cuenta como decimal.
    const malo = usaComa ? /\d\.\d/ : /\d,\d/;
    const sinMiles = (x: string) => x.replace(usaComa ? /(?<=\d)\.(?=\d{3}(?!\d))/g : /(?<=\d),(?=\d{3}(?!\d))/g, '');
    const fallos: string[] = [];
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    document.querySelectorAll('input.kura-precision-field').forEach((el) => {
      if (visible(el) && malo.test(sinMiles((el as HTMLInputElement).value))) fallos.push(`campo: ${(el as HTMLInputElement).value}`);
    });
    const raiz = document.querySelector('.kura-app') ?? document.body;
    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const txt = n.textContent ?? '';
      const p = n.parentElement;
      if (!p || !visible(p) || p.closest('.kura-brand') || /^(SCRIPT|STYLE|CODE)$/.test(p.tagName)) continue;
      if (malo.test(sinMiles(txt)) && !/v?\d+\.\d+\.\d+/.test(txt) && !/A?GPL-\d\.\d/.test(txt)) fallos.push(`texto: ${txt.trim().slice(0, 80)}`);
    }
    return fallos;
  }, coma);
}

for (const lang of ['es', 'de', 'fr', 'en'] as const) {
  test(`campos y rangos usan el separador del idioma (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, lang);
    const coma = lang !== 'en';
    await page.evaluate(async () => {
      const s = (window as any).__s.getState();
      await s.createPrimitive('box', { width: 40.5, height: 20.25, depth: 10.5 }, {});
    });
    await page.waitForTimeout(600);
    const todos: string[] = [];
    todos.push(...(await escanear(page, coma)).map((f) => `inspector ${f}`));
    await page.screenshot({ path: `${SHOTS}/numeros-inspector-${lang}.png` });
    await page.evaluate(() => {
      (window as any).__s.getState().setActiveTool('measure');
    });
    await page.waitForTimeout(300);
    todos.push(...(await escanear(page, coma)).map((f) => `medir ${f}`));
    await page.evaluate(() => {
      (window as any).__m.getState().setMode('capacity');
    });
    await page.waitForTimeout(400);
    todos.push(...(await escanear(page, coma)).map((f) => `capacidad ${f}`));
    await page.screenshot({ path: `${SHOTS}/numeros-medir-${lang}.png` });
    await page.evaluate(() => (window as any).__s.getState().setActiveTool('select'));
    for (const d of ['splitForBed', 'cut', 'thread', 'mold']) {
      await page.evaluate((x) => (window as any).__s.getState().setActiveDialog(x), d);
      await page.waitForTimeout(500);
      todos.push(...(await escanear(page, coma)).map((f) => `${d} ${f}`));
      await page.screenshot({ path: `${SHOTS}/numeros-${d}-${lang}.png` });
      await page.evaluate(() => (window as any).__s.getState().setActiveDialog(null));
      await page.waitForTimeout(200);
    }
    expect(todos, todos.join('\n')).toEqual([]);
  });
}

test('campos: spinbutton con aria-value*, flechas, coma y punto, expresiones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  await page.evaluate(() => (window as any).__s.getState().setActiveDialog('thread'));
  const campo = page.getByRole('dialog').getByRole('spinbutton').first();
  await expect(campo).toBeVisible();
  for (const a of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) {
    expect(await campo.getAttribute(a), a).not.toBeNull();
  }
  const paso = page.getByRole('dialog').getByRole('spinbutton').nth(1);
  await paso.fill('1,5+2');
  await paso.press('Enter');
  await expect(paso).toHaveValue('3,5');
  await paso.fill('1.5+2');
  await paso.press('Enter');
  await expect(paso).toHaveValue('3,5');
  await paso.fill('2,25');
  await paso.press('Enter');
  await expect(paso).toHaveValue('2,25');
  expect(await paso.getAttribute('aria-valuenow')).toBe('2.25');
  await paso.focus();
  await paso.press('ArrowUp');
  const v1 = Number(await paso.getAttribute('aria-valuenow'));
  await paso.press('Shift+ArrowUp');
  const v2 = Number(await paso.getAttribute('aria-valuenow'));
  await paso.press('Alt+ArrowUp');
  const v3 = Number(await paso.getAttribute('aria-valuenow'));
  expect(v1).toBeGreaterThan(2.25);
  expect(v2 - v1).toBeGreaterThan(v3 - v2);
  expect(v3).toBeGreaterThan(v2);
});
