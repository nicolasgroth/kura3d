/**
 * @file e2e/docs/capturas-placas.spec.ts
 * @description Capturas de la guía «Placas»: el botón «+ Placa» junto al rótulo de la cama, la tira con dos placas
 * y una cama por placa en el visor, «Mover a placa» desde la paleta de comandos y el aviso de una pieza que se sale
 * del volumen de una placa. Piezas creadas en la propia app (nunca modelos de terceros).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { abrir, captura, cmd, encuadrar, IMG_DIR, seleccionar, sinAvisos } from './helpers';

const store = <T,>(page: Page, fn: (s: any) => T): Promise<T> => page.evaluate((src) => (0, eval)(`(${src})`)((window as any).__s.getState()), fn.toString());

test('placas', async ({ page }) => {
  await abrir(page);
  const cubo = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 30, name: 'Cabeza', position: [-40, 0, 0], color: '#38bdf8' });
  const torso = await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 50, name: 'Cuerpo', position: [40, 0, 0], color: '#f97316' });
  await encuadrar(page, 'scene');
  await seleccionar(page, []);

  // 1) Una sola placa: el botón «+ Placa» junto al rótulo de la cama (recorte de la parte baja del visor).
  const agregar = page.getByTestId('plate-add-first');
  await expect(agregar).toBeVisible();
  await page.mouse.move(700, 300);
  await captura(page, 'placas-01-agregar', { x: 344, y: 760, width: 800, height: 112 });

  // 2) Segunda placa por el botón real: aparece la tira y la cama nueva, que queda activa.
  await agregar.click();
  // Aviso al crear: «Placa 2 creada» (se captura antes de que se cierre).
  await expect(page.getByText(/Placa 2 creada/).first()).toBeVisible();
  await page.screenshot({ path: path.join(IMG_DIR, 'placas-05-creada.png'), clip: { x: 0, y: 600, width: 1144, height: 300 } });
  const tira = page.getByRole('region', { name: 'Placas de impresión' });
  await expect(tira).toBeVisible();
  await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects.find((o: any) => o.name === 'Cuerpo').id]));
  await page.waitForTimeout(400);
  await encuadrar(page, 'scene');
  await expect(tira.getByRole('button', { name: /^Placa 2:/ })).toContainText('1 pieza');
  await captura(page, 'placas-02-tira');

  // 3) «Mover a placa» desde la paleta: la paleta lista una opción por placa.
  await seleccionar(page, [cubo.id]);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Mover a placa');
  await expect(page.getByRole('option', { name: /Mover a placa: Placa 2/ }).first()).toBeVisible();
  await page.waitForTimeout(400);
  await captura(page, 'placas-03-mover');
  await page.keyboard.press('Escape');

  // 4) Una pieza más ancha que la cama: la ficha de su placa dice «Fuera de volumen» y el aviso nombra la placa.
  await store(page, (s) => s.setObjectTransform(s.objects.find((o: any) => o.name === 'Cuerpo').id, { scale: [8, 1, 1] }, true));
  await seleccionar(page, []);
  await expect(page.getByTestId('oob-plates')).toBeVisible({ timeout: 20_000 });
  await encuadrar(page, 'scene');
  await sinAvisos(page);
  await captura(page, 'placas-04-fuera');
  expect(torso.id).toBeTruthy();

  // 5) Insignia de placa en la lista de escena y posición del inspector relativa a la placa (pieza en la placa 2).
  await store(page, (s) => s.setObjectTransform(s.objects.find((o: any) => o.name === 'Cuerpo').id, { scale: [1, 1, 1] }, true));
  await seleccionar(page, [torso.id]);
  await expect(page.locator('.kura-plate-badge').first()).toBeVisible();
  await expect(page.getByText(/Posición respecto de/)).toBeVisible();
  await encuadrar(page, 'scene');
  await captura(page, 'placas-06-insignia-inspector');

  // 6) «Mover a placa» en el primer nivel del menú del clic derecho.
  await seleccionar(page, [cubo.id]);
  await page.getByRole('treeitem', { name: /Cabeza/ }).first().click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Mover a placa/ }).first()).toBeVisible();
  await captura(page, 'placas-07-menu');
  await page.keyboard.press('Escape');
});

test('placas: vistas, repartir y cama por placa', async ({ page }) => {
  await abrir(page);
  const nombres = ['Cabeza', 'Cuerpo', 'Brazo', 'Pie'];
  const colores = ['#38bdf8', '#f97316', '#22c55e', '#e11d48'];
  for (let i = 0; i < 4; i++) {
    await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 40, height: 20 + i * 10, name: nombres[i], position: [-60 + i * 40, 0, 0], color: colores[i] });
  }
  await encuadrar(page, 'scene');
  await seleccionar(page, []);
  await page.getByTestId('plate-add-first').click();
  const tira = page.getByRole('region', { name: 'Placas de impresión' });
  await expect(tira).toBeVisible();
  await store(page, (s) => s.moveToPlate(s.plates[1].id, [s.objects.find((o: any) => o.name === 'Pie').id]));
  await page.waitForTimeout(400);
  await encuadrar(page, 'scene');

  // 1) Selector Imprimir / Armado / Libre (recorte de la tira de placas).
  const selector = page.getByTestId('viewmode-selector');
  await expect(selector).toBeVisible();
  const caja = (await selector.boundingBox())!;
  await captura(page, 'placas-08-vistas', { x: Math.max(0, caja.x - 20), y: Math.max(0, caja.y - 10), width: Math.min(560, 1440 - caja.x), height: caja.height + 20 });

  // 3) «Repartir en placas…»: panel con la vista previa y los contornos en el visor.
  await page.getByTestId('plate-arrange').click();
  await expect(page.getByTestId('arrange-preview')).toBeVisible();
  await expect(page.getByTestId('arrange-summary')).not.toBeEmpty({ timeout: 60_000 });
  await expect(page.getByTestId('arrange-running')).toHaveCount(0, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await captura(page, 'placas-10-repartir');
  await page.getByTestId('panel-back').click();
  await page.waitForTimeout(400);

  // 4) Cama por placa: el diálogo y dos camas de distinto tamaño.
  await tira.getByTestId('plate-bed-open').nth(1).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  // Una cama de otro tamaño que la del proyecto (256 mm), para que se vea la diferencia.
  await dialogo.locator('label.kura-plate-bed-option').filter({ hasNotText: /256/ }).first().click();
  await captura(page, 'placas-11-cama-dialogo');
  await page.getByTestId('plate-bed-apply').click();
  await expect(dialogo).toHaveCount(0);
  await page.waitForTimeout(400);
  await encuadrar(page, 'scene');
  await expect(tira.getByTestId('plate-chip-bed').first()).toBeVisible();
  await captura(page, 'placas-12-dos-camas');
});

test('placas: vista armada de una figura dividida', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'box', width: 300, depth: 120, height: 120, name: 'Figura', position: [0, 0, 0], color: '#38bdf8' });
  await cmd(page, 'split_for_bed' as string, { objectId: pieza.id });
  await page.waitForTimeout(1500);
  await seleccionar(page, []);
  await encuadrar(page, 'scene');
  await page.getByTestId('viewmode-assembly').click();
  await expect(page.getByTestId('viewmode-explode-bar')).toBeVisible();
  await page.getByTestId('viewmode-explode').fill('25');
  await page.waitForTimeout(900);
  await encuadrar(page, 'fit');
  await captura(page, 'placas-09-armado');
});
