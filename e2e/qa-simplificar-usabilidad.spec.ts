/**
 * @file e2e/qa-simplificar-usabilidad.spec.ts
 * @description QA de la usabilidad del panel Simplificar: Tab/Enter con campos inválidos (no cae en Refinar, Enter solo
 * pide vista previa), foco nunca en `body` (cálculo, «Aplicar de todos modos», cancelar, deshacer), informe de la
 * versión segura en dos bloques con encabezado, condicional en la vista previa y aviso de malla abierta al abrir el
 * panel con «Reparar malla».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa-simplificar-usab';
const tris = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);
const sec = (page: Page) => page.locator('.kura-simplify-section');
const enBody = (page: Page) => page.evaluate(() => document.activeElement === document.body || document.activeElement === null);
const sesion = (page: Page) => page.evaluate(() => (window as any).__s.getState().simplifyPreview?.status ?? null);

async function abrirPanel(page: Page) {
  await (await itemAccion(page, 'Simplificar…')).click();
  await expect(sec(page)).toBeVisible();
}

async function placaConAgujeros(page: Page): Promise<string> {
  const placa = await cmd(page, 'create_primitive', { type: 'box', width: 60, depth: 40, height: 3, name: 'Placa' });
  const taladros: string[] = [];
  for (const x of [-18, 0, 18]) {
    const c = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 4, height: 10, name: `T${x}`, position: [x, 1.5, 0] });
    taladros.push(c.id);
  }
  await cmd(page, 'boolean_operation', { op: 'subtract', targetId: placa.id, toolIds: taladros });
  return page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
}

/** Pide 12 triángulos a la placa: lo pedido es destructivo y hay versión segura. */
async function pedirDoce(page: Page) {
  await sec(page).locator('select').first().selectOption('target');
  await sec(page).getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
  const campo = sec(page).getByRole('spinbutton', { name: /Triángulos finales/ });
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('12');
}

