/**
 * @file e2e/docs/capturas-referencia.spec.ts
 * @description Capturas de la guía «Objetos de referencia»: una placa importada como referencia junto a
 * una caja que la envuelve (relleno semitransparente y contorno discontinuo), y el inspector con el tipo
 * Referencia y su opacidad. Piezas generadas en memoria, nunca modelos de terceros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar, sinAvisos, stlCubos } from './helpers';

test('referencia', async ({ page }) => {
  await abrir(page);
  // «Placa» de 60 mm importada como referencia por el menú Importar.
  await page.getByRole('button', { name: 'Opciones de importación' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar como referencia…' }).click();
  await (await chooser).setFiles({ name: 'placa.stl', mimeType: 'model/stl', buffer: Buffer.from(stlCubos([[0, 4, 0]], 8)) });
  await expect.poll(() => page.evaluate(() => (window as any).__s.getState().objects.length)).toBe(1);
  const placa = await page.evaluate(() => (window as any).__s.getState().objects[0].id);
  await cmd(page, 'transform_object', { id: placa, scale: [7, 5, 1] });
  // Caja que la contiene (sólido) a un lado, para comparar.
  await cmd(page, 'create_primitive', { type: 'box', width: 64, depth: 44, height: 14, name: 'Caja', position: [0, 0, 0], color: '#38bdf8' });
  const caja = await page.evaluate(() => (window as any).__s.getState().objects[1].id);
  await cmd(page, 'transform_object', { id: caja, position: [80, 0, 0] });
  await sinAvisos(page);
  await encuadrar(page, 'scene');
  await page.mouse.move(720, 890);
  await page.screenshot({ path: 'docs/guia/img/objetos-de-referencia-01-escena.png' });

  await seleccionar(page, [placa]);
  await page.waitForTimeout(600);
  const insp = page.locator('#kura-inspector-panel');
  await expect(insp.getByRole('group', { name: 'Tipo de volumen' })).toBeVisible();
  await captura(page, 'objetos-de-referencia-02-inspector', insp);
});
