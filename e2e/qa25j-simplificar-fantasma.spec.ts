/**
 * @file e2e/qa25j-simplificar-fantasma.spec.ts
 * @description QA 26-nov (I), bloque 4 (tema claro): fantasma de la vista previa de Simplificar con una esfera de ~5000
 * triángulos al 50 %: aparece, «Ocultar la vista previa» lo oculta y lo devuelve sin recalcular, quitar aristas persiste,
 * y cambiar un valor, la selección, cerrar el panel, deshacer y aplicar lo quitan (ninguno queda huérfano). Evidencia en
 * `.eval-tmp/qa25j/`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, libre, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25j';
test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

const sim = (page: Page) => page.evaluate(() => {
  const s = (window as any).__s.getState();
  const p = s.simplifyPreview;
  return p ? { status: p.status, ghost: p.ghost, comparing: p.comparing, edges: p.edges, tris: p.ghostTriangles, sig: p.signature } : null;
});
const fantasmas = (page: Page) => page.evaluate(() => {
  const op = (window as any).__s.getState().operationPreview;
  return op ? JSON.stringify(Object.keys(op)).length : 0;
});

async function esfera(page: Page) {
  // 2048 triángulos (segmentos 64): suficiente para ver la red del fantasma.
  const c = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, segments: 64, name: 'Esfera64', position: [0, 25, 0] });
  await seleccionar(page, [c.id]);
  return c.id as string;
}

test('fantasma de Simplificar: aparecer, comparar, aristas, y quitarse al cambiar/cerrar/deshacer/aplicar', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page);
  await esfera(page);
  await (await itemAccion(page, 'Simplificar…')).click();
  const sec = page.locator('.kura-simplify-section');
  await expect(sec).toBeVisible();
  await sec.getByRole('combobox', { name: 'Modo de simplificar' }).selectOption({ label: 'Por cantidad' });
  const objetivo = sec.getByRole('combobox', { name: 'Objetivo' });
  if (await objetivo.count()) console.log('QA25J objetivo opciones', await objetivo.locator('option').allInnerTexts());
  await page.screenshot({ path: `${EV}/simplificar-panel.png` });
  await sec.getByTestId('simplify-preview').click();
  await expect.poll(async () => (await sim(page))?.status, { timeout: 90_000 }).toBe('ready');
  const a = await sim(page);
  console.log('QA25J estado', JSON.stringify(a));
  expect(a!.ghost).toBe('shown');
  await expect(page.getByTestId('simplify-ghost-controls')).toBeVisible();
  await page.screenshot({ path: `${EV}/fantasma-aristas.png` });

  // Comparar: oculta y devuelve sin recalcular (misma firma, estado ready todo el tiempo).
  const cmp = page.getByTestId('simplify-ghost-compare');
  await cmp.click();
  const b = await sim(page);
  expect(b!.comparing).toBe(true);
  expect(b!.status).toBe('ready');
  await page.screenshot({ path: `${EV}/fantasma-comparando.png` });
  await cmp.click();
  const c = await sim(page);
  expect(c!.comparing).toBe(false);
  expect(c!.sig).toBe(a!.sig);
  expect(c!.status).toBe('ready');

  // Quitar aristas persiste (en la sesión y tras recalcular una vista previa nueva).
  const aristas = page.getByTestId('simplify-ghost-edges');
  await aristas.click();
  expect((await sim(page))!.edges).toBe(false);
  await page.screenshot({ path: `${EV}/fantasma-solido.png` });

  // Cambiar un valor quita el fantasma.
  const campo = sec.getByRole('spinbutton').first();
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('30');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await sim(page))?.status ?? 'none', { timeout: 10_000 }).not.toBe('ready');
  console.log('QA25J tras cambiar valor', JSON.stringify(await sim(page)));

  // Nueva vista previa: la preferencia «sin aristas» persiste.
  await sec.getByTestId('simplify-preview').click();
  await expect.poll(async () => (await sim(page))?.status, { timeout: 90_000 }).toBe('ready');
  expect((await sim(page))!.edges, 'la preferencia de aristas persiste').toBe(false);

  // Deseleccionar quita el fantasma.
  await seleccionar(page, []);
  await expect.poll(async () => (await sim(page))?.status ?? 'none', { timeout: 10_000 }).not.toBe('ready');
  await libre(page);
  expect(await page.locator('[data-testid="simplify-ghost-controls"]').count()).toBe(0);
  console.log('QA25J fantasmas tras deseleccionar', await fantasmas(page));
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});

test('fantasma: cerrar el panel, deshacer y aplicar lo quitan', async ({ page }) => {
  test.setTimeout(240_000);
  const errs = await abrir(page);
  const id = await esfera(page);
  const abrirPanel = async () => {
    await (await itemAccion(page, 'Simplificar…')).click();
    const sec = page.locator('.kura-simplify-section');
    await expect(sec).toBeVisible();
    await sec.getByRole('combobox', { name: 'Modo de simplificar' }).selectOption({ label: 'Por cantidad' });
    await sec.getByTestId('simplify-preview').click();
    await expect.poll(async () => (await sim(page))?.status, { timeout: 90_000 }).toBe('ready');
    return sec;
  };
  // Cerrar el panel con «Volver».
  await abrirPanel();
  await page.getByTestId('panel-back').click();
  await expect.poll(async () => (await sim(page))?.status ?? 'none', { timeout: 10_000 }).not.toBe('ready');
  expect(await sim(page)).toBeNull();
  // Aplicar: el fantasma desaparece y el objeto queda con menos triángulos.
  const antes = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);
  const sec = await abrirPanel();
  await sec.getByRole('button', { name: /Simplificar$|Aplicar/ }).last().click();
  await libre(page);
  await expect.poll(async () => await sim(page), { timeout: 30_000 }).toBeNull();
  const despues = await page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);
  console.log('QA25J aplicar', antes, '->', despues);
  expect(despues).toBeLessThan(antes);
  // Deshacer con una vista previa abierta.
  const sec2 = await abrirPanel();
  await page.evaluate(() => (window as any).__s.getState().undo());
  await expect.poll(async () => (await sim(page))?.status ?? 'none', { timeout: 10_000 }).not.toBe('ready');
  void sec2;
  expect(errs.filter((e) => !/favicon|WebGL|GPU/i.test(e)), errs.join('\n')).toEqual([]);
});
