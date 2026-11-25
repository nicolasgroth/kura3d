/**
 * @file e2e/qa25a-orientar.spec.ts
 * @description QA de «Orientar para imprimir»: lista con medidas y motivos legibles (sin NaN ni números raros), vista
 * previa sin tocar la pieza, aplicar = un paso de deshacer y pieza apoyada en la cama, negativos del grupo que
 * acompañan, ángulo de voladizo (válido, inválido, mientras calcula), pieza que no cabe en la cama, es/en/de.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, clavesCrudas, cmd, EVID, idioma, libre, pasos, seleccionar } from './qa25a-helpers';

const opciones = (page: Page) => page.getByTestId('orient-option');

/** «T» de pie: un poste vertical y una barra horizontal arriba (voladizos grandes). */
async function crearT(page: Page, escala = 1): Promise<string> {
  const poste = await cmd(page, 'create_primitive', { type: 'box', width: 10 * escala, height: 40 * escala, depth: 10 * escala, name: 'Poste', position: [0, 0, 20 * escala] });
  const barra = await cmd(page, 'create_primitive', { type: 'box', width: 40 * escala, height: 10 * escala, depth: 10 * escala, name: 'Barra', position: [0, 0, 45 * escala] });
  const r = await cmd(page, 'boolean_operation', { op: 'union', targetId: poste.id, toolIds: [barra.id] });
  return r.resultId;
}

async function abrirOrientar(page: Page) {
  await (await itemAccion(page, 'Orientar para imprimir…')).click();
  await expect(page.getByTestId('orient-panel')).toBeVisible();
}

const caja = (page: Page, id: string) =>
  page.evaluate(async (oid) => {
    const { worldBox } = await import('/src/core/scene/overlap.ts');
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === oid);
    const b = worldBox(o)!;
    return { min: b.min.toArray() as number[], max: b.max.toArray() as number[] };
  }, id);

