/**
 * @file e2e/ux3-edicion-resta.spec.ts
 * @description Recorrido del evaluador: cubo + cilindro sólido, pieza negativa sobre el cilindro y botón flotante
 * «Aplicar 1 resta». Tras restar queda seleccionado solo el cilindro recortado (sin «Restar» a un clic) y el cubo
 * ajeno no se reconstruye.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, crear, seleccion, SHOTS } from './ux3-edicion-helpers';

test('aplicar restas deja seleccionado solo el objeto resultante', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  await crear(page, 'box', { width: 40, height: 40, depth: 40 }, [40, 20, 0]);
  const cil = await crear(page, 'cylinder', undefined, [-30, 15, 0]);
  const cuboMesh = await page.evaluate(() => (window as any).__s.getState().objects[0].mesh.positions.length);
  await page.evaluate(async (id) => {
    await (window as any).__s.getState().addPieceToObject('cylinder', 'negative', id);
  }, cil);

  const fab = page.locator('.kura-boolean-fab');
  await expect(fab).toHaveAccessibleName('Aplicar 1 resta');
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(fab).toBeHidden();
  await expect.poll(() => seleccion(page)).toHaveLength(1);
  const sel = await seleccion(page);
  expect(sel[0]).toMatch(/Cilindro/);
  // Con un solo objeto seleccionado no aparece la sección de booleanas del inspector.
  await expect(page.getByRole('button', { name: 'Restar', exact: true })).toHaveCount(0);
  const despues = await page.evaluate(() => {
    const s = (window as any).__s.getState();
    return { n: s.objects.length, holes: s.objects.filter((o: any) => o.role === 'negative').length, cubo: s.objects.find((o: any) => /Cubo/.test(o.name))?.mesh.positions.length };
  });
  expect(despues).toEqual({ n: 2, holes: 0, cubo: cuboMesh });
  await page.screenshot({ path: `${SHOTS}/1-resta-seleccion.png` });
  expect(errs).toEqual([]);
});