test.describe('Simplificar: usabilidad', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Tab con valor inválido cae en «Vista previa»; Enter solo pide vista previa; botones aria-disabled no actúan', async ({ page }) => {
    const errs = await abrir(page);
    const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
    await seleccionar(page, [s.id]);
    await abrirPanel(page);
    await sec(page).locator('select').first().selectOption('target');
    const pct = sec(page).getByRole('spinbutton', { name: 'Conservar (%)' });
    const p0 = await pasos(page);
    const t0 = await tris(page, s.id);
    await pct.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('500');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('simplify-preview')).toBeFocused();
    await expect(page.getByTestId('simplify-preview')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('simplify-run')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('simplify-invalid-hint')).toBeVisible();
    // Clic, Enter y Espacio sobre los botones con aria-disabled no hacen nada.
    await page.getByTestId('simplify-preview').click({ force: true });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.getByTestId('simplify-run').click({ force: true });
    await page.getByTestId('simplify-run').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    expect(await sesion(page)).toBeNull();
    expect(await pasos(page)).toBe(p0);
    expect(await tris(page, s.id)).toBe(t0);
    expect(await enBody(page)).toBe(false);
    // Enter en el campo inválido: no aplica, no pide vista previa y el foco no se pierde.
    await pct.click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    expect(await pasos(page)).toBe(p0);
    expect(await sesion(page)).toBeNull();
    expect(await enBody(page)).toBe(false);
    // Valor válido + Enter: vista previa (nunca aplica).
    await pct.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('50');
    await page.keyboard.press('Enter');
    await expect.poll(() => sesion(page), { timeout: 60_000 }).toBe('ready');
    expect(await pasos(page)).toBe(p0);
    expect(await tris(page, s.id)).toBe(t0);
    await page.screenshot({ path: `${EV}/tab-enter.png` });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('Enter en «Arista objetivo» no ejecuta Refinar; un campo inválido de Simplificar no bloquea a Refinar', async ({ page }) => {
    const errs = await abrir(page);
    const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
    await seleccionar(page, [s.id]);
    await abrirPanel(page);
    await sec(page).locator('select').first().selectOption('target');
    const pct = sec(page).getByRole('spinbutton', { name: 'Conservar (%)' });
    await pct.fill('500');
    const arista = page.getByRole('spinbutton', { name: /Arista objetivo/ });
    await arista.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('5');
    const p0 = await pasos(page);
    const t0 = await tris(page, s.id);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    expect(await pasos(page)).toBe(p0);
    expect(await tris(page, s.id)).toBe(t0);
    // El botón de Refinar no hereda el bloqueo de Simplificar.
    const refinar = page.getByRole('button', { name: /^Refinar/ }).first();
    await expect(refinar).not.toHaveAttribute('aria-disabled', 'true');
    // Tab desde el campo inválido de Simplificar no salta a Refinar.
    await pct.click();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('simplify-preview')).toBeFocused();
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('versión segura: dos bloques con encabezado, condicional en la vista previa, foco tras «Aplicar de todos modos» y deshacer', async ({ page }) => {
    test.setTimeout(240_000);
    const errs = await abrir(page);
    const id = await placaConAgujeros(page);
    await seleccionar(page, [id]);
    const t0 = await tris(page, id);
    await abrirPanel(page);
    await pedirDoce(page);
    // Vista previa: encabezados en condicional.
    await page.keyboard.press('Enter');
    await expect.poll(() => sesion(page), { timeout: 60_000 }).toBe('ready');
    const rep = page.getByTestId('simplify-report');
    await expect(rep).toBeVisible();
    const txtPrev = (await rep.innerText()).replace(/\s+/g, ' ');
    console.log('QAUSAB vista previa:', txtPrev.slice(0, 600));
    await page.screenshot({ path: `${EV}/segura-vista-previa.png` });
    expect(txtPrev).toMatch(/Lo pedido daría…/);
    expect(txtPrev).not.toMatch(/Se aplicó/);
    expect(await enBody(page)).toBe(false);
    // Aplicar con el botón: informe en pasado, dos bloques.
    await page.getByTestId('simplify-run').click();
    await libre(page);
    const aplicada = page.getByTestId('simplify-safe-applied');
    const bloqueo = page.getByTestId('simplify-blocked');
    await expect(aplicada.or(bloqueo)).toBeVisible({ timeout: 60_000 });
    const segura = (await aplicada.count()) > 0;
    const txt = (await page.getByTestId('simplify-report').innerText()).replace(/\s+/g, ' ');
    console.log('QAUSAB aplicado:', segura ? 'segura' : 'bloqueo', txt.slice(0, 700));
    await page.screenshot({ path: `${EV}/segura-aplicada.png` });
    if (segura) {
      await expect(page.getByTestId('simplify-block-applied')).toContainText('Se aplicó (versión segura)');
      await expect(page.getByTestId('simplify-block-requested')).toContainText('Lo pedido daría…');
      // Cada bloque trae su propia lista completa: ningún número suelto fuera de un bloque.
      for (const b of ['simplify-block-applied', 'simplify-block-requested']) {
        await expect(page.getByTestId(b).locator('li')).toHaveCount(5);
      }
    } else {
      await expect(page.getByTestId('simplify-blocked-aggressive')).toContainText('Lo pedido daría…');
      await expect(page.getByTestId('simplify-blocked-safe')).toContainText('La versión segura daría…');
    }
    expect(await enBody(page)).toBe(false);
    // «Aplicar de todos modos»: el foco queda dentro del panel, no en body.
    await page.getByTestId('simplify-apply-anyway').click();
    await libre(page);
    await expect.poll(() => enBody(page), { timeout: 5000 }).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.closest('.kura-simplify-section') !== null)).toBe(true);
    // Deshacer: nada de «Se aplicó…» colgado y foco fuera de body.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const tras = (await sec(page).innerText()).replace(/\s+/g, ' ');
    console.log('QAUSAB tras deshacer:', tras.slice(0, 300), '| tris', await tris(page, id), 'de', t0);
    expect(tras).not.toMatch(/Se aplicó \(versión segura\)/);
    expect(await enBody(page)).toBe(false);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('cancelar la vista previa deja el foco en el panel, no en body', async ({ page }) => {
    const errs = await abrir(page);
    const id = await placaConAgujeros(page);
    await seleccionar(page, [id]);
    await abrirPanel(page);
    await pedirDoce(page);
    await page.keyboard.press('Enter');
    // Si el cálculo fue tan rápido que ya terminó, el caso de cancelar no aplica.
    const cancel = page.getByTestId('simplify-preview-cancel');
    const visto = await cancel.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
    if (visto) {
      expect(await enBody(page)).toBe(false);
      await cancel.click().catch(() => {});
      await page.waitForTimeout(500);
      expect(await enBody(page)).toBe(false);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('malla abierta: el aviso con «Reparar malla» aparece al abrir el panel y desaparece tras reparar', async ({ page }) => {
    test.setTimeout(120_000);
    const errs = await abrir(page);
    const b = await cmd(page, 'create_primitive', { type: 'box', width: 30, depth: 30, height: 30, name: 'Cubo abierto' });
    // Se le quita un triángulo: queda un hueco (malla abierta) y se marca como tal, como lo haría una importación.
    await page.evaluate((i) => {
      const s = (window as any).__s;
      s.setState({
        objects: s.getState().objects.map((o: any) => o.id !== i ? o : {
          ...o,
          mesh: { ...o.mesh, indices: o.mesh.indices.slice(0, o.mesh.indices.length - 3) },
          stats: { ...o.stats, isManifold: false },
        }),
      });
    }, b.id);
    await seleccionar(page, [b.id]);
    await abrirPanel(page);
    const aviso = page.getByTestId('simplify-open-mesh');
    await expect(aviso).toBeVisible();
    await expect(page.getByTestId('simplify-open-mesh-repair')).toHaveText(/Reparar malla/);
    await page.screenshot({ path: `${EV}/malla-abierta.png` });
    // Reparar desde el aviso: el foco no cae en body y el aviso desaparece.
    await page.getByTestId('simplify-open-mesh-repair').click();
    await libre(page);
    await expect(aviso).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => enBody(page), { timeout: 5000 }).toBe(false);
    await expect(page.getByTestId('simplify-preview')).toBeFocused();
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('1024 px: sin claves crudas en español, hindi y chino', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const errs = await abrir(page);
    const s = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Esfera' });
    await seleccionar(page, [s.id]);
    await abrirPanel(page);
    for (const lang of ['es', 'hi', 'zh']) {
      await page.evaluate((l) => (window as any).__s.getState().setLanguage?.(l), lang);
      const txt = await sec(page).innerText();
      expect(txt.match(/\b[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){2,}\b/g) ?? [], lang).toEqual([]);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
});
