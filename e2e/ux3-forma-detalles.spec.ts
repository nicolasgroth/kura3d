/**
 * @file e2e/ux3-forma-detalles.spec.ts
 * @description Detalles: el objeto importado toma el siguiente color de la paleta (no repite el del anterior).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-movil-helpers';

/** STL ASCII de un tetraedro cerrado de 20 mm de arista aproximada. */
const TETRA = `solid t
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 0 20 0
vertex 20 0 0
endloop
endfacet
facet normal 0 -1 0
outer loop
vertex 0 0 0
vertex 20 0 0
vertex 0 0 20
endloop
endfacet
facet normal -1 0 0
outer loop
vertex 0 0 0
vertex 0 0 20
vertex 0 20 0
endloop
endfacet
facet normal 1 1 1
outer loop
vertex 20 0 0
vertex 0 20 0
vertex 0 0 20
endloop
endfacet
endsolid t
`;

test('el objeto importado usa el siguiente color de la paleta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrir(page, 'es');
  await page.evaluate(async () => {
    await (window as any).__s.getState().createPrimitive('box', { width: 20, height: 20, depth: 20 }, {});
  });
  await page.waitForTimeout(600);
  await page.evaluate(async (stl) => {
    const dt = new DataTransfer();
    dt.items.add(new File([stl], 'tetra.stl'));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, TETRA);
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length), { timeout: 30000 }).toBe(2);
  const colores = await page.evaluate(() => (window as any).__s.getState().objects.map((o: any) => o.color));
  expect(colores[1], `colores: ${colores.join(', ')}`).not.toBe(colores[0]);
});
