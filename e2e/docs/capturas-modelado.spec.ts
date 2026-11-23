/**
 * @file e2e/docs/capturas-modelado.spec.ts
 * @description Capturas de las guías Medir, Exportar, Cortar y ahuecar, Sólidos negativos y restas, Grupos
 * y Colores y pintura. Escenas hechas con primitivas de la app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, cajaMundo, captura, clicMundo, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

const DER = { x: 1144, y: 52, width: 296, height: 820 };

test('medir', async ({ page }) => {
  await abrir(page);
  const caja = await cmd(page, 'create_primitive', { type: 'box', width: 60, height: 40, depth: 30, name: 'Caja', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [caja.id]);
  await page.getByRole('button', { name: /^Medir/ }).first().click();
  await page.waitForTimeout(500);
  await captura(page, 'medir-01-herramienta');
  const b = await cajaMundo(page, caja.id);
  // Dos esquinas de la cara frontal derecha (visibles: el panel Medir tapa el lado izquierdo del visor).
  await clicMundo(page, [b.max[0], b.max[1], b.max[2]]);
  await clicMundo(page, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.max[2]]);
  await page.waitForTimeout(500);
  await captura(page, 'medir-02-distancia');
  // Capacidad de un recipiente: vaso (cilindro menos un cilindro negativo).
  await page.evaluate(() => (window as any).__s.setState({ objects: [], selectedIds: [] }));
  await page.keyboard.press('v');
  const vaso = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 20, height: 50, segments: 96, name: 'Vaso', position: [0, 0, 0] });
  await cmd(page, 'create_primitive', { type: 'cylinder', radius: 18, height: 48, segments: 96, isHole: true, position: [0, 0, 2] });
  await page.evaluate(() => (window as any).__s.getState().applyHolesOnSolids());
  await page.waitForTimeout(2000);
  const ids: string[] = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.id));
  await seleccionar(page, [ids[0] ?? vaso.id]);
  await encuadrar(page, 'fit');
  await page.getByRole('button', { name: /^Medir/ }).first().click();
  await page.getByRole('button', { name: 'Capacidad', exact: true }).click();
  const panel = page.getByTestId('measure-capacity');
  await panel.getByRole('button').first().click();
  await expect(panel.getByTestId('capacity-max')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await captura(page, 'medir-03-capacidad');
});

test('exportar', async ({ page }) => {
  await abrir(page);
  const a = await cmd(page, 'create_primitive', { type: 'box', width: 40, height: 30, depth: 30, name: 'Base', position: [-30, 0, 0] });
  await cmd(page, 'create_primitive', { type: 'cylinder', radius: 14, height: 30, name: 'Torre', position: [30, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [a.id]);
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  await page.waitForTimeout(800);
  await captura(page, 'exportar-01-dialogo');
  await page.keyboard.press('Escape');
});

test('cortar-y-ahuecar', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 30, height: 80, segments: 64, name: 'Jarrón', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [pieza.id]);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Corte por plano + uniones' }).click();
  await page.waitForTimeout(1200);
  await captura(page, 'cortar-y-ahuecar-01-corte');
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').nth(1).selectOption({ label: 'Sin conectores (corte limpio)' }).catch(() => undefined);
  await dlg.getByRole('button', { name: /Ejecutar Corte/ }).click();
  await page.waitForFunction(() => (window as any).__s.getState().objects.length === 2, null, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await encuadrar(page, 'scene');
  await captura(page, 'cortar-y-ahuecar-02-mitades');
  // Ahuecar: solo el panel de la herramienta, antes de aplicarla.
  await page.evaluate(() => (window as any).__s.setState({ objects: [], selectedIds: [] }));
  const caja = await cmd(page, 'create_primitive', { type: 'box', width: 50, height: 50, depth: 50, name: 'Cubo', position: [0, 0, 0] });
  await seleccionar(page, [caja.id]);
  await encuadrar(page, 'fit');
  const ahuecar = page.locator('.kura-form-field', { has: page.locator('label', { hasText: /^Ahuecar$/ }) }).first();
  await ahuecar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await captura(page, 'cortar-y-ahuecar-03-ahuecar', ahuecar);
  expect(DER.x).toBeGreaterThan(0);
});

test('solidos-negativos-y-restas', async ({ page }) => {
  await abrir(page);
  const base = await cmd(page, 'create_primitive', { type: 'box', width: 60, height: 30, depth: 60, name: 'Base', position: [0, 0, 0] });
  const agujero = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 8, height: 50, name: 'Agujero', isHole: true, position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [agujero.id]);
  await page.waitForTimeout(800);
  await captura(page, 'solidos-negativos-y-restas-01-negativo');
  await page.getByRole('button', { name: /Aplicar \d* ?restas?/ }).first().click();
  await page.waitForTimeout(2500);
  await encuadrar(page, 'scene');
  await sinAvisos(page);
  await captura(page, 'solidos-negativos-y-restas-02-resultado');
  expect(base.id).toBeTruthy();
});

test('grupos-y-escena', async ({ page }) => {
  await abrir(page);
  const a = await cmd(page, 'create_primitive', { type: 'box', width: 30, height: 20, depth: 20, name: 'Cuerpo', position: [0, 0, 0] });
  const b = await cmd(page, 'create_primitive', { type: 'cylinder', radius: 8, height: 25, name: 'Chimenea', position: [30, 0, 0] });
  const c = await cmd(page, 'create_primitive', { type: 'sphere', radius: 10, name: 'Cúpula', position: [-30, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [a.id, b.id, c.id]);
  await page.keyboard.press('Control+g');
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /Escena/ }).click();
  await page.waitForTimeout(600);
  await captura(page, 'grupos-y-escena-01-arbol');
});

test('colores-y-pintura', async ({ page }) => {
  await abrir(page);
  const caja = await cmd(page, 'create_primitive', { type: 'sphere', radius: 25, name: 'Bola', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [caja.id]);
  // Dos colores por caras (mitad superior naranja, inferior verde), como dejaría el pincel.
  await page.evaluate(() => {
    const s = (window as any).__s;
    const st = s.getState();
    const o = st.objects[0];
    const p = o.mesh.positions;
    const ix = o.mesh.indices;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
    const mid = (lo + hi) / 2;
    const fc: string[] = [];
    for (let t = 0; t < ix.length / 3; t++) {
      const cy = (p[3 * ix[3 * t] + 1] + p[3 * ix[3 * t + 1] + 1] + p[3 * ix[3 * t + 2] + 1]) / 3;
      fc.push(cy > mid ? '#f97316' : '#22c55e');
    }
    s.setState({ objects: st.objects.map((x: any, i: number) => (i === 0 ? { ...x, mesh: { ...x.mesh, faceColors: fc } } : x)) });
  });
  await page.keyboard.press('p');
  await page.waitForTimeout(800);
  await captura(page, 'colores-y-pintura-01-pincel');
  await page.keyboard.press('v');
  await page.waitForTimeout(500);
  const sep = page.getByRole('button', { name: 'Separar por colores' });
  await sep.scrollIntoViewIfNeeded();
  await captura(page, 'colores-y-pintura-02-separar', DER);
  await sep.click();
  await page.waitForFunction(() => (window as any).__s.getState().objects.length === 2, null, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  await encuadrar(page, 'scene');
  await page.getByRole('tab', { name: /Escena/ }).click();
  await captura(page, 'colores-y-pintura-03-resultado');
});
