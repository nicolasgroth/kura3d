/**
 * @file e2e/reales-ui-malla.spec.ts
 * @description Inspector con una malla abierta (STL sintético: cubo sin tapa) y pie de página con
 * piezas ocultas. El estado dice "Malla: Abierta: N bordes libres" con "Reparar malla" y "Ver bordes"
 * persistentes (teclado, aria-pressed); al reparar pasa a "Cerrada". El pie cuenta visibles y total.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-malla`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, importarStl, stlCubes } from './ux-escena-helpers';

const SHOTS = 'G:/proyectos/kura3d/.eval-tmp/reales-ui';

/** Cubo de 30 mm sin la cara superior: 4 bordes libres. */
function cuboAbierto(): string {
  const v = (x: number, y: number, z: number) => `vertex ${x} ${y} ${z}`;
  const lines = ['solid abierto'];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    for (const tri of [[a, b, c], [a, c, d]]) lines.push('facet normal 0 0 0', 'outer loop', ...tri.map((p) => v(p[0], p[1], p[2])), 'endloop', 'endfacet');
  };
  const s = 30;
  quad([0, 0, 0], [s, 0, 0], [s, 0, s], [0, 0, s]);
  quad([0, 0, 0], [0, 0, s], [0, s, s], [0, s, 0]);
  quad([s, 0, 0], [s, s, 0], [s, s, s], [s, 0, s]);
  quad([0, 0, 0], [0, s, 0], [s, s, 0], [s, 0, 0]);
  quad([0, 0, s], [s, 0, s], [s, s, s], [0, s, s]);
  lines.push('endsolid abierto');
  return lines.join('\n');
}

for (const scheme of ['light', 'dark'] as const) {
  test(`malla abierta: rótulo neutro, Reparar y Ver bordes persistentes (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await abrir(page);
    await importarStl(page, 'abierto.stl', cuboAbierto());
    await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(1);
    await page.evaluate(() => {
      const s = (window as any).__s.getState();
      s.selectObject(s.objects[0].id);
    });
    const status = page.getByTestId('mesh-status');
    await expect(status).toContainText('Malla');
    await expect(status).not.toContainText('Malla cerrada');
    await expect(status).toContainText(/Abierta: 4 bordes libres/, { timeout: 30000 });
    // Sigue ahí pasados los segundos en que antes desaparecía el aviso.
    await page.waitForTimeout(6000);
    const edges = status.getByRole('button', { name: 'Ver bordes' });
    await expect(edges).toHaveAttribute('aria-pressed', 'false');
    await expect(edges).toHaveAttribute('title', /bordes libres/);
    await edges.focus();
    await page.keyboard.press('Enter');
    await expect(status.getByRole('button', { name: 'Ocultar bordes' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__s.getState().meshDiagnosis?.highlight)).not.toBe(false);
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/malla-abierta-${scheme}.png` });
    await status.getByRole('button', { name: 'Reparar malla' }).click();
    await expect(status).toContainText('Cerrada', { timeout: 30000 });
    await expect(status.getByRole('button', { name: 'Reparar malla' })).toHaveCount(0);
  });
}

test('pie de página: con una pieza oculta cuenta visibles y total', async ({ page }) => {
  await abrir(page);
  await importarStl(page, 'dos.stl', stlCubes([[0, 20, 0]], 40));
  // Una importación nueva se rechaza mientras otra sigue en curso: esperar a que la primera termine.
  await expect.poll(() => page.evaluate(() => { const st = (window as any).__s.getState(); return st.objects.length === 1 && !st.busyOperation; }), { timeout: 30000 }).toBe(true);
  await importarStl(page, 'otro.stl', stlCubes([[0, 20, 0]], 40));
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(2);
  const count = page.getByTestId('status-count');
  await expect(count).toHaveText('2 objs · 24 tris');
  await page.evaluate(() => {
    const s = (window as any).__s;
    const id = s.getState().objects[1].id;
    s.setState((st: any) => ({ objects: st.objects.map((o: any) => (o.id === id ? { ...o, visible: false } : o)) }));
  });
  await expect(count).toHaveText('1 de 2 objs · 12 de 24 tris');
  await expect(count).toHaveAttribute('title', /Visibles: 1 de 2 objetos/);
});
