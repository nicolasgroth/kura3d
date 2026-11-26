/**
 * @file e2e/docs/capturas-bordes.spec.ts
 * @description Captura del apartado «Bordes redondeados y chaflanes» de `docs/guia/primeros-pasos.md`:
 * una caja con las esquinas verticales redondeadas y el grupo «Bordes» del inspector. Archivo propio para
 * regenerarla sin tocar las demás capturas de la guía (`npm run docs:capturas -- e2e/docs/capturas-bordes.spec.ts`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

test('primeros-pasos: bordes redondeados', async ({ page }) => {
  await abrir(page);
  const caja = await cmd(page, 'create_primitive', {
    type: 'box', width: 60, depth: 40, height: 25, name: 'Caja redondeada', placement: 'origin',
    edgeStyle: 'round', edgeSize: 8, edgeScope: 'vertical',
  });
  await encuadrar(page, 'scene');
  await seleccionar(page, [caja.id]);
  await sinAvisos(page);
  const params = page.getByRole('complementary', { name: 'Inspector' }).getByRole('region', { name: 'Parámetros' });
  await params.getByRole('group', { name: 'Bordes' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await captura(page, 'primeros-pasos-07-bordes');
});