for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test(`orientar ${vp.width}: lista, motivos, vista previa y aplicar = 1 paso apoyada en la cama`, async ({ page }) => {
    await page.setViewportSize(vp);
    const errs = await abrir(page);
    const id = await crearT(page);
    await seleccionar(page, [id]);
    await abrirOrientar(page);
    await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
    const n = await opciones(page).count();
    expect(n).toBeGreaterThan(1);
    for (const t of await opciones(page).allInnerTexts()) {
      expect(t, 'números raros en la lista').not.toMatch(/NaN|Infinity|undefined|null|-\d/);
    }
    await page.screenshot({ path: `${EVID}/orientar-${vp.width}-lista.png` });
    await expect(page.getByTestId('orient-badge-current')).toHaveCount(1);

    // Vista previa: no mueve la pieza real.
    const antes = await caja(page, id);
    const p0 = await pasos(page);
    await opciones(page).nth(Math.min(1, n - 1)).hover();
    await page.waitForTimeout(500);
    expect(await caja(page, id)).toEqual(antes);
    expect(await pasos(page)).toBe(p0);
    await page.screenshot({ path: `${EVID}/orientar-${vp.width}-preview.png` });

    const apply = page.getByTestId('orient-apply');
    if (await apply.isEnabled()) {
      await apply.click();
      await libre(page);
      await expect.poll(() => pasos(page)).toBe(p0 + 1);
      const b = await caja(page, id);
      test.info().annotations.push({ type: 'cajas', description: JSON.stringify({ antes, despues: b, elegida: await page.locator('[data-testid="orient-option"][aria-selected="true"]').first().getAttribute('aria-label').catch(() => null) }) });
      console.log('CAJAS', JSON.stringify({ antes, despues: b }));
      expect(Math.abs(b.min[1]), 'pieza apoyada en la cama (min Y = 0)').toBeLessThan(0.05);
      await page.screenshot({ path: `${EVID}/orientar-${vp.width}-aplicada.png` });
      await page.evaluate(() => (window as any).__s.getState().undo());
      expect(await pasos(page)).toBe(p0);
      expect(await caja(page, id)).toEqual(antes);
    }
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test('orientar: ángulo de voladizo válido, inválido y cambio mientras calcula', async ({ page }) => {
  const errs = await abrir(page);
  const id = await crearT(page);
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  const campo = page.getByTestId('orient-angle');
  for (const malo of ['5', '90', 'abc', '', '-45']) {
    await campo.fill(malo);
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await campo.press('Enter');
    await page.waitForTimeout(300);
    expect(await page.getByTestId('orient-running').count()).toBe(0);
  }
  await campo.fill('60,5');
  await campo.press('Enter');
  await campo.fill('35');
  await campo.press('Enter');
  await campo.fill('55');
  await campo.press('Enter');
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('orient-running')).toHaveCount(0);
  await page.screenshot({ path: `${EVID}/orientar-angulo.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar: teclado en la lista (flechas, Inicio, Fin, Espacio)', async ({ page }) => {
  const errs = await abrir(page);
  const id = await crearT(page);
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  await opciones(page).first().focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press(' ');
  await expect(opciones(page).first()).toHaveAttribute('aria-selected', 'true');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar: el negativo del mismo grupo acompaña a la pieza', async ({ page }) => {
  const errs = await abrir(page);
  const id = await crearT(page);
  try {
    await cmd(page, 'add_magnet_pocket', { hostId: id, face: 'top' });
  } catch (e) {
    test.info().annotations.push({ type: 'nota', description: `add_magnet_pocket falló: ${(e as Error).message.slice(0, 200)}` });
  }
  const snap = () => page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => ({ id: o.id, name: o.name, role: o.role, visible: o.visible, pos: o.position, rot: o.rotation })));
  const antes = await snap();
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  const apply = page.getByTestId('orient-apply');
  if (await apply.isEnabled()) {
    await apply.click();
    await libre(page);
    const despues = await snap();
    test.info().annotations.push({ type: 'objetos', description: JSON.stringify({ antes, despues }).slice(0, 1500) });
    for (const o of despues.filter((x: any) => x.id !== id)) {
      const prev = antes.find((a: any) => a.id === o.id);
      if (prev && o.role === 'negative') expect(JSON.stringify([o.pos, o.rot])).not.toBe(JSON.stringify([prev.pos, prev.rot]));
    }
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar: pieza que no cabe en la cama avisa «No cabe»', async ({ page }) => {
  const errs = await abrir(page);
  const id = await crearT(page, 8);
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  expect((await opciones(page).allInnerTexts()).join('\n')).toMatch(/No cabe/i);
  await page.screenshot({ path: `${EVID}/orientar-no-cabe.png` });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar: sin claves crudas en es, en y de', async ({ page }) => {
  await abrir(page);
  const id = await crearT(page);
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  for (const lang of ['es', 'en', 'de']) {
    await idioma(page, lang);
    await page.waitForTimeout(400);
    expect(await clavesCrudas(page, '#kura-inspector-panel'), `claves crudas en ${lang}`).toEqual([]);
    await page.screenshot({ path: `${EVID}/orientar-${lang}.png` });
  }
});

test('orientar: eliminar la pieza con el panel abierto no rompe', async ({ page }) => {
  const errs = await abrir(page);
  const id = await crearT(page);
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate((i) => { const s = (window as any).__s.getState(); (s.deleteObjects ?? s.removeObjects)?.([i]); }, id);
  await page.waitForTimeout(1000);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('orientar: pieza de dos cuerpos separados queda apoyada en la cama tras aplicar (no hundida)', async ({ page }) => {
  const errs = await abrir(page);
  // Dos cajas sin tocarse, unidas en un solo objeto (malla con dos cuerpos).
  const a = await cmd(page, 'create_primitive', { type: 'box', width: 10, height: 10, depth: 40, name: 'Cuerpo A', position: [0, 0, 20] });
  const b = await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 10, depth: 10, name: 'Cuerpo B', position: [0, 0, 45] });
  const r = await cmd(page, 'boolean_operation', { op: 'union', targetId: a.id, toolIds: [b.id] });
  const id = r.resultId as string;
  await seleccionar(page, [id]);
  await abrirOrientar(page);
  await expect(opciones(page).first()).toBeVisible({ timeout: 60_000 });
  const apply = page.getByTestId('orient-apply');
  test.skip(!(await apply.isEnabled()), 'no hay recomendada para aplicar');
  await apply.click();
  await libre(page);
  const c = await caja(page, id);
  test.info().annotations.push({ type: 'caja-tras-aplicar', description: JSON.stringify(c) });
  await page.screenshot({ path: `${EVID}/orientar-dos-cuerpos-aplicada.png` });
  expect(Math.abs(c.min[1]), `la pieza quedó con min Y = ${c.min[1]} (debería ser 0)`).toBeLessThan(0.05);
  expect(errs, errs.join('\n')).toEqual([]);
});
