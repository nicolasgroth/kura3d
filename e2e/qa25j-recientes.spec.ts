/**
 * @file e2e/qa25j-recientes.spec.ts
 * @description QA 26-nov (J): tras guardar en la web con una descripción, la lista «Proyectos recientes» del panel Proyecto
 * muestra la descripción (también tras recargar la página), sin las notas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test } from '@playwright/test';
import { abrir, cmd } from './qa25a-helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test('recientes en la web: la descripción guardada aparece en la lista, incluso tras recargar', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => { delete (window as any).showSaveFilePicker; });
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 20, depth: 20, height: 20, name: 'Cubo', position: [0, 10, 0] });
  await page.getByRole('button', { name: /^Proyecto/ }).first().click();
  const sec = page.getByTestId('panel-project-info');
  await sec.getByLabel('Descripción').fill('DESCRIPCION-VISIBLE-77');
  await sec.getByLabel('Notas').fill('NOTA-PRIVADA-99');
  const dl = page.waitForEvent('download');
  await page.evaluate(() => void (window as any).__s.getState().saveProject(true));
  await dl;
  await page.getByRole('button', { name: 'Ya lo guardé' }).click({ timeout: 4000 }).catch(() => undefined);
  const claves = await page.evaluate(() => JSON.stringify(Object.fromEntries(['kura3d-recent-projects', 'kura3d-recent-info'].map((k) => [k, localStorage.getItem(k)]))));
  console.log('QA25J recientes localStorage', claves.slice(0, 300));
  const grupo = () => page.getByRole('group', { name: 'Proyectos recientes' });
  console.log('QA25J recientes antes de recargar', await grupo().count(), await grupo().innerText().catch(() => '(sin grupo)'));
  await page.reload();
  await page.getByText('Manifold WASM Listo').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /^Proyecto/ }).first().click();
  console.log('QA25J recientes tras recargar', await grupo().count(), await grupo().innerText().catch(() => '(sin grupo)'));
  await page.screenshot({ path: 'G:/proyectos/kura3d/.eval-tmp/qa25j/recientes.png' });
  await expect(grupo()).toContainText('DESCRIPCION-VISIBLE-77');
  await expect(grupo()).not.toContainText('NOTA-PRIVADA');
});
