/**
 * @file e2e/qa25j-datos.spec.ts
 * @description QA 26-nov (I), bloque 3 (tema oscuro): «Datos del proyecto». El HTML pegado en notas, descripción y autor se
 * muestra como texto y no ejecuta nada (ni `window.__xss` ni diálogos), las notas nunca llegan a `localStorage`
 * (`kura3d-recent-info`), guardar/reabrir conserva todo y «modificado» cambia al guardar y no al abrir, un `.kura` antiguo
 * abre con «Sin fecha», a 1024 px nada desborda y el alemán no se corta. Evidencia en `.eval-tmp/qa25j/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25j';
const PAYLOAD = '<img src=x onerror="window.__xss=1;alert(1)"><script>window.__xss=2;alert(2)</script>';

async function panelProyecto(page: Page) {
  await page.getByRole('button', { name: /^Proyecto/ }).first().click();
  const section = page.getByTestId('panel-project-info');
  await expect(section).toBeVisible();
  return section;
}
const desborde = (page: Page) => page.evaluate(() => {
  const el = document.querySelector('[data-testid="panel-project-info"]') as HTMLElement;
  const cortados = [...el.querySelectorAll<HTMLElement>('label, legend, h2, h3, button, dt, dd, span')].filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent ?? '').slice(0, 30));
  return { panel: el.scrollWidth - el.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, cortados };
});

for (const [w, h] of [[1440, 900], [1024, 768]] as const) {
  test(`datos del proyecto en oscuro ${w}: HTML como texto, notas fuera de localStorage, guardar y reabrir`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: w, height: h });
    const dialogos: string[] = [];
    page.on('dialog', (d) => { dialogos.push(d.message()); void d.dismiss(); });
    await page.addInitScript(() => { delete (window as any).showSaveFilePicker; }); // sin File System Access: guardar baja un archivo
    const errs = await abrir(page);
    await page.evaluate(() => localStorage.removeItem('kura3d-recent-info'));
    await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
    const section = await panelProyecto(page);
    await section.getByLabel('Descripción').fill(`Desc ${PAYLOAD}`);
    await section.getByLabel('Notas').fill(`NOTA-SECRETA-123\n${PAYLOAD}`);
    await section.getByLabel('Autor').fill(PAYLOAD);
    await expect(page.getByRole('button', { name: /Proyecto.*cambios sin guardar/i }).first()).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(dialogos).toEqual([]);
    expect(await page.locator('img[src="x"]').count(), 'ningún <img> inyectado').toBe(0);
    await expect(section.getByLabel('Notas')).toHaveValue(/<img src=x/);
    const d = await desborde(page);
    console.log('QA25J desborde', w, JSON.stringify(d));
    expect(d.panel).toBeLessThanOrEqual(1);
    expect(d.page).toBeLessThanOrEqual(1);
    expect(d.cortados).toEqual([]);
    await page.screenshot({ path: `${EV}/datos-oscuro-${w}.png` });

    const antesMod = await section.getByTestId('project-info-modified').textContent();
    const dl = page.waitForEvent('download');
    await page.evaluate(() => void (window as any).__s.getState().saveProject(true));
    const archivo = await dl;
    await page.getByRole('button', { name: 'Ya lo guardé' }).click({ timeout: 5000 }).catch(() => undefined);
    await expect(section.getByTestId('project-info-modified')).not.toHaveText(antesMod ?? '');
    const modGuardado = await section.getByTestId('project-info-modified').textContent();
    const ls = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
    console.log('QA25J localStorage claves', await page.evaluate(() => Object.keys(localStorage).join(',')));
    expect(ls).not.toContain('NOTA-SECRETA-123');
    const bytes = (await (await archivo.createReadStream())!.toArray()).map((c) => Array.from(c as Buffer)).flat();
    await page.evaluate(async (data) => { await (window as any).__s.getState().openProject(async () => ({ name: 'Datos.kura', bytes: new Uint8Array(data) })); }, bytes);
    await expect(page.getByText('Este proyecto tiene notas.')).toBeVisible();
    await page.screenshot({ path: `${EV}/datos-aviso-notas-${w}.png` });
    await page.getByRole('button', { name: 'Ver las notas del proyecto' }).click();
    await expect(page.getByLabel('Notas')).toBeFocused();
    await expect(page.getByLabel('Notas')).toHaveValue(/NOTA-SECRETA-123/);
    await expect(page.getByLabel('Descripción')).toHaveValue(/^Desc <img/);
    await expect(page.getByTestId('project-info-modified')).toHaveText(modGuardado ?? '');
    const rec = page.getByRole('group', { name: 'Proyectos recientes' });
    if (await rec.count()) {
      await expect(rec).not.toContainText('NOTA-SECRETA');
      expect(await rec.locator('img[src="x"]').count()).toBe(0);
    } else console.log('QA25J sin lista de recientes visible (escena abierta)');
    expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).not.toContain('NOTA-SECRETA-123');
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(dialogos).toEqual([]);
    expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
  });
}

test('un .kura antiguo abre con «Sin fecha» y alemán no se corta a 1024', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = await abrir(page);
  const ruta = 'G:/proyectos/kura3d/.eval-tmp/qa11/grupos.kura';
  test.skip(!existsSync(ruta), 'sin .kura antiguo');
  const bytes = Array.from(readFileSync(ruta));
  const ok = await page.evaluate(async (data) => (window as any).__s.getState().openProject(async () => ({ name: 'grupos.kura', bytes: new Uint8Array(data) })), bytes);
  expect(ok).toBe(true);
  const section = await panelProyecto(page);
  console.log('QA25J antiguo', await section.getByTestId('project-info-created').textContent(), '|', await section.getByTestId('project-info-modified').textContent());
  await expect(section.getByTestId('project-info-created')).toHaveText('Sin fecha');
  await page.evaluate(() => (window as any).__s.getState().setLanguage('de'));
  const d = await desborde(page);
  console.log('QA25J de', JSON.stringify(d));
  expect(d.panel).toBeLessThanOrEqual(1);
  expect(d.cortados).toEqual([]);
  expect(await section.innerText()).not.toMatch(/\b(projectInfo|panel)\.[a-zA-Z]+/);
  await page.screenshot({ path: `${EV}/datos-de-1024.png` });
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});
