/**
 * @file e2e/ux3-edicion-reparar.spec.ts
 * @description Recorrido del evaluador: importar el STL de cubo con agujero y «Reparar malla» desde el menú. Queda un
 * aviso visible con el resumen (agujeros cerrados y triángulos antes → después) y «Ver detalles», que lleva a las
 * estadísticas del inspector, ya actualizadas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, SHOTS } from './ux3-edicion-helpers';

/** Cubo de `lado` mm sin una de sus 12 caras triangulares (un agujero). */
function stlCuboAbierto(lado: number): string {
  const p = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((v) => v.map((c) => c * lado));
  const caras = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const l = ['solid abierto'];
  caras.forEach((c, i) => {
    if (i === 3) return;
    l.push('facet normal 0 0 0', 'outer loop', ...c.map((k) => `vertex ${p[k].join(' ')}`), 'endloop', 'endfacet');
  });
  l.push('endsolid abierto');
  return l.join('\n');
}

test('reparar malla deja un aviso con el resumen y «Ver detalles» lleva a las estadísticas actualizadas', async ({ page }) => {
  const errs = await abrir(page, 1440, 900);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  await (await chooser).setFiles({ name: 'cubo_agujero.stl', mimeType: 'model/stl', buffer: Buffer.from(stlCuboAbierto(20)) });
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  const stats = insp.locator('#kura-geometry-stats');
  await expect(stats).toContainText('11');
  await page.locator('[role=treeitem]', { hasText: 'cubo_agujero' }).click({ button: 'right', position: { x: 60, y: 12 } });
  // Menú del objeto: «Reparar malla» está en el submenú «Malla» (los mismos grupos que el menú «Acciones»).
  await page.getByRole('menuitem', { name: 'Malla', exact: true }).click();
  await page.getByRole('menuitem', { name: /Reparar malla/ }).click();
  // El agujero grande cerrado con una tapa llega como advertencia y queda a la vista; el resumen de la reparación
  // (con «Ver detalles») queda en el histórico de información.
  await expect(page.locator('.kura-toast.warning')).toContainText(/agujero/, { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/8-reparar.png` });
  await page.getByRole('button', { name: /mensajes? informativos?$/ }).click();
  const resumen = page.getByRole('dialog', { name: 'Información' }).locator('li', { hasText: /Malla reparada: .*agujero.*triángulos: 11 → 12/ });
  await expect(resumen).toBeVisible({ timeout: 15000 });
  await resumen.getByRole('button', { name: 'Ver detalles' }).click();
  await expect(stats).toBeFocused();
  await expect(stats.locator('.kura-stat-box', { hasText: 'Triángulos' })).toContainText('12');
  expect(errs).toEqual([]);
});
