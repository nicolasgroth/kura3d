/**
 * @file e2e/reales-ui-progreso.spec.ts
 * @description Importación con etapas visibles: la fase de la barra pasa por Leyendo archivo →
 * Interpretando → Colocando en la escena (STL sintético de ~200 mil triángulos), y la barra muestra
 * "N de M piezas" con avance determinado cuando la fase trae `done/total`.
 * Ejecuta con `KURA_URL=http://127.0.0.1:5234/ npm run test:e2e -- reales-ui-progreso`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, importarStl } from './ux-escena-helpers';

/** STL binario con `n` triángulos (rejilla en zigzag). */
function stlBinario(n: number): Buffer {
  const buf = Buffer.alloc(84 + 50 * n);
  buf.writeUInt32LE(n, 80);
  for (let k = 0; k < n; k++) {
    const o = 84 + 50 * k + 12;
    const x = (k % 500) * 0.2, z = Math.floor(k / 500) * 0.2;
    [x, 0, z, x + 0.2, 0, z, x, 1 + (k % 3), z + 0.2].forEach((c, i) => buf.writeFloatLE(c, o + i * 4));
  }
  return buf;
}

test('la importación informa sus etapas en orden', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__phases = [];
    w.__s.subscribe((s: any) => {
      const p = s.busyProgress?.phase;
      if (p && w.__phases[w.__phases.length - 1] !== p) w.__phases.push(p);
    });
  });
  await importarStl(page, 'pesado.stl', stlBinario(200_000));
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 60000 }).toBe(1);
  const phases: string[] = await page.evaluate(() => (window as any).__phases);
  const imp = phases.filter((p) => p.startsWith('import:'));
  // Tres etapas en orden y, después, cero o más avances por piezas `import:parts:d/t` con `d` creciente hasta `t`.
  expect(imp.slice(0, 3)).toEqual(['import:read', 'import:parse', 'import:place']);
  const partes = imp.slice(3).map((p) => /^import:parts:(\d+)\/(\d+)$/.exec(p));
  expect(partes.every((m) => m !== null)).toBe(true);
  const hechas = partes.map((m) => Number(m![1]));
  expect(hechas).toEqual([...hechas].sort((a, b) => a - b));
  expect(new Set(hechas).size).toBe(hechas.length);
  if (partes.length) {
    const total = Number(partes[0]![2]);
    expect(partes.every((m) => Number(m![2]) === total)).toBe(true);
    expect(hechas[hechas.length - 1]).toBe(total);
  }
});

test('con avance por piezas la barra dice "N de M piezas" y es determinada', async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    const s = (window as any).__s;
    s.setState({ busyOperation: 'import_mesh', busyProgress: { name: 'import_mesh', phase: 'import:parts:7/19', startedAt: Date.now() - 5000, cancellable: true } });
  });
  const bar = page.locator('.kura-op-progress');
  await expect(bar).toContainText('7 de 19 piezas');
  await expect(bar.locator('.kura-op-progress-bar.is-determinate')).toHaveAttribute('style', /width: 37%/);
  await page.evaluate(() => (window as any).__s.setState({ busyProgress: { name: 'import_mesh', phase: 'import:parse', startedAt: Date.now() - 5000, cancellable: true } }));
  await expect(bar).toContainText('Interpretando…');
  await expect(bar.locator('.kura-op-progress-bar.is-determinate')).toHaveCount(0);
  await page.evaluate(() => (window as any).__s.setState({ busyOperation: null, busyProgress: null }));
});
