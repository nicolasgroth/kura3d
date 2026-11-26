/**
 * @file e2e/docs/capturas-dividir-manual.spec.ts
 * @description Capturas de la guía «Dividir para imprimir», sección «Cortes a mano»: la lista de planos a mano con un
 * plano inclinado y el visor con los planos dibujados, y la misma vista con «Solo las piezas». Sobre una barra creada
 * en la propia app. Se corre con `npm run docs:capturas -- -g "cortes a mano"`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect } from '@playwright/test';
import { itemAccion } from '../acciones-helpers';
import { abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('dividir-para-imprimir: cortes a mano', async ({ page }) => {
  await abrir(page);
  const pieza = await cmd(page, 'create_primitive', { type: 'box', width: 420, height: 60, depth: 60, name: 'Barra', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [pieza.id]);
  await (await itemAccion(page, 'Dividir para imprimir…')).click();
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Editar estos cortes a mano' }).click();
  const inclinacion = page.getByLabel('Inclinación del plano 1 hacia Z (grados)');
  await inclinacion.fill('20');
  await inclinacion.press('Enter');
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Resaltar el plano 1 en el visor' }).click();
  await page.locator('.kura-split-cuts').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await captura(page, 'dividir-para-imprimir-05-cortes-a-mano');
  await page.getByRole('radio', { name: 'Solo las piezas' }).click();
  await page.waitForTimeout(800);
  await captura(page, 'dividir-para-imprimir-06-solo-piezas');
});
