/**
 * @file e2e/docs/capturas-instrucciones-armado.spec.ts
 * @description Capturas de la guía «Dividir para imprimir», sección «Instrucciones de armado»: el panel con los pasos
 * numerados de una caja dividida en cuatro piezas (2 × 2, creada en la propia app) y el mismo panel con un paso
 * enfocado y sus piezas seleccionadas en el visor. Se corre con `npm run docs:capturas -- -g instrucciones`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos } from './helpers';

test('dividir-para-imprimir: instrucciones de armado', async ({ page }) => {
  test.setTimeout(240_000);
  await abrir(page);
  // Ejes del usuario (Z arriba); la caja nace apoyada en su base. 300 de ancho y 300 de alto en una cama de 200:
  // un corte en X y otro en Z, cuatro piezas.
  const caja = await cmd(page, 'create_primitive', { type: 'box', width: 300, height: 300, depth: 120, name: 'Torre', position: [0, 0, 0] });
  const split = await cmd(page, 'split_for_bed', { id: caja.id, bedWidthMm: 200, bedDepthMm: 200, bedHeightMm: 200, connectorType: 'dowel', connectorSize: 3, connectorCount: 2 });
  const ids: string[] = split.parts.map((p: { id: string }) => p.id);
  expect(ids).toHaveLength(4);
  await seleccionar(page, [ids[0]]);
  await encuadrar(page, 'scene');
  await page.getByTestId('split-assembly-instructions').click();
  const panel = page.locator('.kura-ctx-action[data-action="assemblyInstructions"]');
  const lista = panel.getByRole('list', { name: 'Pasos de armado', exact: true });
  await expect(lista.locator(':scope > li')).toHaveCount(4);
  await sinAvisos(page);
  await captura(page, 'dividir-para-imprimir-08-instrucciones');

  await lista.getByRole('button', { name: /^Paso 4 · / }).focus();
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().selectedIds.length)).toBeGreaterThan(1);
  await page.waitForTimeout(600);
  await captura(page, 'dividir-para-imprimir-09-paso-resaltado');
});
