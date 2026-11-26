/**
 * @file e2e/ux4-rotulos.spec.ts
 * @description Rótulos de pieza de Dividir (códigos sobre cada pieza en el plan y en el resultado, casilla
 * recordada, mismos códigos que el árbol de Escena) y rótulo "Placa 1" completo dentro del visor tras
 * "Preparar para imprimir" en 1440, 1024 y 390 px.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, crear, dividirCubo, encuadrar, SHOTS } from './ux4-helpers';

const rotulosVisibles = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.kura-split-label-layer .kura-split-piece-tag')]
      .filter((e) => e.style.display !== 'none')
      .map((e) => e.textContent!.replace(/\s*↻.*$/, '').trim()),
  );

const tema = (page: Page, esquema: 'light' | 'dark') =>
  page.evaluate((c) => (window as any).__s.getState().setColorScheme(c), esquema);

test('rótulos de pieza en el plan y en el resultado, con los códigos del árbol, y casilla recordada', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page, 1440, 900);
  await crear(page, 'box', { width: 440, height: 440, depth: 440 }, [0, 220, 0]);
  await encuadrar(page);
  await page.getByRole('button', { name: 'Dividir para imprimir' }).first().click();

  // Plan previo: códigos flotando sobre cada caja prevista.
  await expect.poll(() => rotulosVisibles(page), { timeout: 60_000 }).not.toEqual([]);
  await page.screenshot({ path: `${SHOTS}/1-plan-oscuro.png` });
  await tema(page, 'light');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/1-plan-claro.png` });

  await page.getByRole('button', { name: 'Dividir', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).length), { timeout: 120_000 }).toBeGreaterThan(1);

  const codigos: string[] = await page.evaluate(() =>
    (window as any).__s.getState().objects.filter((o: any) => o.metadata?.split).map((o: any) => o.metadata.split.code),
  );
  expect(codigos.length).toBeGreaterThan(1);
  await expect.poll(async () => (await rotulosVisibles(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
  const vistos = await rotulosVisibles(page);
  for (const c of vistos) expect(codigos).toContain(c);
  // Mismo texto que el árbol de Escena (nombres de pieza con su código).
  const arbol = await page.locator('.kura-sidebar-left').first().innerText();
  for (const c of vistos) expect(arbol).toContain(c);
  await page.screenshot({ path: `${SHOTS}/1-resultado-claro.png` });
  await tema(page, 'dark');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/1-resultado-oscuro.png` });

  // Los rótulos tienen tamaño acotado y no se solapan entre sí.
  const cajas = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.kura-split-label-layer .kura-split-piece-tag')]
      .filter((e) => e.style.display !== 'none')
      .map((e) => e.getBoundingClientRect())
      .map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width })),
  );
  for (const c of cajas) expect(c.w).toBeLessThanOrEqual(121);
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      expect(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b).toBe(false);
    }

  // Casilla: se apaga, se recuerda tras recargar.
  const casilla = page.getByRole('checkbox', { name: 'Mostrar rótulos de pieza' }).first();
  await expect(casilla).toBeChecked();
  await casilla.uncheck();
  await expect.poll(() => rotulosVisibles(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('kura3d-split-labels'))).toBe('0');
  await page.reload();
  await page.locator('.kura-app').waitFor();
  expect(await page.evaluate(() => localStorage.getItem('kura3d-split-labels'))).toBe('0');
  expect(errs).toEqual([]);
});

for (const [ancho, alto] of [[1440, 900], [1024, 768]] as const) {
  test(`«Placa 1» completa en el visor tras Preparar para imprimir (${ancho} px)`, async ({ page }) => {
    test.setTimeout(240_000);
    const errs = await abrir(page, ancho, alto);
    await dividirCubo(page);
    await page.evaluate(() => {
      const s = (window as any).__s.getState();
      const id = s.objects.find((o: any) => o.metadata?.split)?.id;
      s.selectObject?.(id);
      s.arrangeSplitGroup(id, 'print');
    });
    await page.waitForTimeout(1500);
    const placa = page.locator('.kura-split-label-layer .kura-split-plate-tag', { hasText: 'Placa 1' }).first();
    await expect(placa).toBeVisible();
    const lienzo = await page.locator('.kura-split-label-layer').boundingBox();
    const caja = await placa.boundingBox();
    expect(lienzo && caja).toBeTruthy();
    expect(caja!.x).toBeGreaterThanOrEqual(lienzo!.x - 0.5);
    expect(caja!.y).toBeGreaterThanOrEqual(lienzo!.y - 0.5);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(lienzo!.x + lienzo!.width + 0.5);
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(lienzo!.y + lienzo!.height + 0.5);
    await page.screenshot({ path: `${SHOTS}/2-placa-${ancho}.png` });
    expect(errs).toEqual([]);
  });
}
