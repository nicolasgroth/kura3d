/**
 * @file e2e/qa14-hueco-y-reparar.spec.ts
 * @description QA14: ahuecar un cubo de 150 mm con pared 2 deja volumen exacto (150³ − 146³) y avisa de la cavidad
 * cerrada; reparar un STL con un agujero (11 triángulos) devuelve un cubo cerrado de 8000 mm³.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

function stlCuboAbierto(lado: number): string {
  const p = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((v) => v.map((c) => c * lado));
  const caras = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const l = ['solid abierto'];
  caras.forEach((c, i) => {
    if (i === 3) return; // sin esta cara: un agujero
    l.push('facet normal 0 0 0', 'outer loop', ...c.map((k) => `vertex ${p[k].join(' ')}`), 'endloop', 'endfacet');
  });
  l.push('endsolid abierto');
  return l.join('\n');
}

test('ahuecar un cubo de 150 mm con pared 2: volumen exacto y aviso de cavidad cerrada', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Cubo', exact: true }).click();
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  for (const l of ['Ancho', 'Fondo', 'Alto']) {
    const t = insp.locator(`input[aria-label="${l}"]`).first();
    await t.fill('150');
    await t.press('Enter');
  }
  const pared = insp.locator('input[aria-label="Grosor de pared"]').first();
  await pared.scrollIntoViewIfNeeded();
  await pared.fill('2');
  await pared.press('Enter');
  await insp.getByRole('button', { name: /Aplicar ahuecado/ }).click();
  await expect(insp.getByText(/262\.864/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/cavidad cerrada/i).first()).toBeVisible();
});

test('reparar un STL con un agujero lo deja cerrado con volumen 8000 mm³', async ({ page }) => {
  await abrir(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar 3D', exact: true }).first().click();
  (await chooser).setFiles({ name: 'cubo_agujero.stl', mimeType: 'model/stl', buffer: Buffer.from(stlCuboAbierto(20)) });
  const insp = page.getByRole('complementary', { name: 'Inspector' });
  await expect(insp.getByText(/6\.666,7/)).toBeVisible({ timeout: 15000 });
  await page.getByRole('tab', { name: /Escena/ }).click();
  await page.locator('[role=treeitem]', { hasText: 'cubo_agujero' }).click({ button: 'right', position: { x: 60, y: 20 } });
  await page.getByRole('menuitem', { name: /Reparar malla/ }).click();
  await expect(insp.getByText(/8\.000/)).toBeVisible({ timeout: 15000 });
  const estado = insp.getByTestId('mesh-status');
  await expect(estado).toContainText('Malla');
  await expect(estado.locator('.kura-badge-ok')).toHaveText('Cerrada');
  await expect(estado.getByRole('button', { name: 'Reparar malla' })).toHaveCount(0);
});
