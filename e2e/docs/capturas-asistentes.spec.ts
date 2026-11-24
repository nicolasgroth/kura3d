/**
 * @file e2e/docs/capturas-asistentes.spec.ts
 * @description Capturas de la guía Asistentes: la lista de asistentes abierta desde Insertar y el formulario de
 * «Caja con tapa» con un aviso de pared delgada junto a su campo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, sinAvisos } from './helpers';

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
  await page.mouse.move(700, 880);
  await captura(page, 'asistentes-02-caja');
});
