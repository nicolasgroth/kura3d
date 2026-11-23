/**
 * @file e2e/import-fluida.spec.ts
 * @description Importación fluida de un 3MF de muchas piezas (sintético: 30 toros cerrados de 30 mil
 * triángulos, generados aquí): las piezas entran a la escena por tandas y la barra muestra de verdad
 * «N de 30 piezas» mientras lo hace; la escena final trae las 30 piezas completas y seleccionadas, y
 * deshacer la quita de una vez (un solo paso). Ejecuta con
 * `KURA_URL=http://127.0.0.1:5247/ npx playwright test import-fluida`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { modelXml, pack3mf, translate } from '../src/engine/__tests__/ioFixtures';
import { abrir } from './ux-escena-helpers';

const PARTS = 30;
const SEG = 150;
const RINGS = 100;
const R = 10;
const r = 3;

/** Malla 3MF de un toro cerrado (2·SEG·RINGS triángulos, orientación hacia afuera, Z arriba). */
function torusXml(): string {
  const v: string[] = [];
  for (let i = 0; i < SEG; i++) {
    const u = (i / SEG) * Math.PI * 2;
    for (let j = 0; j < RINGS; j++) {
      const w = (j / RINGS) * Math.PI * 2;
      const x = (R + r * Math.cos(w)) * Math.cos(u);
      const y = (R + r * Math.cos(w)) * Math.sin(u);
      const z = r * Math.sin(w) + r;
      v.push(`<vertex x="${x.toFixed(4)}" y="${y.toFixed(4)}" z="${z.toFixed(4)}"/>`);
    }
  }
  const t: string[] = [];
  const id = (i: number, j: number) => (i % SEG) * RINGS + (j % RINGS);
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RINGS; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      t.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`, `<triangle v1="${a}" v2="${c}" v3="${d}"/>`);
    }
  }
  return `<mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh>`;
}

function file3mf(): Buffer {
  const mesh = torusXml();
  const resources = Array.from({ length: PARTS }, (_, k) => `<object id="${k + 1}" type="model" name="Toro ${k + 1}">${mesh}</object>`).join('');
  const build = Array.from({ length: PARTS }, (_, k) => `<item objectid="${k + 1}" transform="${translate((k % 6) * 30, Math.floor(k / 6) * 30, 0)}"/>`).join('');
  return Buffer.from(pack3mf({ '3D/3dmodel.model': modelXml(resources, build) }));
}

test('3MF de 30 piezas: la barra muestra «N de 30 piezas» y la escena queda completa', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page);
  // Lo que la barra muestra de verdad, fotograma a fotograma (no lo que el store emitió).
  await page.evaluate(() => {
    const w = window as any;
    w.__bar = [] as string[];
    const tick = () => {
      const text = document.querySelector('.kura-op-progress-phase')?.textContent ?? '';
      if (text && w.__bar[w.__bar.length - 1] !== text) w.__bar.push(text);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles({ name: 'toros.3mf', mimeType: 'model/3mf', buffer: file3mf() });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 180_000 }).toBe(PARTS);
  await expect(page.locator('.kura-op-progress')).toHaveCount(0, { timeout: 30_000 });

  const bar: string[] = await page.evaluate(() => (window as any).__bar);
  const parts = bar.map((s) => /^(\d+) de (\d+) piezas$/.exec(s)).filter((m): m is RegExpExecArray => m !== null);
  // Se vio al menos un avance intermedio pintado (no solo el final) y siempre creciente.
  expect(parts.some((m) => Number(m[1]) < PARTS && Number(m[2]) === PARTS)).toBe(true);
  const done = parts.map((m) => Number(m[1]));
  expect(done).toEqual([...done].sort((a, b) => a - b));

  const scene = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    return {
      names: s.objects.map((o: any) => o.name),
      tris: s.objects.map((o: any) => o.mesh.indices.length / 3),
      manifold: s.objects.every((o: any) => o.stats.isManifold),
      volumes: s.objects.map((o: any) => o.stats.volumeMm3),
      dims: s.objects.map((o: any) => o.stats.dimensionsMm),
      selected: s.selectedIds.length,
    };
  });
  expect(new Set(scene.names).size).toBe(PARTS);
  expect(scene.tris.every((n: number) => n === 2 * SEG * RINGS)).toBe(true);
  expect(scene.manifold).toBe(true);
  // Volumen del toro 2π²·R·r² (≈1777 mm³), con la pérdida por facetado (< 1 %).
  const expected = 2 * Math.PI ** 2 * R * r * r;
  for (const vol of scene.volumes) expect(Math.abs(vol - expected) / expected).toBeLessThan(0.01);
  for (const d of scene.dims) {
    const sorted = [...d].sort((a: number, b: number) => a - b);
    expect(sorted[0]).toBeCloseTo(2 * r, 1);
    expect(sorted[2]).toBeCloseTo(2 * (R + r), 0);
  }
  expect(scene.selected).toBe(PARTS);

  // Un solo paso de deshacer quita toda la importación.
  await page.evaluate(() => (window as any).__s.getState().undo());
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(0);
});
