/**
 * @file e2e/docs/capturas.spec.ts
 * @description Generador de las capturas de `docs/guia/img/` (guías de uso de Kurra3D Studio). Cada prueba arma una
 * escena con primitivas de la app y guarda PNG de 1440×900 en tema claro y español. No afirma comportamiento:
 * si la interfaz cambia, se vuelve a correr (`npm run docs:capturas`) y las imágenes se regeneran.
 * Filtra una guía con `npm run docs:capturas -- -g dividir`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */
import { test, expect } from '@playwright/test';
import { abrir, captura, cmd, encuadrar, importarArchivo, seleccionar, sinAvisos, stlCubos } from './helpers';

const IZQ = { x: 0, y: 52, width: 268, height: 650 };
const DER = { x: 1144, y: 52, width: 296, height: 820 };

test('primeros-pasos', async ({ page }) => {
  await abrir(page);
  await captura(page, 'primeros-pasos-01-vacio');
  const caja = await cmd(page, 'create_primitive', { type: 'box', width: 60, height: 40, depth: 30, name: 'Caja', position: [-50, 0, 0] });
  await cmd(page, 'create_primitive', { type: 'cylinder', radius: 20, height: 50, name: 'Cilindro', position: [30, 10, 0] });
  await cmd(page, 'create_primitive', { type: 'sphere', radius: 22, name: 'Esfera', position: [-10, -60, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [caja.id]);
  await page.waitForTimeout(500);
  await captura(page, 'primeros-pasos-02-interfaz');
  await captura(page, 'primeros-pasos-03-formas', IZQ);
  await captura(page, 'primeros-pasos-04-inspector', DER);
  // Barra lateral compacta (con el tirador) y vista sin cama; al final se dejan como estaban.
  await page.getByTestId('left-sidebar-handle').click();
  await page.waitForTimeout(300);
  await captura(page, 'primeros-pasos-05-barra-compacta', { x: 0, y: 0, width: 720, height: 520 });
  await page.evaluate(() => (window as any).__s.getState().setLeftSidebarMode('full'));
  await page.getByTestId('bed-toggle').click();
  await page.waitForTimeout(500);
  await captura(page, 'primeros-pasos-06-sin-cama');
  await page.getByTestId('bed-toggle').click();
});

test('dividir-para-imprimir', async ({ page }) => {
  await abrir(page);
  const grande = await cmd(page, 'create_primitive', { type: 'box', width: 400, height: 200, depth: 180, name: 'Pieza grande', position: [0, 0, 0] });
  await encuadrar(page, 'scene');
  await seleccionar(page, [grande.id]);
  await page.keyboard.press('Shift+C');
  const dividir = page.getByRole('button', { name: 'Dividir', exact: true });
  await expect(dividir).toBeEnabled({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await captura(page, 'dividir-para-imprimir-01-plan');
  await dividir.click();
  await page.waitForTimeout(6000);
  await encuadrar(page, 'scene');
  await captura(page, 'dividir-para-imprimir-02-resultado');
});
