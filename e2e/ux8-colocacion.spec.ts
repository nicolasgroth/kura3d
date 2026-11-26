/**
 * @file e2e/ux8-colocacion.spec.ts
 * @description Lote ux8 en navegador: el texto 3D y la rosca caen al costado del cilindro (misma fila,
 * sin solaparse) y Mayús+H en el visor oculta la selección y la vuelve a mostrar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ locale: 'es-CL', viewport: { width: 1440, height: 900 } });

test('texto y rosca junto al cilindro, en su misma fila y sin solaparse', async ({ page }) => {
  await abrir(page);
  const r = await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    await s.createPrimitive('cylinder', { radius: 14, height: 36 }, { placement: 'free' });
    await s.createPrimitive('text', { text: 'KURA3D', fontSize: 18, height: 6 }, { placement: 'free' });
    await s.createThreadObject({ kind: 'bolt', diameterMm: 8, pitchMm: 1.25, lengthMm: 20, includeHead: true });
    const { objects } = (window as any).__s.getState();
    return objects.map((o: any) => {
      const p = o.mesh.positions as Float32Array;
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      for (let i = 0; i < p.length; i += 3) {
        minX = Math.min(minX, p[i] + o.position[0]); maxX = Math.max(maxX, p[i] + o.position[0]);
        minZ = Math.min(minZ, p[i + 2] + o.position[2]); maxZ = Math.max(maxZ, p[i + 2] + o.position[2]);
      }
      return { name: o.name, minX, maxX, minZ, maxZ };
    });
  });
  expect(r).toHaveLength(3);
  const [cyl, ...rest] = r;
  for (let i = 0; i < r.length; i += 1) {
    for (let j = i + 1; j < r.length; j += 1) {
      const a = r[i]; const b = r[j];
      const overlap = a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
      expect(overlap, `${a.name} / ${b.name}`).toBe(false);
    }
  }
  for (const o of rest) expect(o.maxZ > cyl.minZ && o.minZ < cyl.maxZ, o.name).toBe(true);
});

test('Mayús+H en el visor oculta la selección y la vuelve a mostrar', async ({ page }) => {
  await abrir(page);
  const id = await page.evaluate(async () => {
    const s = (window as any).__s.getState();
    const box = await s.createPrimitive('box', { width: 20, height: 20, depth: 20 }, { placement: 'free' });
    s.setSelection([box.id]);
    return box.id as string;
  });
  await page.locator('canvas').first().hover();
  const visible = () => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).visible, id);
  const role = () => page.evaluate((i) => (window as any).__s.getState().objects.find((o: any) => o.id === i).role, id);
  await page.keyboard.press('Shift+H');
  expect(await visible()).toBe(false);
  await page.keyboard.press('Shift+H');
  expect(await visible()).toBe(true);
  expect(await role()).not.toBe('negative');
});
