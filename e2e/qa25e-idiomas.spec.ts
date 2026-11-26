/**
 * @file e2e/qa25e-idiomas.spec.ts
 * @description QA 25-nov (E): textos nuevos de placas, exportar por placa, Orientar y Dividir en inglés y alemán, sin claves
 * crudas ni «Kura3D» en pantalla (diálogo de exportar con dos placas, menú contextual, inspector, insignia y Orientar).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

const S = <T,>(page: Page, fn: (s: any) => T): Promise<T> =>
  page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());
const crudas = (txt: string) => txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,}\b/g)?.filter((k) => /^(plates|dialog|split|orient|simplify|smooth|ux7?|ctx|inspector|rediseno|export)\./.test(k)) ?? [];

for (const lang of ['en', 'de'] as const) {
  test(`placas y exportar en ${lang}: sin claves crudas ni Kura3D`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrir(page);
    await page.evaluate((l) => (window as any).__s.getState().setLanguage(l), lang);
    await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
    await S(page, (s) => s.createPlate());
    await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo2' });
    await S(page, (s) => s.setSelection([s.objects[0].id]));
    await page.waitForTimeout(500);
    const tramos: string[] = [];
    tramos.push(await page.evaluate(() => document.body.innerText));
    const fila = page.getByRole('treeitem').first();
    await fila.press('Shift+F10');
    await page.waitForTimeout(400);
    tramos.push(await page.evaluate(() => document.body.innerText));
    await page.keyboard.press('Escape');
    await S(page, (s) => s.setSelection([]));
    await page.getByRole('button', { name: /^(Export|Exportieren)$/ }).first().click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    tramos.push(await dlg.innerText());
    await dlg.getByRole('radio', { name: /^3MF/ }).check();
    tramos.push(await dlg.innerText());
    await dlg.getByRole('radio', { name: /^STL/ }).check();
    tramos.push(await dlg.innerText());
    await page.screenshot({ path: `G:/proyectos/kura3d/.eval-tmp/qa25e/export-${lang}.png` });
    const todo = tramos.join('\n');
    console.log('QA25E', lang, 'claves crudas:', JSON.stringify(crudas(todo)), 'Kura3D:', /Kura3D/.test(todo));
    expect(crudas(todo)).toEqual([]);
    expect(todo).not.toMatch(/Kura3D/);
    expect(todo).toMatch(lang === 'en' ? /Parts on 2 plates/ : /Teile auf 2 Platten/);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

/** Contraste WCAG de un texto contra el primer fondo opaco de sus ancestros. */
const contraste = (el: Element) => {
  const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]: number[]) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fg = parse(getComputedStyle(el).color);
  let bgEl: Element | null = el, bg = [255, 255, 255];
  while (bgEl) { const c = parse(getComputedStyle(bgEl).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.9) { bg = c; break; } bgEl = bgEl.parentElement; }
  const [a, b] = [lum(fg), lum(bg)];
  return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
};

for (const esquema of ['dark', 'light'] as const) {
  test(`textos nuevos de exportar y del inspector se leen en tema ${esquema} (contraste >= 4,5)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errs = await abrir(page);
    await page.emulateMedia({ colorScheme: esquema });
    await page.evaluate((e) => (window as any).__s.getState().setColorScheme(e), esquema);
    await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
    await S(page, (s) => s.createPlate());
    await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo2' });
    await S(page, (s) => s.setSelection([s.objects[0].id]));
    const nota = page.getByTestId('plate-relative-note');
    await expect(nota).toBeVisible();
    const cNota = await nota.evaluate(contraste.toString().length ? new Function('el', `return (${contraste.toString()})(el)`) as any : null);
    const insignia = await page.getByTestId('plate-badge').first().evaluate(new Function('el', `return (${contraste.toString()})(el)`) as any);
    await page.screenshot({ path: `G:/proyectos/kura3d/.eval-tmp/qa25e/inspector-nota-${esquema}.png` });
    await S(page, (s) => s.setSelection([]));
    await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('radio', { name: /^3MF/ }).check();
    const ayuda = await dlg.locator('.kura-export-scope .kura-export-info').first().evaluate(new Function('el', `return (${contraste.toString()})(el)`) as any);
    await page.screenshot({ path: `G:/proyectos/kura3d/.eval-tmp/qa25e/export-ayuda-${esquema}.png` });
    console.log('QA25E contraste', esquema, JSON.stringify({ nota: cNota, insignia, ayuda }));
    expect(cNota).toBeGreaterThanOrEqual(4.5);
    expect(insignia).toBeGreaterThanOrEqual(4.5);
    expect(ayuda).toBeGreaterThanOrEqual(4.5);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}
