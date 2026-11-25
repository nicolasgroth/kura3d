/**
 * @file e2e/qa25f-simplificar-seguro.spec.ts
 * @description Regla de resultado destructivo de Simplificar: placa con 3 agujeros pasantes (bloqueo, motivos, dos
 * botones, un paso de deshacer cada uno) y tabla de casos (esfera, cilindro, ocarina real al 50/25/10 %) con los
 * números que devuelve el informe: triángulos, % de volumen, desviación, motivos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { itemAccion } from './acciones-helpers';
import { abrir, cmd, libre, pasos, seleccionar } from './qa25a-helpers';

const EV = 'G:/proyectos/kura3d/.eval-tmp/qa25f';
const REAL = 'G:/proyectos/kura3d/.eval-tmp/modelos/obj_1_OcarinaDeluxe.stl';
const tris = (page: Page, id: string) =>
  page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).stats.triangles as number, id);

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

async function abrirPanel(page: Page) {
  await (await itemAccion(page, 'Simplificar…')).click();
  await expect(page.locator('.kura-simplify-section')).toBeVisible();
}

test('placa con 3 agujeros por cantidad muy baja: bloquea, motivos, versión segura y «de todos modos»', async ({ page }) => {
  test.setTimeout(180_000);
  const errs = await abrir(page);
  const id = await placaConAgujeros(page);
  await seleccionar(page, [id]);
  const t0 = await tris(page, id);
  console.log('QA25F placa triángulos', t0);
  await abrirPanel(page);
  const sec = page.locator('.kura-simplify-section');
  await sec.locator('select').first().selectOption('target');
  await sec.getByRole('combobox', { name: 'Objetivo' }).selectOption({ label: 'Triángulos' });
  const campo = sec.getByRole('spinbutton', { name: /Triángulos finales/ });
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('12');
  const p0 = await pasos(page);
  await page.keyboard.press('Enter');
  await libre(page);
  const bloque = page.getByTestId('simplify-blocked');
  await expect(bloque).toBeVisible({ timeout: 60_000 });
  expect(await pasos(page)).toBe(p0);
  expect(await tris(page, id)).toBe(t0);
  console.log('QA25F bloqueo:', (await bloque.innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${EV}/placa-bloqueada.png` });
  const seguro = page.getByTestId('simplify-apply-safe');
  await expect(page.getByTestId('simplify-apply-anyway')).toBeVisible();
  if (await seguro.count()) {
    await seguro.click();
    await libre(page);
    const t1 = await tris(page, id);
    console.log('QA25F segura', t0, '->', t1);
    expect(t1).toBeLessThanOrEqual(t0);
    expect(await pasos(page)).toBe(p0 + 1);
    await page.keyboard.press('Control+z');
    expect(await tris(page, id)).toBe(t0);
    expect(await pasos(page)).toBe(p0);
  } else {
    console.log('QA25F sin versión segura (placa ya mínima)');
  }
  // Volver a pedirlo y forzar.
  await campo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  await libre(page);
  await expect(page.getByTestId('simplify-apply-anyway')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('simplify-apply-anyway').click();
  await libre(page);
  const t2 = await tris(page, id);
  console.log('QA25F de todos modos', t0, '->', t2);
  expect(t2).toBeLessThan(t0);
  expect(await pasos(page)).toBe(p0 + 1);
  expect(errs, errs.join('\n')).toEqual([]);
});

async function caso(page: Page, id: string, nombre: string, params: Record<string, unknown>) {
  const t0 = await tris(page, id);
  const p0 = await pasos(page);
  const r = await cmd(page, 'simplify_mesh', { id, ...params });
  await libre(page);
  const fila = {
    caso: nombre, antes: t0, despues: r.trianglesAfter, aplicado: r.applied, vol: r.volumeChangePct, dev: r.maxDeviationMm,
    motivos: r.destructive, segura: r.safe ? `${r.safe.triangles} tris ${r.safe.volumeChangePct}% ${r.safe.maxDeviationMm}mm` : r.safe,
  };
  console.log('QA25F FILA', JSON.stringify(fila));
  if ((await pasos(page)) > p0) await page.evaluate(() => (window as any).__s.getState().undo());
  return fila;
}

test('tabla: esfera y cilindro al 50 %', async ({ page }) => {
  test.setTimeout(180_000);
  await abrir(page);
  for (const [nombre, prim] of [
    ['esfera r25 (por defecto)', { type: 'sphere', radius: 25 }],
    ['cilindro r20 h40', { type: 'cylinder', radius: 20, height: 40 }],
    ['cubo 30', { type: 'box', width: 30, depth: 30, height: 30 }],
  ] as const) {
    const o = await cmd(page, 'create_primitive', { ...prim, name: nombre });
    for (const pct of [50, 25]) await caso(page, o.id, `${nombre} ${pct}%`, { mode: 'target', targetPercent: pct });
    await page.evaluate((i) => (window as any).__s.getState().deleteObjects?.([i]), o.id);
  }
});

test('tabla: ocarina real al 50, 25 y 10 %', async ({ page }) => {
  test.skip(!existsSync(REAL), 'sin modelo');
  test.setTimeout(600_000);
  await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles(REAL);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 120_000 }).toBeGreaterThan(0);
  await libre(page);
  const id = await page.evaluate(() => (window as any).__s.getState().objects[0].id as string);
  for (const pct of [50, 25, 10]) await caso(page, id, `ocarina ${pct}%`, { mode: 'target', targetPercent: pct });
});

const bbox = (page: Page, id: string) =>
  page.evaluate((i) => {
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === i);
    return { stats: o.stats, pos: o.position, rot: o.rotation, box: o.stats.boundingBox ?? null };
  }, id);

test('suavizar bloqueado en esfera gruesa; ojo de cerradura en cubo de 10 mm; orientar cubo girado', async ({ page }) => {
  test.setTimeout(180_000);
  const errs = await abrir(page);
  const e = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, segments: 8, name: 'Gruesa' });
  const p0 = await pasos(page);
  console.log('QA25F gruesa tris', await tris(page, e.id));
  const r1 = await cmd(page, 'smooth_mesh', { id: e.id, strength: 1, iterations: 10, preserveSharpEdges: false });
  console.log('QA25F smooth', JSON.stringify(r1));
  expect(r1.applied).toBe(false);
  expect(r1.blockedBy).toBe('volume_changed');
  expect(await pasos(page)).toBe(p0);
  const r2 = await cmd(page, 'smooth_mesh', { id: e.id, strength: 1, iterations: 10, preserveSharpEdges: false, allowVolumeChange: true });
  console.log('QA25F smooth forzado', JSON.stringify(r2));
  expect(r2.applied).toBe(true);
  expect(await pasos(page)).toBe(p0 + 1);

  const cubo = await cmd(page, 'create_primitive', { type: 'box', width: 10, depth: 10, height: 10, name: 'Cubo10', position: [100, 0, 0] });
  let msg = 'sin error';
  const res = await page.evaluate(
    async (id) => (window as any).__s.getState().executeCommand({ id: 'k', command: 'add_keyhole', params: { hostId: id, face: 'back' } }),
    cubo.id,
  );
  msg = JSON.stringify(res).slice(0, 500);
  console.log('QA25F ojo en cubo 10', msg);
  expect(res.ok).toBe(false);
  expect(res.errorCode).toBe('addon-blocked');

  const g = await cmd(page, 'create_primitive', { type: 'box', width: 10, depth: 10, height: 10, name: 'Girado', position: [-100, 0, 0], rotation: [0.4, 0.3, 0.5] });
  const an = await cmd(page, 'orient_for_print', { id: g.id });
  const cand = an.recommended ?? an.candidates[0];
  console.log('QA25F orientar candidatos', an.candidates.length, 'recomendada', JSON.stringify(an.recommended?.id ?? null), 'actual?', Object.keys(an).join(','));
  const ap = await cmd(page, 'apply_orientation', { id: g.id, candidateId: cand.id });
  console.log('QA25F orientar aplicado', JSON.stringify(ap).slice(0, 400));
  const dim = await page.evaluate((i) => {
    const o = (window as any).__s.getState().objects.find((x: any) => x.id === i);
    return { size: o.stats.dimensionsMm as number[], rot: o.rotation };
  }, g.id);
  console.log('QA25F cubo tras orientar', JSON.stringify(dim));
  for (const d of dim.size) expect(d).toBeCloseTo(10, 1);
  expect(errs, errs.join('\n')).toEqual([]);
});
