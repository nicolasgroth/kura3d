/**
 * @file e2e/qa25-centro-mensajes.spec.ts
 * @description QA del centro de mensajes: ráfagas mixtas, solapamiento con barra y paleta a 1024 y 1280 px, Esc con
 * panel y emergente, Enter sin acciones por sorpresa, pieza borrada con mensaje ligado y deshacer, idioma y tema con
 * histórico, STL con malla abierta, consola limpia.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, importarStl } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/qa-centro-mensajes';
const toast = (page: Page, text: string, kind = 'info') =>
  page.evaluate(([x, k]) => (window as any).__s.getState().addToast(x, k), [text, kind]);
const centro = (page: Page) => page.getByTestId('toast-center');
const icono = (page: Page, nombre: string | RegExp) => centro(page).getByRole('button', { name: nombre });

function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

type Caja = { x: number; y: number; width: number; height: number };
const solapa = (a: Caja, b: Caja) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('ráfaga de 60 mensajes mixtos: un emergente, histórico acotado, sin errores', async ({ page }) => {
  const errores = vigilarConsola(page);
  await abrir(page);
  await page.evaluate(() => {
    const s = (window as any).__s.getState();
    const kinds = ['info', 'success', 'warning', 'error'];
    for (let i = 0; i < 60; i++) s.addToast(`Mensaje ${i}`, kinds[i % 4]);
  });
  await expect(page.locator('.kura-toast')).toHaveCount(1);
  const n = await page.evaluate(() => (window as any).__s.getState().toastHistory.length);
  expect(n).toBeLessThanOrEqual(50);
  expect(await centro(page).getByRole('button').count()).toBe(3);
  expect(errores).toEqual([]);
});

for (const [w, h] of [[1024, 768], [1280, 720]] as const) {
  test(`el emergente no tapa la barra de herramientas ni la paleta a ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await abrir(page);
    await page.evaluate(() => (window as any).__s.getState().addToast('Aviso largo '.repeat(8), 'error'));
    await expect(page.locator('.kura-toast')).toHaveCount(1);
    const t = await page.locator('.kura-toast').boundingBox();
    expect(t).not.toBeNull();
    const botones = await page.locator('button:visible').evaluateAll((bs) =>
      bs.filter((b) => !b.closest('.kura-toast') && !b.closest('[data-testid="toast-center"]'))
        .map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, name: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30) }; })
        .filter((r) => r.width > 0 && r.height > 0));
    const tapados = botones.filter((b) => solapa(t!, b));
    expect(tapados, JSON.stringify(tapados)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/toolbar-${w}.png` });
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/paleta-${w}.png` });
    const pal = page.getByRole('dialog').first();
    if (await pal.count()) {
      const pb = await pal.boundingBox();
      const tb = await page.locator('.kura-toast').boundingBox();
      if (pb && tb) expect(solapa(pb, tb), `paleta ${JSON.stringify(pb)} toast ${JSON.stringify(tb)}`).toBe(false);
    }
  });
}

test('Esc con panel y emergente a la vista; llega un mensaje con el panel abierto; Vaciar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await abrir(page);
  await toast(page, 'Info uno', 'info');
  await toast(page, 'Advertencia viva', 'warning');
  await icono(page, /informativ/).click();
  await expect(page.getByRole('dialog', { name: 'Información' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.kura-toast')).toHaveCount(1);
  await icono(page, /informativ/).click();
  await toast(page, 'Info dos', 'info');
  await expect(page.getByRole('dialog', { name: 'Información' }).locator('li')).toHaveCount(2);
  await page.getByRole('dialog', { name: 'Información' }).getByRole('button', { name: /^Vaciar/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('Enter al abrir el panel con teclado no vacía ni quita nada', async ({ page }) => {
  await abrir(page);
  await toast(page, 'A', 'error');
  await toast(page, 'B', 'error');
  const btn = icono(page, '2 errores');
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Errores' }).locator('li')).toHaveCount(2);
  const foco = await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute('role'));
  expect(foco).toBe('dialog');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Errores' }).locator('li')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(btn).toBeFocused();
});

test('pieza borrada con mensaje ligado: se va del histórico y deshacer no lo revive ni lo rompe', async ({ page }) => {
  const errores = vigilarConsola(page);
  await abrir(page);
  const id = await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const o = await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
    (window as any).__n = 0;
    s.addToast('Malla abierta en la pieza', 'warning', { label: 'Reparar malla', run: () => { (window as any).__n++; }, targetIds: [o.id] }, { objectIds: [o.id] });
    return o.id as string;
  });
  await expect(icono(page, '1 advertencia')).toBeVisible();
  await page.evaluate((i) => (window as any).__s.getState().deleteObjects([i]), id);
  await expect(icono(page, /advertencia/)).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.getState().undo());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__n)).toBe(0);
  expect(errores).toEqual([]);
});

test('idioma y tema con histórico: sin claves crudas ni glifos como nombre', async ({ page }) => {
  test.setTimeout(90000);
  const errores = vigilarConsola(page);
  await abrir(page);
  await toast(page, 'Uno', 'error');
  await toast(page, 'Dos', 'warning');
  await toast(page, 'Tres', 'info');
  for (const lang of ['en', 'de', 'fr', 'pt', 'es']) {
    await page.evaluate((l) => (window as any).__s.getState().setLanguage(l), lang);
    for (const scheme of ['dark', 'light']) {
      await page.evaluate((c) => (window as any).__s.getState().setColorScheme(c), scheme);
      const nombres = await centro(page).getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || ''));
      expect(nombres.length).toBe(3);
      for (const n of nombres) {
        expect(n, `idioma ${lang}`).not.toMatch(/toastCenter\./);
        expect(n.length).toBeGreaterThan(3);
      }
      await centro(page).getByRole('button').first().click();
      const dlg = page.getByRole('dialog').last();
      const txt = await dlg.innerText();
      expect(txt, `idioma ${lang}`).not.toMatch(/toastCenter\./);
      const botones = await dlg.getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent || ''));
      for (const b of botones) expect(b).not.toMatch(/^[×✓✕x]$/i);
      if (lang === 'de' && scheme === 'dark') await page.screenshot({ path: `${SHOTS}/panel-de-dark.png` });
      await page.keyboard.press('Escape');
    }
  }
  expect(errores).toEqual([]);
});

test('STL con malla abierta: advertencia en el histórico y su acción opera desde el panel', async ({ page }) => {
  const errores = vigilarConsola(page);
  await abrir(page);
  const L = ['solid abierto'];
  const q = (a: number[], b: number[], c: number[], d: number[]) => { for (const t of [[a, b, c], [a, c, d]]) { L.push('facet normal 0 0 0', 'outer loop'); for (const v of t) L.push(`vertex ${v.join(' ')}`); L.push('endloop', 'endfacet'); } };
  const p = (x: number, y: number, z: number) => [x * 10, y * 10, z * 10];
  q(p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1));
  q(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1));
  q(p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1));
  q(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1));
  q(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1));
  L.push('endsolid abierto');
  await importarStl(page, 'abierto.stl', L.join('\n'));
  await expect(page.getByTestId('toast-center')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/import-abierto.png` });
  const hist = await page.evaluate(() => (window as any).__s.getState().toastHistory.map((e: any) => ({ t: e.text, k: e.kind, a: (e.actions ?? []).map((x: any) => x.label) })));
  console.log('HIST ' + JSON.stringify(hist));
  const reparar = hist.find((e: any) => e.a.includes('Reparar malla'));
  expect(reparar, 'no hay mensaje con Reparar malla: ' + JSON.stringify(hist)).toBeTruthy();
  await icono(page, /advertencia/).click();
  await page.getByRole('dialog', { name: 'Advertencias' }).getByRole('button', { name: 'Reparar malla' }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errores).toEqual([]);
});
