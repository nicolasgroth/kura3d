/**
 * @file e2e/docs/capturas-asistentes.spec.ts
 * @description Capturas de la guía Asistentes: la lista de asistentes abierta desde Insertar, el formulario de
 * «Caja con tapa» con un aviso de pared delgada y su vista previa en el visor, y «Editar con el asistente» sobre la
 * caja ya creada (ficha del inspector y formulario con «Actualizar»).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, seleccionar, sinAvisos } from './helpers';

test('asistentes', async ({ page }) => {
  await abrir(page);
  // 1) Lista: Insertar › Asistentes.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeVisible();
  await sinAvisos(page);
  await page.mouse.move(700, 880);
  await captura(page, 'asistentes-01-lista');
  // 2) Formulario de la caja con tapa, con un aviso por pared delgada.
  await page.getByRole('button', { name: /Caja con tapa/ }).click();
  const pared = page.getByLabel('Pared', { exact: true });
  await pared.click();
  await pared.fill('1.4');
  await pared.press('Tab');
  await expect(page.getByText(/Pared bajo 1,6 mm/)).toBeVisible();
  // La vista previa dibuja el fantasma de la caja y la tapa en el visor antes de crear.
  await expect(page.getByText('Vista previa actualizada')).toBeVisible();
  await page.waitForTimeout(600);
  await page.mouse.move(700, 880);
  await captura(page, 'asistentes-02-caja');
  // 3) Crear y reabrir la caja con sus parámetros: ficha «Creada con un asistente» del inspector.
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeHidden();
  const caja = await page.evaluate(() => (window as any).__s.getState().objects.find((o: any) => o.name === 'Caja').id as string);
  await seleccionar(page, [caja]);
  await sinAvisos(page);
  const editar = page.getByRole('button', { name: 'Editar con el asistente' });
  await expect(editar).toBeVisible();
  await page.mouse.move(700, 880);
  await expect(page.locator('footer')).toContainText('Borrador local guardado', { timeout: 40_000 });
  await captura(page, 'asistentes-03-editar');
  // 4) El formulario vuelve con las respuestas guardadas y «Actualizar».
  await editar.click();
  await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeVisible();
  await expect(page.getByLabel('Pared', { exact: true })).toHaveValue('1,4');
  await page.mouse.move(700, 880);
  await captura(page, 'asistentes-04-actualizar');
});
