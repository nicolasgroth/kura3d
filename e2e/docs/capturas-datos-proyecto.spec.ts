/**
 * @file e2e/docs/capturas-datos-proyecto.spec.ts
 * @description Captura de la guía «Guardar y recuperar»: la sección «Datos del proyecto» (descripción, notas, autor,
 * fechas y tiempo de trabajo) del panel Proyecto, rellena con texto de ejemplo. Escena creada en la propia app.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, seleccionar } from './helpers';

test('datos del proyecto', async ({ page }) => {
  await abrir(page);
  await cmd(page, 'create_primitive', { type: 'box', width: 40, depth: 30, height: 20, name: 'Caja', position: [0, 0, 0], color: '#38bdf8' });
  await encuadrar(page, 'scene');
  await seleccionar(page, []);
  const seccion = page.getByRole('region', { name: 'Datos del proyecto' });
  await expect(seccion).toBeVisible();
  await seccion.getByLabel('Descripción').fill('Caja para guardar tornillos del taller');
  await seccion.getByLabel('Notas').fill('PLA azul, pared de 1,6 mm. Falta imprimir la tapa.');
  await seccion.getByLabel('Autor').fill('Ana');
  await seccion.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await captura(page, 'guardar-y-recuperar-01-datos-del-proyecto');
});
