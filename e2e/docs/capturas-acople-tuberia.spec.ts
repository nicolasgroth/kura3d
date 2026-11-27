/**
 * @file e2e/docs/capturas-acople-tuberia.spec.ts
 * @description Capturas de la guía «Acople de tubería» (ESCRITO SIN EJECUTAR): la tarjeta en la galería de Asistentes,
 * el formulario roscado con «Enrosca: holgura mínima…», la holgura 0 con su aviso, la unión a presión con «Encaja…» y
 * las dos mitades creadas en el visor. Los campos numéricos se buscan como `spinbutton` exacto (los botones ▲▼ llevan
 * la misma etiqueta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { test, expect, type Page } from '@playwright/test';
import { abrir, captura, encuadrar, sinAvisos } from './helpers';

async function escribir(page: Page, name: string, value: string) {
  const input = page.getByRole('spinbutton', { name, exact: true });
  await input.fill(value);
  await input.press('Tab');
}

test('acople de tubería', async ({ page }) => {
  await abrir(page);
  // 1) Galería: la tarjeta del acople con su miniatura.
  await page.getByRole('button', { name: 'Insertar', exact: true }).first().click();
  await page.getByRole('menuitem', { name: /^Asistentes/ }).click();
  const tarjeta = page.locator('.kura-asis-card[data-recipe="kura.acople-tuberia"]');
  await expect(tarjeta.locator('svg.kura-asis-thumb')).toHaveCount(1, { timeout: 60_000 });
  await tarjeta.scrollIntoViewIfNeeded();
  await sinAvisos(page);
  await page.mouse.move(700, 880);
  await captura(page, 'acople-tuberia-01-galeria');
  // 2) Formulario roscado con la vista previa y el resultado del enroscado.
  await tarjeta.click();
  const verificacion = page.locator('.kura-asis-screwfit');
  await expect(verificacion).toContainText(/Enrosca: holgura mínima/, { timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.mouse.move(700, 880);
  await captura(page, 'acople-tuberia-02-roscado');
  // 3) Holgura 0: el aviso antes de crear.
  await escribir(page, 'Holgura de la rosca', '0');
  await expect(verificacion).toHaveAttribute('data-status', /tight|interference/, { timeout: 60_000 });
  await page.getByRole('spinbutton', { name: 'Holgura de la rosca', exact: true }).scrollIntoViewIfNeeded();
  await captura(page, 'acople-tuberia-03-sin-holgura');
  await escribir(page, 'Holgura de la rosca', '0.3');
  await expect(verificacion).toHaveAttribute('data-status', 'ok', { timeout: 60_000 });
  // 4) Unión a presión: «Encaja: holgura mínima…».
  await page.getByLabel('Tipo de unión', { exact: true }).selectOption({ label: 'A presión (enchufe)' });
  await expect(verificacion).toContainText(/Encaja: holgura mínima/, { timeout: 60_000 });
  await page.waitForTimeout(600);
  await page.mouse.move(700, 880);
  await captura(page, 'acople-tuberia-04-presion');
  // 5) Crear: macho y hembra lado a lado, apoyados en su tramo liso.
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Asistentes disponibles' })).toBeHidden();
  await encuadrar(page, 'iso');
  await sinAvisos(page);
  await page.waitForTimeout(600);
  await captura(page, 'acople-tuberia-05-piezas');
});
