/**
 * @file e2e/qa18-ida-vuelta-3mf.spec.ts
 * @description Ida y vuelta 3MF por la interfaz con una escena sintética: dos grupos anidados, un negativo, un
 * objeto oculto y uno bloqueado. Exporta "Escena completa" en 3MF, vacía la cama, reimporta y exige mismos
 * nombres, colores, grupos, banderas y piezas; después importa el mismo archivo sobre la escena ya ocupada y
 * exige que el bloque nuevo no se solape con lo existente. Ejecuta con
 * `KURA_URL=http://127.0.0.1:5236/ npx playwright test e2e/qa18-*.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.KURA_URL ?? 'http://127.0.0.1:5236/';

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__s.getState();
    const gname = new Map<string, any>(s.groups.map((g: any) => [g.id, g]));
    return {
      groups: s.groups.map((g: any) => `${g.name}<${g.parentId ? gname.get(g.parentId)?.name : ''}`),
      objs: s.objects.map((o: any) => {
        const P = o.mesh.positions as Float32Array;
        const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
          const v = P[i + k] * o.scale[k] + o.position[k];
          mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v);
        }
        return { name: o.name, color: o.color, hole: o.role === 'negative', vis: o.visible, lock: o.locked,
          grp: o.groupRef ? gname.get(o.groupRef)?.name : null, min: mn, max: mx, tris: o.mesh.indices.length / 3 };
      }),
    };
  });
}

type Snap = Awaited<ReturnType<typeof snapshot>>;
const sorted = (s: Snap) => s.objs.map((o) => `${o.name}|${o.color}|${o.grp}|${o.hole}|${o.vis}|${o.lock}|${o.tris}`).sort();

test('3MF de escena completa: ida y vuelta conserva piezas, grupos anidados y banderas', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(URL);
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.evaluate(async () => { (window as any).__s = (await import('/src/store/useKuraStore.ts')).useKuraStore; });
  await page.evaluate(async () => {
    const st = () => (window as any).__s.getState();
    const mk = async (t: string, name: string, color: string, pos: number[], extra = {}) =>
      (await st().createPrimitive(t, undefined, { name, color, position: pos, ...extra })).id;
    const a = await mk('box', 'Cubo rojo', '#ff0000', [-60, 0, 0]);
    const b = await mk('sphere', 'Esfera verde', '#00aa00', [-20, 0, 0]);
    const c = await mk('cylinder', 'Cilindro azul', '#0000ff', [20, 0, 0]);
    const d = await mk('box', 'Negativo', '#888888', [20, 5, 0], { role: 'negative' });
    const e = await mk('cone', 'Cono oculto', '#ffaa00', [60, 0, 0]);
    const f = await mk('box', 'Bloqueado', '#aa00aa', [100, 0, 0]);
    const g1 = st().groupObjects([a, b], 'Grupo Externo');
    const g2 = st().groupObjects([c, d], 'Grupo Interno');
    (window as any).__s.setState((s: any) => ({ groups: s.groups.map((g: any) => (g.id === g2.id ? { ...g, parentId: g1.id } : g)) }));
    st().updateObjectMeta(e, { visible: false });
    st().updateObjectMeta(f, { locked: true });
  });
  const antes = await snapshot(page);
  expect(antes.objs).toHaveLength(6);

  const file = join(mkdtempSync(join(tmpdir(), 'qa18-')), 'escena.3mf');
  await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: /^3MF/ }).check();
  await dlg.getByRole('radio', { name: /Escena completa/ }).check();
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: /^Exportar / }).click();
  await (await dl).saveAs(file);

  await page.getByRole('button', { name: 'Vaciar cama' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vaciar cama' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(0);

  const importar = async () => {
    const ch = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
    (await ch).setFiles(file);
  };
  const cuenta = () => page.evaluate(() => (window as any).__s.getState().objects.length);
  await importar();
  await expect.poll(cuenta, { timeout: 30000 }).toBe(6);
  await page.waitForTimeout(1500);
  const despues = await snapshot(page);
  expect(sorted(despues)).toEqual(sorted(antes));
  expect([...despues.groups].sort()).toEqual([...antes.groups].sort());

  // Importar sobre escena ocupada: el bloque va a un hueco libre (cajas X/Z sin solape con lo existente).
  await importar();
  await expect.poll(cuenta, { timeout: 30000 }).toBe(12);
  await page.waitForTimeout(1500);
  const total = await snapshot(page);
  const box = (os: Snap['objs']) => ({
    x0: Math.min(...os.map((o) => o.min[0])), x1: Math.max(...os.map((o) => o.max[0])),
    z0: Math.min(...os.map((o) => o.min[2])), z1: Math.max(...os.map((o) => o.max[2])),
  });
  const viejo = box(total.objs.slice(0, 6)), nuevo = box(total.objs.slice(6));
  const solapa = viejo.x0 < nuevo.x1 && nuevo.x0 < viejo.x1 && viejo.z0 < nuevo.z1 && nuevo.z0 < viejo.z1;
  expect(solapa, `bloque nuevo ${JSON.stringify(nuevo)} vs existente ${JSON.stringify(viejo)}`).toBe(false);
});
